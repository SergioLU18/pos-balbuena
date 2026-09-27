-- ============================================================================
-- pos-balbuena · PAGAR / RECOGER una orden para llevar
-- ----------------------------------------------------------------------------
-- Antes, "Entregar y cerrar" hacía dos cosas a la vez: cobrar y confirmar que el
-- cliente se la llevó. En el mostrador eso casi siempre son dos momentos distintos
-- (se cobra al tomar la orden o cuando está lista; se recoge después, a veces minutos
-- después) y no se registraba CÓMO se pagó. Ahora son dos pasos:
--
--   abierta → pagada    (pos_pagar_orden_llevar)   — cobra y congela renglones/total.
--                                                     YA NO se le pueden agregar
--                                                     platillos (si falta algo, es un
--                                                     pedido nuevo) pero sus comandas
--                                                     siguen en el tablero de cocina.
--   pagada  → entregada (pos_recoger_orden_llevar) — el cliente se la llevó: cierra y
--                                                     por fin limpia sus comandas.
--   abierta|pagada → cancelada (pos_cerrar_orden_llevar, sin el parámetro p_estado
--                                que ya no hace falta — cancelar es lo único que
--                                sigue haciendo).
--
-- Corre DESPUÉS de llevar.sql y llevar_descartar.sql. Idempotente: se puede volver a
-- correr.
-- ============================================================================

alter table ordenes_llevar add column if not exists metodo_pago text;

alter table ordenes_llevar drop constraint if exists ordenes_llevar_estado_check;
alter table ordenes_llevar add constraint ordenes_llevar_estado_check
  check (estado in ('abierta','pagada','entregada','cancelada'));

-- ============================================================================
-- RPC: cobrar una orden para llevar. Congela renglones y total (igual que el cierre
-- de antes) y guarda el método de pago — pero NO borra sus comandas: cocina las sigue
-- necesitando hasta que se recoja.
-- ============================================================================
create or replace function pos_pagar_orden_llevar(
  p_orden_id       uuid,
  p_metodo_pago    text,
  -- Solo llegan con p_metodo_pago = 'ambos' (mismo criterio que pos_cerrar_mesa): cuánto
  -- se cobró en efectivo y cuánto con tarjeta. No hay columna propia para esto — se
  -- registran en la bitácora.
  p_monto_efectivo numeric default null,
  p_monto_tarjeta  numeric default null,
  p_mesero_id      uuid    default null,
  p_mesero_nombre  text    default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_llevar%rowtype;
  v_items jsonb;
  v_total numeric;
begin
  if p_metodo_pago not in ('efectivo','tarjeta','ambos') then
    raise exception 'Método de pago inválido: %', p_metodo_pago;
  end if;

  select * into v_orden from ordenes_llevar where id = p_orden_id for update;
  if not found then
    raise exception 'La orden % no existe.', p_orden_id;
  end if;
  if v_orden.estado <> 'abierta' then
    raise exception 'La orden ya está %; no se puede cobrar.', v_orden.estado;
  end if;
  if pos_renglones_orden_llevar(p_orden_id) = 0 then
    raise exception 'La orden L-% no tiene platillos que cobrar.', v_orden.folio;
  end if;

  select coalesce(jsonb_agg(renglon), '[]'::jsonb) into v_items
  from pedidos p, jsonb_array_elements(p.items) as renglon
  where p.orden_llevar_id = p_orden_id;

  select coalesce(sum((renglon->>'precio_unitario')::numeric * (renglon->>'cantidad')::integer), 0)
  into v_total
  from jsonb_array_elements(v_items) as renglon;

  update ordenes_llevar
  set estado = 'pagada', total = v_total, items_snapshot = v_items, metodo_pago = p_metodo_pago
  where id = p_orden_id;

  perform pos_log(
    v_orden.restaurante_id, p_mesero_id, p_mesero_nombre,
    'llevar.pagar', 'orden_llevar', p_orden_id, 'L-' || v_orden.folio,
    jsonb_build_object(
      'metodo_pago',    p_metodo_pago,
      'monto_efectivo', p_monto_efectivo,
      'monto_tarjeta',  p_monto_tarjeta,
      'total',          v_total,
      'cliente',        v_orden.cliente_nombre,
      'items',          v_items
    )
  );
end;
$$;

-- ============================================================================
-- RPC: recoger una orden ya pagada. Los renglones y el total ya quedaron congelados
-- al cobrar, así que aquí solo cierra la fila y por fin limpia sus comandas.
-- ============================================================================
create or replace function pos_recoger_orden_llevar(
  p_orden_id      uuid,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_llevar%rowtype;
begin
  select * into v_orden from ordenes_llevar where id = p_orden_id for update;
  if not found then
    raise exception 'La orden % no existe.', p_orden_id;
  end if;
  if v_orden.estado <> 'pagada' then
    raise exception 'La orden debe estar pagada antes de recogerse (estado actual: %).', v_orden.estado;
  end if;

  update ordenes_llevar set estado = 'entregada', closed_at = now() where id = p_orden_id;
  delete from pedidos where orden_llevar_id = p_orden_id;

  perform pos_log(
    v_orden.restaurante_id, p_mesero_id, p_mesero_nombre,
    'llevar.recoger', 'orden_llevar', p_orden_id, 'L-' || v_orden.folio,
    jsonb_build_object('total', v_orden.total, 'cliente', v_orden.cliente_nombre)
  );
end;
$$;

-- ============================================================================
-- RPC: cancelar una orden para llevar, desde 'abierta' O 'pagada' — reemplaza la
-- versión de llevar.sql (que también hacía de "entregar", ahora en
-- pos_recoger_orden_llevar). Sigue congelando renglones/total y limpiando cocina.
-- ============================================================================
drop function if exists pos_cerrar_orden_llevar(uuid, text, uuid, text);
create or replace function pos_cerrar_orden_llevar(
  p_orden_id      uuid,
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
  select * into v_orden from ordenes_llevar where id = p_orden_id for update;
  if not found then
    raise exception 'La orden % no existe.', p_orden_id;
  end if;
  if v_orden.estado not in ('abierta','pagada') then
    raise exception 'La orden ya está %; no se puede cancelar.', v_orden.estado;
  end if;

  select coalesce(jsonb_agg(renglon), '[]'::jsonb) into v_items
  from pedidos p, jsonb_array_elements(p.items) as renglon
  where p.orden_llevar_id = p_orden_id;

  select coalesce(sum((renglon->>'precio_unitario')::numeric * (renglon->>'cantidad')::integer), 0)
  into v_total
  from jsonb_array_elements(v_items) as renglon;

  update ordenes_llevar
  set estado = 'cancelada', total = v_total, items_snapshot = v_items, closed_at = now()
  where id = p_orden_id;

  delete from pedidos where orden_llevar_id = p_orden_id;

  perform pos_log(
    v_orden.restaurante_id, p_mesero_id, p_mesero_nombre,
    'llevar.cerrar', 'orden_llevar', p_orden_id, 'L-' || v_orden.folio,
    jsonb_build_object(
      'estado',  'cancelada',
      'total',   v_total,
      'cliente', v_orden.cliente_nombre,
      'items',   v_items
    )
  );
end;
$$;

-- ============================================================================
-- Bloquear edición tras cobrar: pos_editar_item_pedido / pos_eliminar_item_pedido
-- (schema.sql) solo validaban el estado de la COMANDA ('pendiente'), no el de la
-- orden. Una comanda para llevar puede seguir 'pendiente' (cocina no la ha
-- empezado) después de cobrada, así que sin este candado se le podían seguir
-- moviendo renglones a una orden ya pagada. Mismas firmas que schema.sql — el
-- grant de allá sigue aplicando.
-- ============================================================================
create or replace function pos_editar_item_pedido(
  p_pedido_id     uuid,
  p_item_id       text,
  p_cantidad      integer,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido       pedidos%rowtype;
  v_idx          int;
  v_item         jsonb;
  v_delta        integer;
  v_orden_estado text;
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
  if v_pedido.orden_llevar_id is not null then
    select estado into v_orden_estado from ordenes_llevar where id = v_pedido.orden_llevar_id;
    if v_orden_estado <> 'abierta' then
      raise exception 'La orden para llevar ya está %; no se le pueden editar platillos.', v_orden_estado;
    end if;
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

  perform pos_log(
    v_pedido.restaurante_id, p_mesero_id, p_mesero_nombre,
    'item.editar', 'pedido', p_pedido_id,
    coalesce(v_pedido.mesa_numero, v_pedido.cliente_nombre),
    jsonb_build_object(
      'platillo',  v_item->>'nombre',
      'de',        (v_item->>'cantidad')::integer,
      'a',         p_cantidad,
      'delta',     v_delta,
      'tipo',      v_pedido.tipo,
      'cuenta_id', v_pedido.cuenta_id,
      'item',      v_item
    )
  );
end;
$$;

create or replace function pos_eliminar_item_pedido(
  p_pedido_id     uuid,
  p_item_id       text,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido       pedidos%rowtype;
  v_item         jsonb;
  v_items_nuevo  jsonb;
  v_orden_estado text;
begin
  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido % no existe.', p_pedido_id;
  end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'El pedido ya no está en Nuevo (estado actual: %) — no se puede eliminar.', v_pedido.estado;
  end if;
  if v_pedido.orden_llevar_id is not null then
    select estado into v_orden_estado from ordenes_llevar where id = v_pedido.orden_llevar_id;
    if v_orden_estado <> 'abierta' then
      raise exception 'La orden para llevar ya está %; no se le pueden quitar platillos.', v_orden_estado;
    end if;
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

  perform pos_log(
    v_pedido.restaurante_id, p_mesero_id, p_mesero_nombre,
    'item.eliminar', 'pedido', p_pedido_id,
    coalesce(v_pedido.mesa_numero, v_pedido.cliente_nombre),
    jsonb_build_object(
      'platillo',      v_item->>'nombre',
      'cantidad',      (v_item->>'cantidad')::integer,
      'importe',       (v_item->>'precio_unitario')::numeric * (v_item->>'cantidad')::integer,
      'tipo',          v_pedido.tipo,
      'cuenta_id',     v_pedido.cuenta_id,
      'comanda_vacia', jsonb_array_length(v_items_nuevo) = 0,
      'item',          v_item
    )
  );
end;
$$;

-- ============================================================================
-- pos_desactivar_cliente: una orden 'pagada' (con platillos, por definición) también
-- debe bloquear la baja del cliente — antes solo se veía 'abierta'.
-- ============================================================================
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
  v_rest   uuid;
  v_nombre text;
  v_orden  uuid;
begin
  if exists (
    select 1 from ordenes_llevar
    where cliente_id = p_cliente_id and estado in ('abierta','pagada')
      and pos_renglones_orden_llevar(id) > 0
  ) then
    raise exception 'No se puede borrar un cliente con una orden para llevar abierta.';
  end if;

  for v_orden in
    select id from ordenes_llevar where cliente_id = p_cliente_id and estado = 'abierta'
  loop
    perform pos_descartar_orden_llevar(v_orden, p_mesero_id, p_mesero_nombre);
  end loop;

  select restaurante_id, nombre || ' ' || apellidos into v_rest, v_nombre from clientes where id = p_cliente_id;

  update clientes set activo = false, updated_at = now() where id = p_cliente_id;

  perform pos_log(
    v_rest, p_mesero_id, p_mesero_nombre,
    'cliente.baja', 'cliente', p_cliente_id, v_nombre, '{}'::jsonb
  );
end;
$$;

grant execute on function pos_pagar_orden_llevar(uuid, text, numeric, numeric, uuid, text) to anon, authenticated;
grant execute on function pos_recoger_orden_llevar(uuid, uuid, text)                      to anon, authenticated;
grant execute on function pos_cerrar_orden_llevar(uuid, uuid, text)                       to anon, authenticated;
