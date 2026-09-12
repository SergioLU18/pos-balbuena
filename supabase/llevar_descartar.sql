-- ============================================================================
-- pos-balbuena · DESCARTAR órdenes para llevar vacías
-- ----------------------------------------------------------------------------
-- Una orden para llevar se crea en cuanto el mesero pica "Nueva orden" — antes de
-- tener un solo platillo. Si se salía sin mandar nada a cocina, la orden quedaba
-- abierta para siempre ("Sin platillos · $0.00") y además bloqueaba la baja del
-- cliente. Cancelarla tampoco era la respuesta: dejaba una cancelada de $0 en su
-- historial y en la bitácora, por algo que en realidad nunca existió.
--
-- Descartar = BORRAR la fila, y solo si no tiene renglones en cocina. El folio
-- queda saltado (no se recicla, ver llevar.sql) y eso está bien.
--
-- Corre DESPUÉS de llevar.sql. Idempotente: se puede volver a correr.
-- ============================================================================

-- Renglones que la orden tiene en cocina. Si se mandaron platillos y luego se
-- quitaron todos, la comanda puede seguir existiendo con `items` vacío: eso cuenta
-- como vacía — lo que se quitó ya quedó en la bitácora (item.eliminar).
create or replace function pos_renglones_orden_llevar(p_orden_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(jsonb_array_length(coalesce(items, '[]'::jsonb))), 0)::integer
  from pedidos where orden_llevar_id = p_orden_id;
$$;

-- ============================================================================
-- RPC: descartar una orden para llevar que nunca llegó a cocina. Devuelve false
-- (sin error) si la orden ya no existe o ya se cerró: otra tablet se adelantó y
-- no hay nada que hacer.
-- ============================================================================
create or replace function pos_descartar_orden_llevar(
  p_orden_id      uuid,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_llevar%rowtype;
begin
  -- FOR UPDATE serializa contra un pos_enviar_orden_llevar simultáneo desde otra
  -- tablet (su insert en pedidos toma un lock de llave sobre esta fila): si el envío
  -- ganó, abajo se ven sus renglones y no se descarta; si ganamos nosotros, su
  -- insert truena por la FK y el mesero ve "no se envió la orden".
  select * into v_orden from ordenes_llevar where id = p_orden_id for update;
  if not found or v_orden.estado <> 'abierta' then
    return false;
  end if;

  if pos_renglones_orden_llevar(p_orden_id) > 0 then
    raise exception 'La orden L-% ya tiene platillos en cocina; ciérrala o cancélala.', v_orden.folio;
  end if;

  -- Sus comandas vacías, si quedó alguna, se van por el "on delete cascade".
  delete from ordenes_llevar where id = p_orden_id;

  perform pos_log(
    v_orden.restaurante_id, p_mesero_id, p_mesero_nombre,
    'llevar.descartar', 'orden_llevar', p_orden_id, 'L-' || v_orden.folio,
    jsonb_build_object('folio', v_orden.folio, 'cliente', v_orden.cliente_nombre, 'cliente_id', v_orden.cliente_id)
  );

  return true;
end;
$$;

-- ============================================================================
-- RPC: dar de baja a un cliente — reemplaza la versión de llevar.sql. Antes lo
-- bloqueaba CUALQUIER orden abierta; ahora solo una con platillos (esa sí es una
-- venta en curso). Las vacías se descartan en el camino y quedan en la bitácora
-- como llevar.descartar. Si entre el chequeo y el descarte otra tablet le manda
-- platillos a una, pos_descartar_orden_llevar truena y la baja entera se revierte.
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
    where cliente_id = p_cliente_id and estado = 'abierta'
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

grant execute on function pos_descartar_orden_llevar(uuid, uuid, text) to anon, authenticated;
grant execute on function pos_desactivar_cliente(uuid, uuid, text)     to anon, authenticated;
