-- ============================================================================
-- pos-balbuena · Cobrar una orden para llevar, con método de pago
-- ----------------------------------------------------------------------------
-- Solo dos estados para una orden en curso, igual que en el piso de mesas: "Enviado
-- a Cocina" (abierta, verde) y "Pagado y Entregado" (entregada, rosa). Cobrar y
-- entregar siguen siendo el MISMO momento y el mismo botón que ya hacía
-- pos_cerrar_orden_llevar(estado='entregada') en llevar.sql — lo único que cambia es
-- que ahora también se registra CON QUÉ se pagó. Cancelar (la otra rama de
-- pos_cerrar_orden_llevar) solo suma que, si ya hay comida en cocina, lo autorice un
-- admin (p_autoriza_id; ver pos_admin_autoriza en schema.sql).
--
-- Corre DESPUÉS de llevar.sql y llevar_descartar.sql. Idempotente: se puede volver a
-- correr, sin importar si ya se corrió una versión anterior de este mismo archivo
-- (la que separaba "pagada" de "entregada" en dos pasos — se colapsa de vuelta a uno).
-- ============================================================================

alter table ordenes_llevar add column if not exists metodo_pago text;

-- Restaura pos_cerrar_orden_llevar a su forma original de llevar.sql (p_orden_id,
-- p_estado, p_mesero_id, p_mesero_nombre) por si esta base ya tenía la versión de 3
-- parámetros de una corrida anterior de este archivo — esa versión ya no calza con lo
-- que manda el frontend (que vuelve a pasar p_estado='cancelada' explícito).
--
-- p_autoriza_id: cancelar una orden que ya mandó comida a cocina es cancelar esa
-- comida, y eso lo autoriza siempre un admin (ver pos_admin_autoriza en schema.sql).
-- La versión de 4 parámetros se tira para no dejar un overload ambiguo.
drop function if exists pos_cerrar_orden_llevar(uuid, uuid, text);
drop function if exists pos_cerrar_orden_llevar(uuid, text);
drop function if exists pos_cerrar_orden_llevar(uuid, text, uuid, text);
create or replace function pos_cerrar_orden_llevar(
  p_orden_id      uuid,
  p_estado        text default 'entregada',
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null,
  p_autoriza_id   uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items    jsonb;
  v_total    numeric;
  v_orden    ordenes_llevar%rowtype;
  v_autoriza text;
begin
  if p_estado not in ('entregada','cancelada') then
    raise exception 'Estado de cierre inválido: %', p_estado;
  end if;

  if p_estado = 'cancelada' and exists (select 1 from pedidos where orden_llevar_id = p_orden_id) then
    v_autoriza := pos_admin_autoriza(
      (select restaurante_id from ordenes_llevar where id = p_orden_id),
      p_autoriza_id
    );
  end if;

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

  perform pos_log(
    v_orden.restaurante_id, p_mesero_id, p_mesero_nombre,
    'llevar.cerrar', 'orden_llevar', p_orden_id, 'L-' || v_orden.folio,
    jsonb_build_object(
      'estado',      p_estado,
      'total',       v_total,
      'cliente',     v_orden.cliente_nombre,
      'autorizo_id', case when v_autoriza is not null then p_autoriza_id end,
      'autorizo',    v_autoriza,
      'items',       v_items
    )
  );
end;
$$;

grant execute on function pos_cerrar_orden_llevar(uuid, text, uuid, text, uuid) to anon, authenticated;

-- Ya no se usa (el paso de "recoger" se fusionó de vuelta con "pagar"): se limpia solo si
-- esta base la llegó a tener.
drop function if exists pos_recoger_orden_llevar(uuid, uuid, text);

-- ============================================================================
-- RPC: cobra y entrega una orden para llevar en un solo paso. Congela renglones y
-- total (igual que pos_cerrar_orden_llevar con estado='entregada'), guarda el
-- método de pago y limpia sus comandas de cocina.
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

  -- Todos los renglones de todas las comandas de la orden, aplanados — mismo cálculo
  -- que pos_cerrar_orden_llevar.
  select coalesce(jsonb_agg(renglon), '[]'::jsonb) into v_items
  from pedidos p, jsonb_array_elements(p.items) as renglon
  where p.orden_llevar_id = p_orden_id;

  select coalesce(sum((renglon->>'precio_unitario')::numeric * (renglon->>'cantidad')::integer), 0)
  into v_total
  from jsonb_array_elements(v_items) as renglon;

  update ordenes_llevar
  set estado = 'entregada', total = v_total, items_snapshot = v_items,
      metodo_pago = p_metodo_pago, closed_at = now()
  where id = p_orden_id;

  delete from pedidos where orden_llevar_id = p_orden_id;

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

grant execute on function pos_pagar_orden_llevar(uuid, text, numeric, numeric, uuid, text) to anon, authenticated;
