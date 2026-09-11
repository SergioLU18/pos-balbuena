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
-- Orden de ejecución:  cleanup.sql → schema.sql → bitacora.sql → admin_menu.sql → llevar.sql → seed.sql
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

  -- Quien manda una orden queda atendiendo la mesa. on conflict do nothing porque a
  -- partir de la segunda orden ya está en la lista, y porque dos meseros pueden estar
  -- mandando a la misma mesa al mismo tiempo desde dos tablets.
  if p_mesero_id is not null then
    insert into mesa_meseros (mesa_id, mesero_id)
    values (v_mesa, p_mesero_id)
    on conflict do nothing;
  end if;

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

-- ============================================================================
-- RPC: editar cantidad de un renglón ya enviado. Solo permitido mientras el
-- pedido sigue en 'pendiente' (cocina aún no lo ha visto/empezado) — la
-- validación es server-side (no solo ocultar el botón en el cliente), igual
-- que el resto de las funciones de este archivo. Sincroniza pedidos.items
-- (jsonb, para cocina) y la fila correspondiente de cuenta_items (para el
-- total de tali), ubicada por (cuenta_id, nombre) — la misma clave que usa
-- add_or_update_cuenta_item para crearla en pos_enviar_orden.
-- ============================================================================
-- El actor viaja como parámetro porque no hay auth (ver bitacora.sql). Va con default
-- null para no romper una llamada vieja, y la firma anterior se tira explícitamente:
-- dejar las dos vivas le deja a PostgREST un overload ambiguo que resolver.
drop function if exists pos_editar_item_pedido(uuid, text, integer);
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

-- ============================================================================
-- RPC: eliminar un renglón ya enviado. Mismo guard de estado = 'pendiente'
-- que pos_editar_item_pedido. Si el renglón eliminado era el último del
-- pedido, se borra el pedido completo (una comanda sin platillos no debe
-- seguir apareciendo en el tablero de cocina).
-- ============================================================================
drop function if exists pos_eliminar_item_pedido(uuid, text);
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

  -- Al detalle va el renglón COMPLETO, no solo su nombre: quien reclama pregunta por
  -- el platillo tal como se pidió (con sus mitades, sus ingredientes y su nota), y
  -- para cuando alguien lea esta línea la fila de pedidos ya no va a existir.
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
-- RPC: cerrar mesa (temporal, mientras el cierre real lo hará la app de pagos).
-- Marca la cuenta activa como cerrada — igual que tali (activa=false,
-- estado='cerrada', closed_at=now()) — y borra los pedidos de cocina de la mesa.
-- ============================================================================
drop function if exists pos_cerrar_mesa(uuid);
create or replace function pos_cerrar_mesa(
  p_mesa_id       uuid,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest     uuid;
  v_numero   text;
  v_cuenta   uuid;
  v_total    numeric;
  v_items    jsonb;
  v_comandas integer;
begin
  -- Candado sobre la mesa: el cierre por pago en tali llega a TODAS las tablets a la
  -- vez (es un broadcast) y cada una llama a esta función. Con el candado se forman:
  -- la primera cierra y registra, y las demás, al tomar su turno, encuentran la mesa
  -- ya cerrada y salen abajo sin dejar un "Cerró la cuenta" repetido en la bitácora.
  select restaurante_id, numero into v_rest, v_numero from mesas where id = p_mesa_id for update;
  select id, subtotal into v_cuenta, v_total
  from cuentas where mesa_id = p_mesa_id and activa limit 1;

  -- El ticket se congela ANTES de borrar las comandas. cuenta_items sí sobrevive al
  -- cierre (nombre, precio y cantidad, que es de lo que vive tali), pero el detalle
  -- de cocina — tier, mitades, ingredientes quitados, notas — y QUIÉN mandó cada
  -- comanda viven solo en pedidos.items, y hasta ahora se iban con la mesa. Es justo
  -- el detalle que hace falta cuando alguien reclama al día siguiente.
  select coalesce(jsonb_agg(renglon), '[]'::jsonb) into v_items
  from pedidos p, jsonb_array_elements(p.items) as renglon
  where p.mesa_id = p_mesa_id;

  -- Aparte y no con un count(distinct) sobre el join de arriba: una comanda con items
  -- vacío no produce renglones y quedaría fuera de la cuenta.
  select count(*) into v_comandas from pedidos where mesa_id = p_mesa_id;

  -- Nada que cerrar: otra tablet ya lo hizo. No hay operación, así que no hay evento.
  if v_cuenta is null and v_comandas = 0 then
    return;
  end if;

  update cuentas set activa = false, estado = 'cerrada', closed_at = now()
  where mesa_id = p_mesa_id and activa;
  delete from pedidos where mesa_id = p_mesa_id;

  perform pos_log(
    v_rest, p_mesero_id, p_mesero_nombre,
    'mesa.cerrar', 'mesa', p_mesa_id, v_numero,
    jsonb_build_object(
      'cuenta_id', v_cuenta,
      -- Si tali ya cobró, su cuenta ya no está activa y el subtotal no se ve desde
      -- aquí; en ese caso el total sale del ticket que se acaba de congelar.
      'total',     coalesce(v_total, (
        select coalesce(sum((r->>'precio_unitario')::numeric * (r->>'cantidad')::integer), 0)
        from jsonb_array_elements(v_items) as r
      )),
      'comandas',  v_comandas,
      'items',     v_items
    )
  );
end;
$$;

-- ============================================================================
-- Mesas unidas. En el salón a veces juntan dos mesas físicas para un grupo grande.
-- Se usa la columna de tali `mesas.joined_to`: la SECUNDARIA apunta a su PRINCIPAL,
-- y la cuenta, las comandas y las órdenes nuevas viven todas en la principal. Es de
-- un solo nivel — sin cadenas —, igual que en tali.
--
-- El POS NO usa join_mesa_to_primary de tali: esa función no mueve las comandas de
-- cocina (quedaban colgadas de la secundaria, apuntando a una cuenta cerrada, y las
-- ediciones de renglón ya no encontraban su fila en cuenta_items), recalcula el
-- subtotal sin descuentos y no deja rastro en la bitácora.
--
-- Cerrar la cuenta NO separa las mesas: puede que el grupo se vaya y las mesas se
-- queden juntas para el siguiente. Separar es siempre explícito.
-- ============================================================================
-- La columna es de tali; el `if not exists` solo cubre una base donde tali todavía no
-- corrió su migración.
alter table mesas add column if not exists joined_to uuid references mesas(id);

-- ============================================================================
-- RPC: unir una o varias mesas a una principal. Por cada secundaria:
--   · su cuenta abierta pasa a la principal (se abre una si la principal no tenía).
--     Cada renglón se funde con el de la principal que tenga el mismo nombre, precio y
--     descuento: pos_editar_item_pedido ubica su fila por (cuenta_id, nombre), y con
--     dos filas iguales le aplicaría el cambio a las dos. No se funden filas que tali
--     ya tocó con un pago o una división (pago_items / cuenta_item_splits apuntan a
--     ellas por id): esas se mueven tal cual.
--   · su cuenta vieja se cierra como 'cerrada' — igual que tali —, no 'pagada', para
--     que el POS no la anuncie como cobrada.
--   · sus comandas de cocina pasan a la principal, para que editar un renglón enviado
--     y cerrar la mesa las sigan encontrando.
-- Bloqueado si la secundaria ya tiene pagos completados (mismo criterio que
-- transfer_cuenta_to_mesa de tali): el pago quedaría colgado de una cuenta cerrada.
-- ============================================================================
drop function if exists pos_unir_mesas(uuid, uuid[], uuid, text);
create or replace function pos_unir_mesas(
  p_principal_id  uuid,
  p_secundarias   uuid[],
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_principal mesas%rowtype;
  v_sec       mesas%rowtype;
  v_sec_id    uuid;
  v_cuenta_p  uuid;
  v_cuenta_s  uuid;
  v_item      cuenta_items%rowtype;
  v_destino   uuid;
  v_importe   numeric;
  v_renglones integer;
  v_comandas  integer;
begin
  if coalesce(array_length(p_secundarias, 1), 0) = 0 then
    raise exception 'Elige al menos una mesa para unir.';
  end if;
  if p_principal_id = any(p_secundarias) then
    raise exception 'No se puede unir una mesa consigo misma.';
  end if;

  -- Candado sobre todas las mesas del grupo, en orden de id para que dos uniones
  -- simultáneas no se esperen en cruz. pos_enviar_orden y pos_cerrar_mesa toman el
  -- candado de su mesa, así que ninguna orden ni cierre cae a media mudanza.
  perform 1 from mesas where id = p_principal_id or id = any(p_secundarias) order by id for update;

  select * into v_principal from mesas where id = p_principal_id;
  if not found or not v_principal.activo then
    raise exception 'La mesa principal ya no existe.';
  end if;
  if v_principal.joined_to is not null then
    raise exception 'La Mesa % ya está unida a otra: elige la principal de ese grupo.', v_principal.numero;
  end if;

  select id into v_cuenta_p from cuentas where mesa_id = p_principal_id and activa limit 1;

  foreach v_sec_id in array p_secundarias loop
    select * into v_sec from mesas where id = v_sec_id;
    if not found or not v_sec.activo or v_sec.restaurante_id is distinct from v_principal.restaurante_id then
      raise exception 'Una de las mesas ya no existe.';
    end if;
    if v_sec.joined_to is not null then
      raise exception 'La Mesa % ya está unida a otra.', v_sec.numero;
    end if;
    if exists (select 1 from mesas where joined_to = v_sec_id and activo) then
      raise exception 'La Mesa % ya tiene mesas unidas: úsala como principal.', v_sec.numero;
    end if;

    v_importe   := 0;
    v_renglones := 0;
    select id into v_cuenta_s from cuentas where mesa_id = v_sec_id and activa limit 1;

    if v_cuenta_s is not null then
      if exists (select 1 from pagos where cuenta_id = v_cuenta_s and estado = 'completado') then
        raise exception 'La Mesa % ya tiene pagos registrados: no se puede unir.', v_sec.numero;
      end if;

      if v_cuenta_p is null then
        insert into cuentas (mesa_id, restaurante_id, estado, subtotal, activa)
        values (p_principal_id, v_principal.restaurante_id, 'abierta', 0, true)
        returning id into v_cuenta_p;
      end if;

      for v_item in select * from cuenta_items where cuenta_id = v_cuenta_s order by created_at loop
        select ci.id into v_destino
        from cuenta_items ci
        where ci.cuenta_id = v_cuenta_p
          and ci.nombre = v_item.nombre
          and ci.precio_unitario = v_item.precio_unitario
          and ci.platillo_id is not distinct from v_item.platillo_id
          and coalesce(ci.descuento_porcentaje, 0) = coalesce(v_item.descuento_porcentaje, 0)
          and not exists (select 1 from pago_items pi where pi.cuenta_item_id in (ci.id, v_item.id))
          and not exists (select 1 from cuenta_item_splits sp where sp.cuenta_item_id in (ci.id, v_item.id))
        limit 1;

        if v_destino is not null then
          update cuenta_items set cantidad = cantidad + v_item.cantidad where id = v_destino;
          delete from cuenta_items where id = v_item.id;
        else
          update cuenta_items set cuenta_id = v_cuenta_p where id = v_item.id;
        end if;

        v_importe   := v_importe + v_item.precio_unitario * v_item.cantidad;
        v_renglones := v_renglones + 1;
      end loop;

      update cuentas set activa = false, estado = 'cerrada', closed_at = now() where id = v_cuenta_s;
    end if;

    -- mesa_numero se queda como estaba: la comanda se mandó para esa mesa y ahí está
    -- sentado quien la pidió.
    update pedidos set mesa_id = p_principal_id, cuenta_id = coalesce(v_cuenta_p, cuenta_id)
    where mesa_id = v_sec_id;
    get diagnostics v_comandas = row_count;

    update mesas set joined_to = p_principal_id where id = v_sec_id;

    -- Un evento por secundaria, colgado de la principal: "todo lo de la Mesa 3" trae
    -- quién le juntó qué y cuánto dinero traía cada una.
    perform pos_log(
      v_principal.restaurante_id, p_mesero_id, p_mesero_nombre,
      'mesa.unir', 'mesa', p_principal_id, v_principal.numero,
      jsonb_build_object(
        'secundaria_id',  v_sec_id,
        'secundaria',     v_sec.numero,
        'cuenta_id',      v_cuenta_p,
        'cuenta_cerrada', v_cuenta_s,
        'renglones',      v_renglones,
        'importe',        v_importe,
        'comandas',       v_comandas
      )
    );
  end loop;

  if v_cuenta_p is not null then
    perform recalculate_subtotal(v_cuenta_p);
  end if;
end;
$$;

-- ============================================================================
-- RPC: separar una mesa de su principal. Solo suelta el vínculo: lo que ya se pidió
-- se queda en la cuenta de la principal (no hay forma de saber qué renglón era de
-- quién), y la mesa vuelve a quedar libre para su propia cuenta.
-- ============================================================================
drop function if exists pos_separar_mesa(uuid, uuid, text);
create or replace function pos_separar_mesa(
  p_mesa_id       uuid,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sec       mesas%rowtype;
  v_principal mesas%rowtype;
begin
  select * into v_sec from mesas where id = p_mesa_id for update;
  if not found then
    raise exception 'La mesa no existe.';
  end if;
  -- Ya suelta: otra tablet se adelantó. No hay operación, así que no hay evento.
  if v_sec.joined_to is null then
    return;
  end if;

  select * into v_principal from mesas where id = v_sec.joined_to;

  update mesas set joined_to = null where id = p_mesa_id;

  perform pos_log(
    v_sec.restaurante_id, p_mesero_id, p_mesero_nombre,
    'mesa.separar', 'mesa', v_principal.id, v_principal.numero,
    jsonb_build_object('secundaria_id', p_mesa_id, 'secundaria', v_sec.numero)
  );
end;
$$;

-- ── Orden del listado de mesas (compartido, lo ajusta el admin en Ajustes) ──
-- Igual que platillos.orden: menor = primero. Es una columna del POS sobre la
-- tabla `mesas` de tali (que la ignora); default 0 para las filas que ya existen.
alter table mesas add column if not exists orden int not null default 0;

-- ============================================================================
-- RPC: crear mesa. La usa el admin desde Ajustes → Mesas. Acepta VARIOS meseros
-- (p_mesero_ids) porque una mesa se puede repartir entre más de uno desde el momento
-- en que se crea. La mesa nueva se coloca al final del listado (orden = máximo + 1).
-- ============================================================================
drop function if exists pos_crear_mesa(uuid, text, uuid);
drop function if exists pos_crear_mesa(uuid, text, uuid[]);
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

  insert into mesa_meseros (mesa_id, mesero_id)
  select v_mesa, elegidos.mesero_id
  from unnest(coalesce(p_mesero_ids, '{}'::uuid[])) as elegidos(mesero_id)
  on conflict do nothing;

  perform pos_log(
    p_restaurante_id, p_mesero_id, p_mesero_nombre,
    'mesa.crear', 'mesa', v_mesa, v_numero,
    jsonb_build_object('meseros', coalesce(p_mesero_ids, '{}'::uuid[]))
  );

  return v_mesa;
end;
$$;

-- ============================================================================
-- RPC: borrar mesa (baja lógica: activo=false, no se pierde el historial de
-- pedidos/cuentas que ya la referencian). Bloqueada si la mesa tiene una cuenta
-- abierta — borrarla a medio servicio dejaría la cuenta huérfana.
-- ============================================================================
drop function if exists pos_borrar_mesa(uuid);
create or replace function pos_borrar_mesa(
  p_mesa_id       uuid,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tiene_cuenta  boolean;
  v_rest          uuid;
  v_numero        text;
begin
  select exists(select 1 from cuentas where mesa_id = p_mesa_id and activa) into v_tiene_cuenta;
  if v_tiene_cuenta then
    raise exception 'No se puede borrar una mesa con cuenta abierta.';
  end if;
  -- Dada de baja, una secundaria seguiría "unida" sin que nadie la vea, y una principal
  -- dejaría a sus secundarias apuntando a una mesa que ya no aparece.
  if exists (
    select 1 from mesas
    where (id = p_mesa_id and joined_to is not null) or (joined_to = p_mesa_id and activo)
  ) then
    raise exception 'La mesa está unida con otra. Sepárala antes de borrarla.';
  end if;

  select restaurante_id, numero into v_rest, v_numero from mesas where id = p_mesa_id;

  update mesas set activo = false where id = p_mesa_id;

  -- La baja es lógica (activo=false), así que el on delete cascade de mesa_meseros
  -- no dispara: hay que soltar a mano a los meseros que la atendían.
  delete from mesa_meseros where mesa_id = p_mesa_id;

  perform pos_log(
    v_rest, p_mesero_id, p_mesero_nombre,
    'mesa.borrar', 'mesa', p_mesa_id, v_numero, '{}'::jsonb
  );
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
drop function if exists pos_set_mesas_mesero(uuid, uuid[]);
create or replace function pos_set_mesas_mesero(
  p_mesero_id     uuid,
  p_mesa_ids      uuid[],
  p_actor_id      uuid default null,
  p_actor_nombre  text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest    uuid;
  v_nombre  text;
  v_previas uuid[];
begin
  select restaurante_id, nombre into v_rest, v_nombre from meseros where id = p_mesero_id;

  -- Se leen ANTES del delete: sin esto la bitácora solo diría cómo quedó, y la
  -- pregunta que llega es "¿desde cuándo dejó de traer la 7?".
  select coalesce(array_agg(mesa_id), '{}'::uuid[]) into v_previas
  from mesa_meseros where mesero_id = p_mesero_id;

  delete from mesa_meseros
  where mesero_id = p_mesero_id
    and not (mesa_id = any(coalesce(p_mesa_ids, '{}'::uuid[])));

  insert into mesa_meseros (mesa_id, mesero_id)
  select elegidas.mesa_id, p_mesero_id
  from unnest(coalesce(p_mesa_ids, '{}'::uuid[])) as elegidas(mesa_id)
  on conflict do nothing;

  perform pos_log(
    v_rest, p_actor_id, p_actor_nombre,
    'mesero.mesas', 'mesero', p_mesero_id, v_nombre,
    jsonb_build_object('antes', v_previas, 'despues', coalesce(p_mesa_ids, '{}'::uuid[]))
  );
end;
$$;

-- ============================================================================
-- RPC: renombrar mesa. El nombre acepta letras y números y debe ser único entre las
-- mesas activas del restaurante (sin distinguir mayúsculas).
--
-- Quién atiende la mesa NO se toca: `mesa_meseros` guarda ids, no nombres — que es
-- justo el motivo por el que se dejó de guardar el número (renombrar una mesa
-- reasignaba en silencio la que tuviera ese número). Lo que sí guarda el NOMBRE es la
-- copia denormalizada de la comanda, así que esa sí se actualiza en cascada o la
-- cocina seguiría cantando el nombre viejo.
-- ============================================================================
drop function if exists pos_renombrar_mesa(uuid, text);
create or replace function pos_renombrar_mesa(
  p_mesa_id       uuid,
  p_numero        text,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurante uuid;
  v_nuevo       text := btrim(coalesce(p_numero, ''));
  v_viejo       text;
begin
  if length(v_nuevo) = 0 then
    raise exception 'El nombre de la mesa no puede estar vacío.';
  end if;
  if length(v_nuevo) > 24 then
    raise exception 'El nombre de la mesa es demasiado largo (máx. 24 caracteres).';
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

  update mesas  set numero = v_nuevo where id = p_mesa_id;
  update pedidos set mesa_numero = v_nuevo where mesa_id = p_mesa_id;

  -- La etiqueta guarda el nombre NUEVO y el detalle el viejo: si mañana alguien busca
  -- "PL-3" en la bitácora, lo que encuentra es la mesa que hoy se llama así.
  perform pos_log(
    v_restaurante, p_mesero_id, p_mesero_nombre,
    'mesa.renombrar', 'mesa', p_mesa_id, v_nuevo,
    jsonb_build_object('de', v_viejo, 'a', v_nuevo)
  );
end;
$$;

-- ============================================================================
-- RPC: dar de baja a un mesero. La baja es lógica (activo=false) para no perder la
-- referencia en los pedidos históricos, y de paso lo suelta de todas sus mesas: un
-- mesero que ya no está en el turno no puede seguir figurando como quien las atiende.
-- Las dos cosas van juntas en una transacción para que no quede a medias.
-- ============================================================================
drop function if exists pos_borrar_mesero(uuid);
create or replace function pos_borrar_mesero(
  p_mesero_id     uuid,
  p_actor_id      uuid default null,
  p_actor_nombre  text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest   uuid;
  v_nombre text;
begin
  select restaurante_id, nombre into v_rest, v_nombre from meseros where id = p_mesero_id;

  update meseros set activo = false where id = p_mesero_id;
  delete from mesa_meseros where mesero_id = p_mesero_id;

  perform pos_log(
    v_rest, p_actor_id, p_actor_nombre,
    'mesero.baja', 'mesero', p_mesero_id, v_nombre, '{}'::jsonb
  );
end;
$$;

-- ============================================================================
-- RPC: reordenar mesas. Recibe los ids en el orden deseado y les asigna
-- orden = posición (0,1,2,…). Es el listado compartido que ve todo mesero; solo
-- el admin lo cambia (flechas ▲▼ en Ajustes → Mesas).
-- ============================================================================
drop function if exists pos_reordenar_mesas(uuid[]);
create or replace function pos_reordenar_mesas(
  p_ids           uuid[],
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest uuid;
begin
  update mesas m
  set orden = pos.idx
  from (
    select unnest(p_ids) as id, generate_subscripts(p_ids, 1) - 1 as idx
  ) pos
  where m.id = pos.id;

  select restaurante_id into v_rest from mesas where id = p_ids[1];

  perform pos_log(
    v_rest, p_mesero_id, p_mesero_nombre,
    'mesa.reordenar', null, null, null,
    jsonb_build_object('mesas', coalesce(array_length(p_ids, 1), 0))
  );
end;
$$;

-- ============================================================================
-- RPC: mover una comanda de columna en el tablero de cocina. Antes era un update
-- directo desde el cliente; pasa por aquí para que quede quién la marcó "lista" —
-- la pregunta típica cuando un platillo salió frío o nunca llegó a la mesa.
--
-- Estampa la misma columna de tiempo por etapa que estampaba el cliente
-- (preparando_at / listo_at / entregado_at), pero con now() del servidor: el reloj
-- de cada tablet puede andar desfasado y los reportes de tiempos de cocina se
-- comparan entre tablets.
--
-- Es el evento más frecuente de toda la bitácora (3 por comanda). Por eso el detalle
-- es mínimo — de/a y quién mandó la comanda —, sin copiar los renglones: ya quedaron
-- registrados completos en el `orden.enviar` de esa misma comanda.
-- ============================================================================
create or replace function pos_avanzar_pedido(
  p_pedido_id     uuid,
  p_estado        text,
  p_mesero_id     uuid default null,
  p_mesero_nombre text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido pedidos%rowtype;
begin
  if p_estado not in ('pendiente','preparando','listo','entregado') then
    raise exception 'Estado de pedido inválido: %', p_estado;
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido % no existe.', p_pedido_id;
  end if;

  update pedidos set
    estado                = p_estado,
    estado_actualizado_at = now(),
    preparando_at         = case when p_estado = 'preparando' then now() else preparando_at end,
    listo_at              = case when p_estado = 'listo'      then now() else listo_at      end,
    entregado_at          = case when p_estado = 'entregado'  then now() else entregado_at  end
  where id = p_pedido_id;

  perform pos_log(
    v_pedido.restaurante_id, p_mesero_id, p_mesero_nombre,
    'cocina.estado', 'pedido', p_pedido_id,
    coalesce(v_pedido.mesa_numero, v_pedido.cliente_nombre),
    jsonb_build_object(
      'tipo',             v_pedido.tipo,
      'de',               v_pedido.estado,
      'a',                p_estado,
      'mesero_comanda',   v_pedido.mesero_nombre
    )
  );
end;
$$;

-- ============================================================================
-- RPC: alta o edición de un mesero (panel de admin). También era escritura directa.
-- Devuelve el id porque el alta lo necesita en el acto para fijarle sus mesas con
-- pos_set_mesas_mesero.
--
-- El PIN NUNCA va a la bitácora, ni en claro ni enmascarado: la bitácora la puede
-- leer cualquier tablet con la anon key. Solo se registra SI cambió.
--
-- Usa meseros.es_admin, que lo agrega admin_menu.sql: corre después de este archivo,
-- pero plpgsql resuelve columnas al ejecutar y no al crear, así que no truena.
--
-- Mismo caso que pos_set_mesas_mesero/pos_borrar_mesero: `p_mesero_*` no sirve para
-- el actor porque aquí el mesero es el objeto que se edita. El actor es p_actor_*.
-- ============================================================================
create or replace function pos_guardar_mesero(
  p_id             uuid,
  p_restaurante_id uuid,
  p_nombre         text,
  p_pin            text    default null,
  p_es_admin       boolean default false,
  p_activo         boolean default true,
  p_actor_id       uuid    default null,
  p_actor_nombre   text    default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := p_id;
  v_antes meseros%rowtype;
begin
  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'El nombre del mesero es obligatorio.';
  end if;

  if v_id is null then
    insert into meseros (restaurante_id, nombre, pin, es_admin, activo)
    values (p_restaurante_id, btrim(p_nombre), nullif(p_pin, ''), coalesce(p_es_admin, false), coalesce(p_activo, true))
    returning id into v_id;
  else
    select * into v_antes from meseros where id = v_id;
    update meseros
    set nombre = btrim(p_nombre), pin = nullif(p_pin, ''),
        es_admin = coalesce(p_es_admin, false), activo = coalesce(p_activo, true)
    where id = v_id;
  end if;

  perform pos_log(
    p_restaurante_id, p_actor_id, p_actor_nombre,
    case when p_id is null then 'mesero.crear' else 'mesero.editar' end,
    'mesero', v_id, btrim(p_nombre),
    case when p_id is null
      then jsonb_build_object('es_admin', coalesce(p_es_admin, false))
      else jsonb_build_object(
        'antes',      jsonb_build_object('nombre', v_antes.nombre, 'es_admin', v_antes.es_admin, 'activo', v_antes.activo),
        'despues',    jsonb_build_object('nombre', btrim(p_nombre), 'es_admin', coalesce(p_es_admin, false), 'activo', coalesce(p_activo, true)),
        'cambio_pin', v_antes.pin is distinct from nullif(p_pin, '')
      )
    end
  );

  return v_id;
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

-- SOLO LECTURA. Antes eran "total" (anon podía escribir directo) porque el mesero y
-- la cocina escribían estas tablas sin pasar por RPC. Ahora toda escritura va por una
-- RPC que deja su línea en la bitácora (ver bitacora.sql), y dejar la política abierta
-- sería dejar una puerta para cambiar cosas sin rastro. Las RPCs son SECURITY DEFINER,
-- así que a ellas RLS no les aplica. Las políticas "total" viejas se tiran por nombre
-- porque reaplicar este archivo sobre una base existente las dejaría vivas.
drop policy if exists "pos meseros total" on meseros;
drop policy if exists "pos meseros lectura" on meseros;
create policy "pos meseros lectura" on meseros for select to anon, authenticated using (true);

drop policy if exists "pos mesa_meseros total" on mesa_meseros;
drop policy if exists "pos mesa_meseros lectura" on mesa_meseros;
create policy "pos mesa_meseros lectura" on mesa_meseros for select to anon, authenticated using (true);

drop policy if exists "pos pedidos total" on pedidos;
drop policy if exists "pos pedidos lectura" on pedidos;
create policy "pos pedidos lectura" on pedidos for select to anon, authenticated using (true);

grant execute on function pos_enviar_orden(uuid, text, jsonb, uuid)                 to anon, authenticated;
grant execute on function pos_editar_item_pedido(uuid, text, integer, uuid, text)   to anon, authenticated;
grant execute on function pos_eliminar_item_pedido(uuid, text, uuid, text)          to anon, authenticated;
grant execute on function pos_cerrar_mesa(uuid, uuid, text)                         to anon, authenticated;
grant execute on function pos_unir_mesas(uuid, uuid[], uuid, text)                  to anon, authenticated;
grant execute on function pos_separar_mesa(uuid, uuid, text)                        to anon, authenticated;
grant execute on function pos_crear_mesa(uuid, text, uuid[], uuid, text)            to anon, authenticated;
grant execute on function pos_borrar_mesa(uuid, uuid, text)                         to anon, authenticated;
grant execute on function pos_set_mesas_mesero(uuid, uuid[], uuid, text)            to anon, authenticated;
grant execute on function pos_borrar_mesero(uuid, uuid, text)                       to anon, authenticated;
grant execute on function pos_renombrar_mesa(uuid, text, uuid, text)                to anon, authenticated;
grant execute on function pos_reordenar_mesas(uuid[], uuid, text)                   to anon, authenticated;
grant execute on function pos_avanzar_pedido(uuid, text, uuid, text)                to anon, authenticated;
grant execute on function pos_guardar_mesero(uuid, uuid, text, text, boolean, boolean, uuid, text) to anon, authenticated;

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
