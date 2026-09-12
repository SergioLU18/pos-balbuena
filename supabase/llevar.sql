-- ============================================================================
-- pos-balbuena · pedidos PARA LLEVAR (mostrador / teléfono)
-- ----------------------------------------------------------------------------
-- Una orden para llevar es como una cuenta de mesa, pero SIN mesa: se identifica
-- por el CLIENTE, al que se busca por teléfono. Por eso este archivo agrega dos
-- tablas propias del POS —`clientes` y `ordenes_llevar`— y un par de columnas a
-- `pedidos`, en vez de reutilizar `cuentas`/`cuenta_items`:
--
--   · `cuentas` es de tali y todo su flujo (dividir y pagar por QR en la mesa)
--     está anclado a una mesa. Una orden de mostrador se cobra en caja, no se
--     divide entre comensales, así que meterla ahí solo ensuciaría ese flujo.
--   · El total de una orden abierta se DERIVA de sus pedidos (pedidos.items ya
--     trae precio_unitario por renglón), así que no hace falta una tabla espejo
--     de renglones. Al cerrarla se congela ese cálculo en `total` +
--     `items_snapshot` — eso es lo que sostiene el historial de compras del
--     cliente aunque después se limpien los pedidos de cocina.
--
-- Cada restaurante tiene su propio padrón de clientes: la unicidad del teléfono
-- es por (restaurante_id, telefono), no global.
--
-- Orden de ejecución:  cleanup.sql → schema.sql → bitacora.sql → admin_menu.sql → llevar.sql → seed.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Padrón de clientes por restaurante ──────────────────────────────────────
-- `telefono` se guarda NORMALIZADO (solo dígitos) porque es la llave de búsqueda:
-- el mesero lo teclea en un teclado numérico y no debe importar si alguien lo dio
-- de alta con espacios o guiones. El formato bonito se arma al pintarlo.
create table if not exists clientes (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  telefono       text not null,
  nombre         text not null,
  direccion      text,
  nota           text,                              -- referencias de entrega, alergias, etc.
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists clientes_restaurante_telefono_idx
  on clientes (restaurante_id, telefono);

-- ── Orden para llevar ───────────────────────────────────────────────────────
-- Los datos del cliente van denormalizados (nombre/teléfono/dirección) además de
-- la FK: es la misma decisión que `pedidos.mesero_nombre` — si el cliente cambia
-- de dirección, las órdenes viejas deben seguir diciendo a dónde se mandaron.
--
-- `folio` es el número corto que el mesero canta en cocina ("la L-14"): un uuid no
-- sirve para eso. Es consecutivo POR restaurante y no se recicla.
create table if not exists ordenes_llevar (
  id               uuid primary key default gen_random_uuid(),
  restaurante_id   uuid references restaurantes(id) on delete cascade,
  folio            integer not null,
  cliente_id       uuid references clientes(id) on delete set null,
  cliente_nombre   text,
  cliente_telefono text,
  direccion        text,
  mesero_id        uuid references meseros(id) on delete set null,
  mesero_nombre    text,
  estado           text not null default 'abierta'
                   check (estado in ('abierta','entregada','cancelada')),
  -- total e items_snapshot se escriben SOLO al cerrar la orden. Mientras está
  -- abierta el total se deriva de sus pedidos, así que no hay dos fuentes de
  -- verdad que se puedan desincronizar al editar un renglón.
  total            numeric not null default 0,
  items_snapshot   jsonb,
  created_at       timestamptz not null default now(),
  closed_at        timestamptz
);
create unique index if not exists ordenes_llevar_folio_idx on ordenes_llevar (restaurante_id, folio);
create index if not exists ordenes_llevar_cliente_idx on ordenes_llevar (cliente_id);
create index if not exists ordenes_llevar_estado_idx  on ordenes_llevar (restaurante_id, estado);

-- ── pedidos: el mismo tablero de cocina, con o sin mesa ─────────────────────
-- `mesa_id` ya era nullable, así que un pedido para llevar simplemente no la trae.
-- `tipo` existe para no tener que deducirlo de un null: la tarjeta de cocina pinta
-- "Para llevar · Cliente" en lugar de "Mesa N", y eso debe ser una decisión
-- explícita del dato, no un efecto secundario de una columna vacía.
alter table pedidos add column if not exists tipo text not null default 'mesa';
alter table pedidos drop constraint if exists pedidos_tipo_check;
alter table pedidos add constraint pedidos_tipo_check check (tipo in ('mesa','llevar'));

alter table pedidos add column if not exists orden_llevar_id uuid references ordenes_llevar(id) on delete cascade;
alter table pedidos add column if not exists cliente_nombre  text;
create index if not exists pedidos_orden_llevar_idx on pedidos (orden_llevar_id);

-- ============================================================================
-- RPC: dar de alta / actualizar un cliente. Es un upsert por (restaurante,
-- teléfono) y no un insert simple porque dos meseros pueden estar dando de alta
-- al mismo cliente desde dos tablets a la vez: el segundo debe actualizar la
-- ficha, no tronar contra el índice único.
-- ============================================================================
drop function if exists pos_guardar_cliente(uuid, text, text, text, text);
create or replace function pos_guardar_cliente(
  p_restaurante_id uuid,
  p_telefono       text,
  p_nombre         text,
  p_direccion      text default null,
  p_nota           text default null,
  p_mesero_id      uuid default null,
  p_mesero_nombre  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  v_id    uuid;
  v_nueva boolean;
begin
  if v_tel = '' then
    raise exception 'El teléfono es obligatorio.';
  end if;
  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'El nombre es obligatorio.';
  end if;

  -- Se pregunta ANTES del upsert para poder distinguir alta de edición en la bitácora:
  -- después ya no hay cómo, el upsert devuelve el mismo id en los dos casos.
  select not exists(
    select 1 from clientes where restaurante_id = p_restaurante_id and telefono = v_tel
  ) into v_nueva;

  insert into clientes (restaurante_id, telefono, nombre, direccion, nota)
  values (p_restaurante_id, v_tel, btrim(p_nombre), nullif(btrim(p_direccion), ''), nullif(btrim(p_nota), ''))
  on conflict (restaurante_id, telefono) do update
    set nombre     = excluded.nombre,
        direccion  = excluded.direccion,
        nota       = excluded.nota,
        activo     = true,
        updated_at = now()
  returning id into v_id;

  perform pos_log(
    p_restaurante_id, p_mesero_id, p_mesero_nombre,
    'cliente.guardar', 'cliente', v_id, btrim(p_nombre),
    jsonb_build_object('alta', v_nueva, 'telefono', v_tel)
  );

  return v_id;
end;
$$;

-- ============================================================================
-- RPC: dar de baja a un cliente (borrado lógico, activo=false, mismo criterio
-- que pos_borrar_mesero). No se borra la fila: sus órdenes ya cerradas siguen
-- sosteniendo el historial de venta. Si tiene una orden para llevar ABIERTA se
-- bloquea, igual que "no se puede borrar una mesa con cuenta abierta".
-- ============================================================================
drop function if exists pos_desactivar_cliente(uuid);
create or replace function pos_desactivar_cliente(
  p_cliente_id    uuid,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest          uuid;
  v_nombre        text;
  v_tiene_abierta boolean;
begin
  select exists(
    select 1 from ordenes_llevar where cliente_id = p_cliente_id and estado = 'abierta'
  ) into v_tiene_abierta;
  if v_tiene_abierta then
    raise exception 'No se puede borrar un cliente con una orden para llevar abierta.';
  end if;

  select restaurante_id, nombre into v_rest, v_nombre from clientes where id = p_cliente_id;

  update clientes set activo = false, updated_at = now() where id = p_cliente_id;

  perform pos_log(
    v_rest, p_mesero_id, p_mesero_nombre,
    'cliente.baja', 'cliente', p_cliente_id, v_nombre, '{}'::jsonb
  );
end;
$$;

-- ============================================================================
-- RPC: abrir una orden para llevar para un cliente. Copia sus datos a la orden
-- (ver el comentario de la tabla) y le asigna el folio consecutivo del
-- restaurante. El lock sobre `restaurantes` serializa el cálculo del folio para
-- que dos tablets que abren orden al mismo tiempo no saquen el mismo número.
--
-- Devuelve la FILA completa y no solo el id porque el mesero navega a la orden en
-- ese mismo instante: con el id pelón, la pantalla de toma de orden se pintaría
-- vacía hasta que Realtime alcanzara a traer la fila.
-- ============================================================================
drop function if exists pos_crear_orden_llevar(uuid, uuid, uuid, text);
create or replace function pos_crear_orden_llevar(
  p_restaurante_id uuid,
  p_cliente_id     uuid,
  p_mesero_id      uuid default null,
  p_mesero_nombre  text default null
) returns ordenes_llevar
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente clientes%rowtype;
  v_folio   integer;
  v_orden   ordenes_llevar%rowtype;
begin
  select * into v_cliente from clientes where id = p_cliente_id;
  if not found then
    raise exception 'El cliente % no existe.', p_cliente_id;
  end if;

  perform 1 from restaurantes where id = p_restaurante_id for update;
  select coalesce(max(folio), 0) + 1 into v_folio
  from ordenes_llevar where restaurante_id = p_restaurante_id;

  insert into ordenes_llevar (
    restaurante_id, folio, cliente_id, cliente_nombre, cliente_telefono, direccion,
    mesero_id, mesero_nombre, estado
  ) values (
    p_restaurante_id, v_folio, v_cliente.id, v_cliente.nombre, v_cliente.telefono, v_cliente.direccion,
    p_mesero_id, p_mesero_nombre, 'abierta'
  ) returning * into v_orden;

  perform pos_log(
    p_restaurante_id, p_mesero_id, p_mesero_nombre,
    'llevar.crear', 'orden_llevar', v_orden.id, 'L-' || v_folio,
    jsonb_build_object('folio', v_folio, 'cliente', v_cliente.nombre, 'cliente_id', v_cliente.id)
  );

  return v_orden;
end;
$$;

-- ============================================================================
-- RPC: mandar a cocina los renglones de una orden para llevar. Es la contraparte
-- de pos_enviar_orden, sin la parte de mesa/cuenta: no hay cuenta que abrir ni
-- cuenta_items que agregar, solo la comanda de cocina. Devuelve el id del pedido.
-- ============================================================================
create or replace function pos_enviar_orden_llevar(
  p_orden_id      uuid,
  p_items         jsonb,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_llevar%rowtype;
  v_id    uuid;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    return null;
  end if;

  select * into v_orden from ordenes_llevar where id = p_orden_id;
  if not found then
    raise exception 'La orden para llevar % no existe.', p_orden_id;
  end if;
  if v_orden.estado <> 'abierta' then
    raise exception 'La orden para llevar ya está %; no se le pueden agregar platillos.', v_orden.estado;
  end if;

  insert into pedidos (
    restaurante_id, tipo, orden_llevar_id, cliente_nombre,
    mesero_id, mesero_nombre, items, estado, enviado_at
  ) values (
    v_orden.restaurante_id, 'llevar', v_orden.id, v_orden.cliente_nombre,
    p_mesero_id, p_mesero_nombre, p_items, 'pendiente', now()
  ) returning id into v_id;

  perform pos_log(
    v_orden.restaurante_id, p_mesero_id, p_mesero_nombre,
    'orden.enviar', 'orden_llevar', v_orden.id, 'L-' || v_orden.folio,
    jsonb_build_object(
      'pedido_id', v_id,
      'renglones', jsonb_array_length(p_items),
      'importe', (
        select coalesce(sum((r->>'precio_unitario')::numeric * (r->>'cantidad')::integer), 0)
        from jsonb_array_elements(p_items) as r
      ),
      'items', p_items
    )
  );

  return v_id;
end;
$$;

-- ============================================================================
-- RPC: cerrar una orden para llevar (se la llevó el cliente, o se canceló).
-- Congela en la fila el total y la copia de los renglones ANTES de borrar sus
-- pedidos: el historial de compras del cliente se lee de aquí, así que tiene que
-- sobrevivir a la limpieza del tablero de cocina.
-- ============================================================================
drop function if exists pos_cerrar_orden_llevar(uuid, text);
create or replace function pos_cerrar_orden_llevar(
  p_orden_id      uuid,
  p_estado        text default 'entregada',
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_total numeric;
  v_orden ordenes_llevar%rowtype;
begin
  if p_estado not in ('entregada','cancelada') then
    raise exception 'Estado de cierre inválido: %', p_estado;
  end if;

  -- Todos los renglones de todas las comandas de la orden, aplanados en un solo
  -- arreglo — la misma forma que consume el ticket del mesero.
  select coalesce(jsonb_agg(renglon), '[]'::jsonb) into v_items
  from pedidos p, jsonb_array_elements(p.items) as renglon
  where p.orden_llevar_id = p_orden_id;

  select coalesce(sum((renglon->>'precio_unitario')::numeric * (renglon->>'cantidad')::integer), 0)
  into v_total
  from jsonb_array_elements(v_items) as renglon;

  update ordenes_llevar
  set estado = p_estado, total = v_total, items_snapshot = v_items, closed_at = now()
  where id = p_orden_id
  returning * into v_orden;

  delete from pedidos where orden_llevar_id = p_orden_id;

  -- Cancelar es lo que de verdad se audita aquí: la orden se va del tablero y no deja
  -- venta. El estado va en el detalle para poder filtrar solo las canceladas.
  perform pos_log(
    v_orden.restaurante_id, p_mesero_id, p_mesero_nombre,
    'llevar.cerrar', 'orden_llevar', p_orden_id, 'L-' || v_orden.folio,
    jsonb_build_object(
      'estado',  p_estado,
      'total',   v_total,
      'cliente', v_orden.cliente_nombre,
      'items',   v_items
    )
  );
end;
$$;

-- ============================================================================
-- RLS · igual que el resto de las tablas nuevas del POS (ver schema.sql).
-- ============================================================================
alter table clientes       enable row level security;
alter table ordenes_llevar enable row level security;

-- Solo lectura, mismo criterio que schema.sql: las dos tablas ya solo se escriben por
-- las RPCs de arriba, que dejan su línea en la bitácora.
drop policy if exists "pos clientes total" on clientes;
drop policy if exists "pos clientes lectura" on clientes;
create policy "pos clientes lectura" on clientes for select to anon, authenticated using (true);

drop policy if exists "pos ordenes_llevar total" on ordenes_llevar;
drop policy if exists "pos ordenes_llevar lectura" on ordenes_llevar;
create policy "pos ordenes_llevar lectura" on ordenes_llevar for select to anon, authenticated using (true);

grant execute on function pos_guardar_cliente(uuid, text, text, text, text, uuid, text) to anon, authenticated;
grant execute on function pos_desactivar_cliente(uuid, uuid, text)                      to anon, authenticated;
grant execute on function pos_crear_orden_llevar(uuid, uuid, uuid, text)                to anon, authenticated;
grant execute on function pos_enviar_orden_llevar(uuid, jsonb, uuid, text)              to anon, authenticated;
grant execute on function pos_cerrar_orden_llevar(uuid, text, uuid, text)               to anon, authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table ordenes_llevar;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table clientes;
exception when duplicate_object then null; end $$;
