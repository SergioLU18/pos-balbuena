-- ============================================================================
-- pos-balbuena · backend UNIFICADO sobre las tablas de tali
-- ----------------------------------------------------------------------------
-- pos-balbuena (lado mesero/cocina) y tali (lado cliente: dividir y pagar) son
-- dos frontends del MISMO restaurante. Por eso el POS reutiliza las tablas reales
-- de tali — `restaurantes`, `mesas`, `cuentas`, `cuenta_items` — con sus tipos
-- originales, y solo agrega lo que tali no tiene: `meseros` y `pedidos` (cocina).
--
-- El flujo de escritura pasa por las propias funciones de tali
-- (add_or_update_cuenta_item, recalculate_subtotal), así que una cuenta abierta
-- por el mesero es la misma que el cliente divide y paga en tali.
--
-- Orden de ejecución:  cleanup.sql  →  schema.sql  →  seed.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Meseros (tali no tiene este concepto) ───────────────────────────────────
create table if not exists meseros (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  nombre         text not null,
  mesas          text[] not null default '{}',   -- números de mesa asignados
  pin            text,                            -- PIN de 4 dígitos para cambiar de mesero
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ── Pedidos de cocina (tali no tiene cocina) ────────────────────────────────
-- items guarda la orden COMPLETA (tier, mitades, ingredientes, nota) para la
-- pantalla de cocina. Los renglones facturables planos viven en cuenta_items.
create table if not exists pedidos (
  id                    uuid primary key default gen_random_uuid(),
  restaurante_id        uuid references restaurantes(id) on delete cascade,
  mesa_id               uuid references mesas(id) on delete cascade,
  cuenta_id             uuid references cuentas(id) on delete set null,
  mesa_numero           text,
  mesero_nombre         text,
  items                 jsonb not null default '[]',
  estado                text not null default 'pendiente'
                        check (estado in ('pendiente','preparando','listo','entregado')),
  enviado_at            timestamptz not null default now(),
  estado_actualizado_at timestamptz
);
create index if not exists pedidos_mesa_idx   on pedidos (mesa_id);
create index if not exists pedidos_estado_idx on pedidos (estado);

-- 'entregado' (recogido por el mesero) se agregó después del lanzamiento inicial;
-- este ALTER hace que reaplicar schema.sql sobre una base ya existente lo sume
-- al check constraint sin tronar por la tabla ya creada.
alter table pedidos drop constraint if exists pedidos_estado_check;
alter table pedidos add constraint pedidos_estado_check
  check (estado in ('pendiente','preparando','listo','entregado'));

-- Marca de tiempo de cuándo entró cada pedido a cada columna del tablero de cocina.
-- Con esto el cronómetro de cada tarjeta se puede reiniciar por columna (en vez de
-- mostrar siempre el tiempo total desde que se envió), y al llegar a "entregado" el
-- tiempo que pasó en "listo" queda congelado en la fila para poder sacar reportes
-- de tiempos de cocina más adelante.
alter table pedidos add column if not exists preparando_at timestamptz;
alter table pedidos add column if not exists listo_at      timestamptz;
alter table pedidos add column if not exists entregado_at  timestamptz;

-- ============================================================================
-- RPC: enviar orden. Abre la cuenta de la mesa si no hay una activa, agrega los
-- renglones con las MISMAS funciones que usa tali, recalcula el subtotal y crea
-- el pedido de cocina. Devuelve el id de la cuenta.
-- Cada elemento de p_items debe traer: nombre, precio_unitario, cantidad
-- (más el resto de la estructura rica, que se guarda tal cual en pedidos.items).
-- ============================================================================
create or replace function pos_enviar_orden(
  p_mesa_id       uuid,
  p_mesero_nombre text,
  p_items         jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest   uuid;
  v_cuenta uuid;
  v_numero text;
  v_item   jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    return null;
  end if;

  select restaurante_id, numero into v_rest, v_numero from mesas where id = p_mesa_id;

  select id into v_cuenta from cuentas where mesa_id = p_mesa_id and activa limit 1;
  if v_cuenta is null then
    insert into cuentas (mesa_id, restaurante_id, estado, subtotal, activa)
    values (p_mesa_id, v_rest, 'abierta', 0, true)
    returning id into v_cuenta;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    perform add_or_update_cuenta_item(
      v_cuenta,
      v_item->>'nombre',
      (v_item->>'precio_unitario')::numeric,
      (v_item->>'cantidad')::integer,
      null
    );
  end loop;

  perform recalculate_subtotal(v_cuenta);

  insert into pedidos (restaurante_id, mesa_id, cuenta_id, mesa_numero, mesero_nombre, items, estado, enviado_at)
  values (v_rest, p_mesa_id, v_cuenta, v_numero, p_mesero_nombre, p_items, 'pendiente', now());

  return v_cuenta;
end;
$$;

-- ============================================================================
-- RPC: editar cantidad de un renglón ya enviado. Solo permitido mientras el
-- pedido sigue en 'pendiente' (cocina aún no lo ha visto/empezado) — la
-- validación es server-side (no solo ocultar el botón en el cliente), igual
-- que el resto de las funciones de este archivo. Sincroniza pedidos.items
-- (jsonb, para cocina) y la fila correspondiente de cuenta_items (para el
-- total de tali), ubicada por (cuenta_id, nombre) — la misma clave que usa
-- add_or_update_cuenta_item para crearla en pos_enviar_orden.
-- ============================================================================
create or replace function pos_editar_item_pedido(
  p_pedido_id uuid,
  p_item_id   text,
  p_cantidad  integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido      pedidos%rowtype;
  v_idx         int;
  v_item        jsonb;
  v_delta       integer;
begin
  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'La cantidad debe ser al menos 1.';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido % no existe.', p_pedido_id;
  end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'El pedido ya no está en Nuevo (estado actual: %) — no se puede editar.', v_pedido.estado;
  end if;

  select ord - 1, value into v_idx, v_item
  from jsonb_array_elements(v_pedido.items) with ordinality as t(value, ord)
  where value->>'id' = p_item_id;

  if v_idx is null then
    raise exception 'Renglón % no existe en el pedido.', p_item_id;
  end if;

  v_delta := p_cantidad - (v_item->>'cantidad')::integer;

  update pedidos
  set items = jsonb_set(items, array[v_idx::text, 'cantidad'], to_jsonb(p_cantidad))
  where id = p_pedido_id;

  if v_pedido.cuenta_id is not null then
    update cuenta_items
    set cantidad = cantidad + v_delta
    where cuenta_id = v_pedido.cuenta_id
      and nombre = v_item->>'nombre';

    delete from cuenta_items
    where cuenta_id = v_pedido.cuenta_id
      and nombre = v_item->>'nombre'
      and cantidad <= 0;

    perform recalculate_subtotal(v_pedido.cuenta_id);
  end if;
end;
$$;

-- ============================================================================
-- RPC: eliminar un renglón ya enviado. Mismo guard de estado = 'pendiente'
-- que pos_editar_item_pedido. Si el renglón eliminado era el último del
-- pedido, se borra el pedido completo (una comanda sin platillos no debe
-- seguir apareciendo en el tablero de cocina).
-- ============================================================================
create or replace function pos_eliminar_item_pedido(
  p_pedido_id uuid,
  p_item_id   text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido      pedidos%rowtype;
  v_item        jsonb;
  v_items_nuevo jsonb;
begin
  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido % no existe.', p_pedido_id;
  end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'El pedido ya no está en Nuevo (estado actual: %) — no se puede eliminar.', v_pedido.estado;
  end if;

  select value into v_item
  from jsonb_array_elements(v_pedido.items) as value
  where value->>'id' = p_item_id;

  if v_item is null then
    raise exception 'Renglón % no existe en el pedido.', p_item_id;
  end if;

  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_items_nuevo
  from jsonb_array_elements(v_pedido.items) as value
  where value->>'id' <> p_item_id;

  if v_pedido.cuenta_id is not null then
    update cuenta_items
    set cantidad = cantidad - (v_item->>'cantidad')::integer
    where cuenta_id = v_pedido.cuenta_id
      and nombre = v_item->>'nombre';

    delete from cuenta_items
    where cuenta_id = v_pedido.cuenta_id
      and nombre = v_item->>'nombre'
      and cantidad <= 0;

    perform recalculate_subtotal(v_pedido.cuenta_id);
  end if;

  if jsonb_array_length(v_items_nuevo) = 0 then
    delete from pedidos where id = p_pedido_id;
  else
    update pedidos set items = v_items_nuevo where id = p_pedido_id;
  end if;
end;
$$;

-- ============================================================================
-- RPC: cerrar mesa (temporal, mientras el cierre real lo hará la app de pagos).
-- Marca la cuenta activa como cerrada — igual que tali (activa=false,
-- estado='cerrada', closed_at=now()) — y borra los pedidos de cocina de la mesa.
-- ============================================================================
create or replace function pos_cerrar_mesa(p_mesa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cuentas set activa = false, estado = 'cerrada', closed_at = now()
  where mesa_id = p_mesa_id and activa;
  delete from pedidos where mesa_id = p_mesa_id;
end;
$$;

-- ── Orden del listado de mesas (compartido, lo ajusta el admin en Ajustes) ──
-- Igual que platillos.orden: menor = primero. Es una columna del POS sobre la
-- tabla `mesas` de tali (que la ignora); default 0 para las filas que ya existen.
alter table mesas add column if not exists orden int not null default 0;

-- ============================================================================
-- RPC: crear mesa. La usa el admin desde Ajustes → Mesas. Si se indica un mesero,
-- se le asigna la mesa (se agrega su nombre a meseros.mesas). La mesa nueva se
-- coloca al final del listado (orden = máximo actual + 1).
-- ============================================================================
create or replace function pos_crear_mesa(
  p_restaurante_id uuid,
  p_numero         text,
  p_mesero_id      uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa   uuid;
  v_numero text := btrim(coalesce(p_numero, ''));
begin
  if length(v_numero) = 0 then
    raise exception 'El nombre de la mesa no puede estar vacío.';
  end if;
  if v_numero ilike 'PL-%' then
    raise exception 'El prefijo "PL-" está reservado para pedidos para llevar.';
  end if;
  if exists (
    select 1 from mesas
    where restaurante_id = p_restaurante_id and activo and lower(numero) = lower(v_numero)
  ) then
    raise exception 'Ya existe una mesa llamada "%".', v_numero;
  end if;

  insert into mesas (numero, restaurante_id, activo, orden)
  values (
    v_numero, p_restaurante_id, true,
    coalesce((select max(orden) + 1 from mesas where restaurante_id = p_restaurante_id and activo), 0)
  )
  returning id into v_mesa;

  if p_mesero_id is not null then
    begin
      update meseros set mesas = array_append(meseros.mesas, v_numero)
      where id = p_mesero_id and not (v_numero = any(meseros.mesas));
    exception when undefined_column then null;
    end;
  end if;

  return v_mesa;
end;
$$;

-- ============================================================================
-- RPC: borrar mesa (baja lógica: activo=false, no se pierde el historial de
-- pedidos/cuentas que ya la referencian). Bloqueada si la mesa tiene una cuenta
-- abierta — borrarla a medio servicio dejaría la cuenta huérfana.
-- ============================================================================
create or replace function pos_borrar_mesa(p_mesa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero        text;
  v_tiene_cuenta  boolean;
begin
  select exists(select 1 from cuentas where mesa_id = p_mesa_id and activa) into v_tiene_cuenta;
  if v_tiene_cuenta then
    raise exception 'No se puede borrar una mesa con cuenta abierta.';
  end if;

  select numero into v_numero from mesas where id = p_mesa_id;

  update mesas set activo = false where id = p_mesa_id;

  begin
    update meseros set mesas = array_remove(meseros.mesas, v_numero)
    where v_numero = any(meseros.mesas);
  exception when undefined_column then null;
  end;
end;
$$;

-- ============================================================================
-- RPC: renombrar mesa. El nombre acepta letras y números; debe ser único entre
-- las mesas activas del restaurante (sin distinguir mayúsculas) y no puede usar
-- el prefijo "PL-" (reservado para pedidos para llevar). Como meseros.mesas y
-- pedidos.mesa_numero guardan el NOMBRE (no el id), se actualizan en cascada.
-- ============================================================================
create or replace function pos_renombrar_mesa(p_mesa_id uuid, p_numero text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurante uuid;
  v_viejo       text;
  v_nuevo       text := btrim(coalesce(p_numero, ''));
begin
  if length(v_nuevo) = 0 then
    raise exception 'El nombre de la mesa no puede estar vacío.';
  end if;
  if length(v_nuevo) > 24 then
    raise exception 'El nombre de la mesa es demasiado largo (máx. 24 caracteres).';
  end if;
  if v_nuevo ilike 'PL-%' then
    raise exception 'El prefijo "PL-" está reservado para pedidos para llevar.';
  end if;

  select restaurante_id, numero into v_restaurante, v_viejo from mesas where id = p_mesa_id;
  if not found then
    raise exception 'La mesa no existe.';
  end if;

  if exists (
    select 1 from mesas
    where restaurante_id = v_restaurante and id <> p_mesa_id and activo
      and lower(numero) = lower(v_nuevo)
  ) then
    raise exception 'Ya existe una mesa llamada "%".', v_nuevo;
  end if;

  update mesas set numero = v_nuevo where id = p_mesa_id;

  -- Cascadas opcionales: meseros.mesas y pedidos.mesa_numero guardan el NOMBRE
  -- (no el id). Si este proyecto no tiene esas columnas, el renombrado igual queda
  -- hecho — por eso van en sub-bloques que ignoran `undefined_column`.
  begin
    update meseros set mesas = array_replace(meseros.mesas, v_viejo, v_nuevo)
    where v_viejo = any(meseros.mesas);
  exception when undefined_column then null;
  end;

  begin
    update pedidos set mesa_numero = v_nuevo where mesa_id = p_mesa_id;
  exception when undefined_column then null;
  end;
end;
$$;

-- ============================================================================
-- RPC: reordenar mesas. Recibe los ids en el orden deseado y les asigna
-- orden = posición (0,1,2,…). Es el listado compartido que ve todo mesero; solo
-- el admin lo cambia (flechas ▲▼ en Ajustes → Mesas).
-- ============================================================================
create or replace function pos_reordenar_mesas(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mesas m
  set orden = pos.idx
  from (
    select unnest(p_ids) as id, generate_subscripts(p_ids, 1) - 1 as idx
  ) pos
  where m.id = pos.id;
end;
$$;

-- ============================================================================
-- RLS · solo en las tablas nuevas del POS. Las tablas de tali conservan SUS
-- políticas: el POS lee cuentas/cuenta_items/mesas con la anon key (como ya hace
-- tali) y escribe mediante las RPCs SECURITY DEFINER de arriba.
-- ============================================================================
alter table meseros enable row level security;
alter table pedidos enable row level security;

drop policy if exists "pos meseros total" on meseros;
create policy "pos meseros total" on meseros for all to anon, authenticated using (true) with check (true);

drop policy if exists "pos pedidos total" on pedidos;
create policy "pos pedidos total" on pedidos for all to anon, authenticated using (true) with check (true);

grant execute on function pos_enviar_orden(uuid, text, jsonb)         to anon, authenticated;
grant execute on function pos_editar_item_pedido(uuid, text, integer) to anon, authenticated;
grant execute on function pos_eliminar_item_pedido(uuid, text)        to anon, authenticated;
grant execute on function pos_cerrar_mesa(uuid)                       to anon, authenticated;
grant execute on function pos_crear_mesa(uuid, text, uuid)            to anon, authenticated;
grant execute on function pos_borrar_mesa(uuid)                       to anon, authenticated;
grant execute on function pos_renombrar_mesa(uuid, text)              to anon, authenticated;
grant execute on function pos_reordenar_mesas(uuid[])                 to anon, authenticated;

-- ============================================================================
-- Realtime · cuentas y cuenta_items ya están en la publicación de tali; solo
-- faltan las tablas nuevas y `mesas`.
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table pedidos;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table mesas;
exception when duplicate_object then null; end $$;
