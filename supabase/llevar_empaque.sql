-- ============================================================================
-- pos-balbuena · Empaque de los platillos para llevar
-- ----------------------------------------------------------------------------
-- Para llevar, cada platillo (por pieza, bebidas incluidas) va en desechable y se cobra
-- $5 de más por el plástico; si el cliente trae su tupper, se le descuentan $5 del
-- precio del menú.
--
-- No hay columna nueva: el empaque vive en el renglón (pedidos.items[*]) como
--   empaque        'plastico' | 'tupper'
--   ajusteEmpaque  +5 | -5   (con signo; ya sumado en precio_unitario)
-- El frontend lo arma al capturar (lib/empaque.js) y lo mete en precio_unitario al
-- enviar a cocina, igual que el precio de un extra. Por eso pos_pagar_orden_llevar,
-- el cierre del día, las estadísticas y el historial del cliente no cambian: suman
-- precio_unitario × cantidad y el ajuste ya va adentro. Si algún día se quiere separar
-- cuánto entró por empaque, sale de items_snapshot (ajusteEmpaque × cantidad).
--
-- Lo único que necesita el servidor es cambiar el empaque de un renglón YA enviado
-- (p. ej. el cliente llega con su tupper a recoger).
--
-- Corre DESPUÉS de llevar.sql y bitacora.sql. Idempotente.
-- ============================================================================

-- ============================================================================
-- RPC: cambia el empaque de un renglón ya enviado de una orden para llevar.
--
-- A diferencia de pos_editar_item_pedido, NO exige que la comanda siga en 'pendiente':
-- el empaque no cambia qué se cocina, solo cuánto se cobra, así que vale mientras la
-- orden siga abierta (al cobrarla sus comandas se borran, así que "el pedido existe"
-- ya implica "la orden no se ha cobrado").
--
-- El precio lo recalcula el servidor a partir del que ya tenía el renglón: le quita el
-- ajuste viejo y le pone el nuevo. El nombre (que describe el empaque, ver nombreItem)
-- lo manda el cliente, igual que al enviar la orden.
-- ============================================================================
create or replace function pos_empaque_item_llevar(
  p_pedido_id     uuid,
  p_item_id       text,
  p_empaque       text,
  p_ajuste        numeric,
  p_nombre        text,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido      pedidos%rowtype;
  v_idx         int;
  v_item        jsonb;
  v_ajuste_ant  numeric;
  v_precio      numeric;
begin
  if p_empaque not in ('plastico','tupper') then
    raise exception 'Empaque inválido: %', p_empaque;
  end if;
  -- El signo es parte del dato: desechable suma, tupper descuenta.
  if (p_empaque = 'plastico' and p_ajuste < 0) or (p_empaque = 'tupper' and p_ajuste > 0) then
    raise exception 'El ajuste % no corresponde al empaque %.', p_ajuste, p_empaque;
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido % no existe (¿la orden ya se cobró?).', p_pedido_id;
  end if;
  if v_pedido.tipo <> 'llevar' then
    raise exception 'El empaque solo aplica a pedidos para llevar.';
  end if;

  select ord - 1, value into v_idx, v_item
  from jsonb_array_elements(v_pedido.items) with ordinality as t(value, ord)
  where value->>'id' = p_item_id;

  if v_idx is null then
    raise exception 'Renglón % no existe en el pedido.', p_item_id;
  end if;
  -- Solo pasa con renglones enviados antes de que existiera el empaque.
  if v_item->>'empaque' is null then
    raise exception 'Este renglón no trae empaque.';
  end if;
  if v_item->>'empaque' = p_empaque then
    return;
  end if;

  v_ajuste_ant := coalesce((v_item->>'ajusteEmpaque')::numeric, 0);
  v_precio     := (v_item->>'precio_unitario')::numeric - v_ajuste_ant + p_ajuste;

  update pedidos
  set items = jsonb_set(
    items, array[v_idx::text],
    v_item || jsonb_build_object(
      'empaque',         p_empaque,
      'ajusteEmpaque',   p_ajuste,
      'nombre',          coalesce(p_nombre, v_item->>'nombre'),
      'precio_unitario', v_precio
    )
  )
  where id = p_pedido_id;

  perform pos_log(
    v_pedido.restaurante_id, p_mesero_id, p_mesero_nombre,
    'item.empaque', 'pedido', p_pedido_id, v_pedido.cliente_nombre,
    jsonb_build_object(
      'platillo', v_item->>'platilloNombre',
      'de',       v_item->>'empaque',
      'a',        p_empaque,
      -- Cuánto cambió lo que se va a cobrar (negativo si bajó).
      'importe',  (p_ajuste - v_ajuste_ant) * (v_item->>'cantidad')::integer,
      'tipo',     v_pedido.tipo,
      'item',     v_item
    )
  );
end;
$$;

grant execute on function pos_empaque_item_llevar(uuid, text, text, numeric, text, uuid, text) to anon, authenticated;
