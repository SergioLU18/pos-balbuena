-- ============================================================================
-- pos-balbuena · SIN REPARTO DE MESAS
-- ----------------------------------------------------------------------------
-- Cualquier mesero atiende cualquier mesa: ya no hay mesas "de" nadie. Antes cada
-- mesa llevaba en `mesa_meseros` la lista de quienes la atendían — se llenaba al
-- crearla, desde Ajustes → Meseros y cada vez que alguien le mandaba una orden, y
-- nunca se vaciaba al cerrar la cuenta, así que los nombres se acumulaban turno
-- tras turno en la tarjeta del piso.
--
-- Este script deja de escribir en `mesa_meseros` y la vacía. La tabla se queda
-- (vacía) para no romper nada que todavía la mencione; el POS ya no la lee.
--
-- Corre DESPUÉS de schema.sql. Idempotente: se puede volver a correr.
-- ============================================================================

-- pos_enviar_orden: idéntica a la de schema.sql, menos el alta del mesero en
-- mesa_meseros.
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
  v_mesa   uuid;
  v_rest   uuid;
  v_cuenta uuid;
  v_numero text;
  v_item   jsonb;
  v_pedido uuid;
  v_total  numeric;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    return null;
  end if;

  -- Una mesa unida a otra no tiene cuenta propia: la orden va a su PRINCIPAL (ver
  -- pos_unir_mesas). El `for share` espera a una unión en curso y relee joined_to ya
  -- comiteado, así que una orden que cae justo mientras se juntan las mesas no deja
  -- una cuenta suelta en la secundaria.
  select coalesce(joined_to, id) into v_mesa from mesas where id = p_mesa_id for share;
  select restaurante_id, numero into v_rest, v_numero from mesas where id = v_mesa for share;

  select id into v_cuenta from cuentas where mesa_id = v_mesa and activa limit 1;
  if v_cuenta is null then
    insert into cuentas (mesa_id, restaurante_id, estado, subtotal, activa)
    values (v_mesa, v_rest, 'abierta', 0, true)
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

  insert into pedidos (restaurante_id, mesa_id, cuenta_id, mesa_numero, mesero_id, mesero_nombre, items, estado, enviado_at)
  values (v_rest, v_mesa, v_cuenta, v_numero, p_mesero_id, p_mesero_nombre, p_items, 'pendiente', now())
  returning id into v_pedido;

  -- Bitácora. El importe se calcula sobre p_items y no se lee de la cuenta porque la
  -- cuenta ya trae lo de comandas anteriores: aquí se registra lo que se mandó AHORA.
  select coalesce(sum((r->>'precio_unitario')::numeric * (r->>'cantidad')::integer), 0)
  into v_total from jsonb_array_elements(p_items) as r;

  perform pos_log(
    v_rest, p_mesero_id, p_mesero_nombre,
    'orden.enviar', 'mesa', v_mesa, v_numero,
    jsonb_build_object(
      'pedido_id',  v_pedido,
      'cuenta_id',  v_cuenta,
      'renglones',  jsonb_array_length(p_items),
      'importe',    v_total,
      'items',      p_items
    )
  );

  return v_cuenta;
end;
$$;

-- pos_crear_mesa: misma firma (p_mesero_ids se queda, con su default, para que una
-- tablet que todavía tenga la versión vieja cargada no truene), pero ya no le asigna
-- la mesa a nadie.
create or replace function pos_crear_mesa(
  p_restaurante_id uuid,
  p_numero         text,
  p_mesero_ids     uuid[] default '{}',
  p_mesero_id      uuid default null,
  p_mesero_nombre  text default null
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

  perform pos_log(
    p_restaurante_id, p_mesero_id, p_mesero_nombre,
    'mesa.crear', 'mesa', v_mesa, v_numero, '{}'::jsonb
  );

  return v_mesa;
end;
$$;

-- Ajustes → Meseros ya no reparte mesas.
drop function if exists pos_set_mesas_mesero(uuid, uuid[], uuid, text);

-- Fuera los nombres acumulados.
delete from mesa_meseros;
