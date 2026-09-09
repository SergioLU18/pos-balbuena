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
-- Orden de ejecución:  cleanup.sql → schema.sql → admin_menu.sql → llevar.sql → seed.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Meseros (tali no tiene este concepto) ───────────────────────────────────
-- Qué mesas atiende cada quien NO vive aquí: vive en mesa_meseros (ver abajo).
create table if not exists meseros (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  nombre         text not null,
  pin            text,                            -- PIN de 4 dígitos para cambiar de mesero
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ── Quién atiende qué mesa ──────────────────────────────────────────────────
-- Una mesa puede tener VARIOS meseros: dos que se reparten el salón, o uno que le
-- cubre la mesa a otro que anda ocupado. Por eso es una tabla de unión y no una
-- columna — la relación es muchos-a-muchos y se consulta desde los dos lados: las
-- mesas de un mesero (filtro "solo mis mesas") y los meseros de una mesa (tarjeta
-- del piso). El PEDIDO sí tiene un solo mesero: el que lo mandó (pedidos.mesero_id).
--
-- Antes esto era `meseros.mesas text[]`, un arreglo de NÚMEROS de mesa. Se cambió a
-- (mesa_id, mesero_id) reales porque el número es editable y reciclable: renombrar
-- una mesa reasignaba en silencio la asignación de la que tuviera ese número.
create table if not exists mesa_meseros (
  mesa_id    uuid not null references mesas(id)   on delete cascade,
  mesero_id  uuid not null references meseros(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mesa_id, mesero_id)
);
create index if not exists mesa_meseros_mesero_idx on mesa_meseros (mesero_id);

-- Migración desde el modelo viejo: vuelca `meseros.mesas` (números) a filas reales y
-- tira la columna. Va dentro del if para que reaplicar schema.sql sobre una base YA
-- migrada no truene por la columna que ya no existe.
do $migra$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meseros' and column_name = 'mesas'
  ) then
    insert into mesa_meseros (mesa_id, mesero_id)
    select m.id, w.id
    from meseros w
    cross join lateral unnest(w.mesas) as viejas(numero)
    -- m.activo: el número de mesa es reciclable, así que puede haber una mesa dada de
    -- baja y otra viva con el MISMO número (pasó con "PL-1"). Sin este filtro el
    -- volcado le colgaba al mesero también la mesa muerta. Es justo la fragilidad del
    -- modelo viejo — por eso de aquí en adelante la relación va por id.
    join mesas m on m.numero = viejas.numero
                and m.restaurante_id = w.restaurante_id
                and m.activo
    on conflict do nothing;

    alter table meseros drop column mesas;
  end if;
end $migra$;

-- ── Pedidos de cocina (tali no tiene cocina) ────────────────────────────────
-- items guarda la orden COMPLETA (tier, mitades, ingredientes, nota) para la
-- pantalla de cocina. Los renglones facturables planos viven en cuenta_items.
create table if not exists pedidos (
  id                    uuid primary key default gen_random_uuid(),
  restaurante_id        uuid references restaurantes(id) on delete cascade,
  mesa_id               uuid references mesas(id) on delete cascade,
  cuenta_id             uuid references cuentas(id) on delete set null,
  mesa_numero           text,
  mesero_id             uuid references meseros(id) on delete set null,
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
-- mesero_id se agregó cuando una mesa pasó a poder tener VARIOS meseros: para saber a
-- quién avisarle que su platillo está listo ya no basta con la mesa (ahí hay varios),
-- hace falta el mesero exacto que mandó ese pedido. `mesero_nombre` se queda a
-- propósito: es la copia denormalizada que mantiene legible el historial cuando un
-- mesero se da de baja (la FK se pone en null y el nombre sobrevive).
alter table pedidos add column if not exists mesero_id uuid references meseros(id) on delete set null;
create index if not exists pedidos_mesero_idx on pedidos (mesero_id);

-- Backfill por nombre de los pedidos creados antes de que existiera la FK. Solo toca
-- filas con mesero_id nulo, así que reaplicar schema.sql no pisa nada.
update pedidos p
set mesero_id = (
  select w.id from meseros w
  where w.nombre = p.mesero_nombre and w.restaurante_id = p.restaurante_id
  order by w.activo desc, w.created_at
  limit 1
)
where p.mesero_id is null and p.mesero_nombre is not null;

alter table pedidos add column if not exists preparando_at timestamptz;
alter table pedidos add column if not exists listo_at      timestamptz;
alter table pedidos add column if not exists entregado_at  timestamptz;

-- ============================================================================
-- RPC: enviar orden. Abre la cuenta de la mesa si no hay una activa, agrega los
-- renglones con las MISMAS funciones que usa tali, recalcula el subtotal y crea
-- el pedido de cocina. Devuelve el id de la cuenta.
-- Cada elemento de p_items debe traer: nombre, precio_unitario, cantidad
-- (más el resto de la estructura rica, que se guarda tal cual en pedidos.items).
--
-- Además da de alta al mesero como uno de los que atienden la mesa: en la práctica
-- quien toma la orden ES quien la atiende, y esperar a que un admin lo asigne a mano
-- dejaba al mesero sin sus propias mesas en el filtro y sin campana de "listo".
-- ============================================================================
drop function if exists pos_enviar_orden(uuid, text, jsonb);
create or replace function pos_enviar_orden(
  p_mesa_id       uuid,
  p_mesero_nombre text,
  p_items         jsonb,
  p_mesero_id     uuid default null
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

  -- Quien manda una orden queda atendiendo la mesa. on conflict do nothing porque a
  -- partir de la segunda orden ya está en la lista, y porque dos meseros pueden estar
  -- mandando a la misma mesa al mismo tiempo desde dos tablets.
  if p_mesero_id is not null then
    insert into mesa_meseros (mesa_id, mesero_id)
    values (p_mesa_id, p_mesero_id)
    on conflict do nothing;
  end if;

  insert into pedidos (restaurante_id, mesa_id, cuenta_id, mesa_numero, mesero_id, mesero_nombre, items, estado, enviado_at)
  values (v_rest, p_mesa_id, v_cuenta, v_numero, p_mesero_id, p_mesero_nombre, p_items, 'pendiente', now());

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

-- ============================================================================
-- RPC: crear mesa. Se usa desde el modo "Mover mesas" del mapa del piso. Acepta
-- VARIOS meseros (p_mesero_ids) porque una mesa se puede repartir entre más de uno
-- desde el momento en que se crea.
-- ============================================================================
drop function if exists pos_crear_mesa(uuid, text, uuid);
create or replace function pos_crear_mesa(
  p_restaurante_id uuid,
  p_numero         text,
  p_mesero_ids     uuid[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa uuid;
begin
  insert into mesas (numero, restaurante_id, activo)
  values (p_numero, p_restaurante_id, true)
  returning id into v_mesa;

  insert into mesa_meseros (mesa_id, mesero_id)
  select v_mesa, elegidos.mesero_id
  from unnest(coalesce(p_mesero_ids, '{}'::uuid[])) as elegidos(mesero_id)
  on conflict do nothing;

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
  v_tiene_cuenta  boolean;
begin
  select exists(select 1 from cuentas where mesa_id = p_mesa_id and activa) into v_tiene_cuenta;
  if v_tiene_cuenta then
    raise exception 'No se puede borrar una mesa con cuenta abierta.';
  end if;

  update mesas set activo = false where id = p_mesa_id;

  -- La baja es lógica (activo=false), así que el on delete cascade de mesa_meseros
  -- no dispara: hay que soltar a mano a los meseros que la atendían.
  delete from mesa_meseros where mesa_id = p_mesa_id;
end;
$$;

-- ============================================================================
-- RPC: fijar las mesas que atiende un mesero (panel de admin). Recibe el conjunto
-- COMPLETO y lo deja idéntico — borra las que ya no están y agrega las nuevas — en
-- una sola transacción, para que el mesero nunca quede a medias entre dos listas si
-- la tablet pierde la red a mitad del guardado.
--
-- Solo toca las filas de ESTE mesero: las de los demás meseros de esas mismas mesas
-- se quedan como están, que es justo lo que permite que una mesa tenga varios.
-- ============================================================================
create or replace function pos_set_mesas_mesero(
  p_mesero_id uuid,
  p_mesa_ids  uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from mesa_meseros
  where mesero_id = p_mesero_id
    and not (mesa_id = any(coalesce(p_mesa_ids, '{}'::uuid[])));

  insert into mesa_meseros (mesa_id, mesero_id)
  select elegidas.mesa_id, p_mesero_id
  from unnest(coalesce(p_mesa_ids, '{}'::uuid[])) as elegidas(mesa_id)
  on conflict do nothing;
end;
$$;

-- ============================================================================
-- RPC: dar de baja a un mesero. La baja es lógica (activo=false) para no perder la
-- referencia en los pedidos históricos, y de paso lo suelta de todas sus mesas: un
-- mesero que ya no está en el turno no puede seguir figurando como quien las atiende.
-- Las dos cosas van juntas en una transacción para que no quede a medias.
-- ============================================================================
create or replace function pos_borrar_mesero(p_mesero_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update meseros set activo = false where id = p_mesero_id;
  delete from mesa_meseros where mesero_id = p_mesero_id;
end;
$$;

-- ============================================================================
-- RLS · solo en las tablas nuevas del POS. Las tablas de tali conservan SUS
-- políticas: el POS lee cuentas/cuenta_items/mesas con la anon key (como ya hace
-- tali) y escribe mediante las RPCs SECURITY DEFINER de arriba.
-- ============================================================================
alter table meseros enable row level security;
alter table mesa_meseros enable row level security;
alter table pedidos enable row level security;

drop policy if exists "pos meseros total" on meseros;
create policy "pos meseros total" on meseros for all to anon, authenticated using (true) with check (true);

drop policy if exists "pos mesa_meseros total" on mesa_meseros;
create policy "pos mesa_meseros total" on mesa_meseros for all to anon, authenticated using (true) with check (true);

drop policy if exists "pos pedidos total" on pedidos;
create policy "pos pedidos total" on pedidos for all to anon, authenticated using (true) with check (true);

grant execute on function pos_enviar_orden(uuid, text, jsonb, uuid)   to anon, authenticated;
grant execute on function pos_editar_item_pedido(uuid, text, integer) to anon, authenticated;
grant execute on function pos_eliminar_item_pedido(uuid, text)        to anon, authenticated;
grant execute on function pos_cerrar_mesa(uuid)                       to anon, authenticated;
grant execute on function pos_crear_mesa(uuid, text, uuid[])          to anon, authenticated;
grant execute on function pos_borrar_mesa(uuid)                       to anon, authenticated;
grant execute on function pos_set_mesas_mesero(uuid, uuid[])          to anon, authenticated;
grant execute on function pos_borrar_mesero(uuid)                     to anon, authenticated;

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
do $$ begin
  alter publication supabase_realtime add table mesa_meseros;
exception when duplicate_object then null; end $$;
