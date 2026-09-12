-- ============================================================================
-- pos-balbuena · ESTADÍSTICAS (Ajustes → Bitácora → Estadísticas)
-- ----------------------------------------------------------------------------
-- La bitácora (pos_eventos, ver bitacora.sql) ya es un registro cronológico de
-- toda venta cerrada — cada `mesa.cerrar` y `llevar.cerrar` trae el TICKET
-- CONGELADO completo en `detalle`. Estas funciones son lectura pura sobre esa
-- tabla (y sobre `ordenes_llevar` para frecuencia de clientes): agregan en
-- Postgres en vez de traer eventos crudos al navegador, que es lo que hace la
-- pantalla de Bitácora normal (útil para "un día a la vez", no para sumar un mes).
--
-- Por qué de `detalle.items` de los eventos de CIERRE y no de `orden.enviar`:
-- cuando se envía una comanda, `pedidos.items` puede seguir editándose
-- (item.editar / item.eliminar mutan esa fila en su sitio). El ticket que se
-- congela al cerrar ya es el estado FINAL, neto de esas ediciones — sumar sobre
-- cierres da el total correcto sin tener que reconstruir el neto a mano.
--
-- Qué NO cubren (avisarlo en la pantalla, no esconderlo):
--   · Método de pago: SOLO existe para mesas (`mesa.cerrar.detalle.metodo_pago`).
--     Las órdenes para llevar no lo registran — pos_cerrar_orden_llevar no lo
--     pide. `metodo_pago` viene null cuando pagó tali (ver pos_cerrar_mesa en
--     usePosData.js: el cierre automático firma "Pago en tali" y no manda
--     p_metodo_pago), así que null = tali, no un dato faltante.
--   · Frecuencia de clientes: el POS solo identifica al cliente en órdenes PARA
--     LLEVAR (`ordenes_llevar.cliente_id`, tabla `clientes`). Una mesa pagada en
--     el salón — con tali o sin él — no tiene cliente ligado en esta base; el
--     padrón de tali es otro sistema. Por eso esta stat es, necesariamente,
--     "clientes para llevar", no "clientes" a secas.
--
-- Venta por mesero, en cambio, se arma de `orden.enviar` (no de los cierres):
-- así el mesero que tomó y mandó la comanda se lleva el crédito aunque la mesa
-- la haya terminado de cobrar tali (que firma el cierre como "Pago en tali",
-- sin mesero) o la haya cerrado otro compañero. El costo de esa elección es que
-- el monto es lo ENVIADO a cocina, no lo neto tras ediciones/cancelaciones
-- posteriores — aceptable para un ranking, no para cuadrar caja.
--
-- Nada de esto necesita SECURITY DEFINER: son SELECT puros sobre tablas que ya
-- se leen con la anon key (mismas políticas RLS que el resto del POS).
--
-- Corre después de bitacora.sql (pos_eventos) y llevar.sql (clientes,
-- ordenes_llevar). Idempotente, como el resto de este proyecto.
-- ============================================================================

-- ============================================================================
-- pos_stats_resumen: total del periodo, número de cuentas, ticket promedio,
-- salón vs. para llevar, y el corte por método de pago (solo salón, ver arriba).
-- p_desde/p_hasta son un rango [desde, hasta) — el mismo criterio que usa
-- useBitacora.js para un día, aquí abierto a cualquier rango que arme el cliente.
-- ============================================================================
drop function if exists pos_stats_resumen(uuid, timestamptz, timestamptz);
create or replace function pos_stats_resumen(
  p_restaurante_id uuid,
  p_desde          timestamptz,
  p_hasta          timestamptz
) returns jsonb
language sql
stable
set search_path = public
as $$
  with mesa_cierres as (
    select
      (detalle->>'total')::numeric         as total,
      nullif(detalle->>'metodo_pago', '')  as metodo_pago,
      coalesce((detalle->>'monto_efectivo')::numeric, 0) as monto_efectivo,
      coalesce((detalle->>'monto_tarjeta')::numeric, 0)  as monto_tarjeta
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'mesa.cerrar'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
  ),
  llevar_entregadas as (
    select (detalle->>'total')::numeric as total
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'llevar.cerrar'
      and coalesce(detalle->>'estado', 'entregada') = 'entregada'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
  ),
  llevar_canceladas as (
    select count(*) as n, coalesce(sum((detalle->>'total')::numeric), 0) as monto
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'llevar.cerrar'
      and detalle->>'estado' = 'cancelada'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
  )
  select jsonb_build_object(
    'salon_total',    coalesce((select sum(total) from mesa_cierres), 0),
    'salon_cuentas',  (select count(*) from mesa_cierres),
    'llevar_total',   coalesce((select sum(total) from llevar_entregadas), 0),
    'llevar_cuentas', (select count(*) from llevar_entregadas),

    -- Cuatro categorías EXCLUYENTES que suman salon_total — para la dona de
    -- "método de pago". "Ambos" es su propia rebanada (no se reparte dentro de
    -- efectivo/tarjeta): así el dueño ve cuántas cuentas se pagaron mixtas y
    -- por cuánto, que es justo el dato que se pierde si se prorratea.
    'metodo_efectivo',         coalesce((select sum(total) from mesa_cierres where metodo_pago = 'efectivo'), 0),
    'metodo_efectivo_cuentas', (select count(*) from mesa_cierres where metodo_pago = 'efectivo'),
    'metodo_tarjeta',          coalesce((select sum(total) from mesa_cierres where metodo_pago = 'tarjeta'), 0),
    'metodo_tarjeta_cuentas',  (select count(*) from mesa_cierres where metodo_pago = 'tarjeta'),
    'metodo_ambos',            coalesce((select sum(total) from mesa_cierres where metodo_pago = 'ambos'), 0),
    'metodo_ambos_cuentas',    (select count(*) from mesa_cierres where metodo_pago = 'ambos'),
    'metodo_tali',             coalesce((select sum(total) from mesa_cierres where metodo_pago is null), 0),
    'metodo_tali_cuentas',     (select count(*) from mesa_cierres where metodo_pago is null),

    -- Para cuadrar caja (no para la dona): cuánto dinero de VERDAD entró en
    -- efectivo/tarjeta, repartiendo el monto de las cuentas "ambos" en lo que de
    -- verdad se contó de cada uno al cerrar.
    'caja_efectivo', coalesce((select sum(case when metodo_pago = 'efectivo' then total when metodo_pago = 'ambos' then monto_efectivo else 0 end) from mesa_cierres), 0),
    'caja_tarjeta',  coalesce((select sum(case when metodo_pago = 'tarjeta' then total when metodo_pago = 'ambos' then monto_tarjeta else 0 end) from mesa_cierres), 0),

    'llevar_canceladas',      (select n from llevar_canceladas),
    'llevar_cancelado_monto', (select monto from llevar_canceladas)
  );
$$;

grant execute on function pos_stats_resumen(uuid, timestamptz, timestamptz) to anon, authenticated;

-- ============================================================================
-- pos_stats_platillos: top platillos del periodo, por dinero y por unidades,
-- sumando `detalle.items` de todos los cierres (mesa.cerrar + llevar.cerrar
-- entregadas). Un mismo nombre de platillo se agrupa aunque venga de mesa y de
-- llevar en el mismo periodo.
-- ============================================================================
drop function if exists pos_stats_platillos(uuid, timestamptz, timestamptz, int);
create or replace function pos_stats_platillos(
  p_restaurante_id uuid,
  p_desde          timestamptz,
  p_hasta          timestamptz,
  p_limite         int default 8
) returns jsonb
language sql
stable
set search_path = public
as $$
  with renglones as (
    select
      coalesce(nullif(btrim(r->>'nombre'), ''), '(sin nombre)') as nombre,
      coalesce((r->>'cantidad')::numeric, 1)                    as cantidad,
      coalesce((r->>'precio_unitario')::numeric, 0) * coalesce((r->>'cantidad')::numeric, 1) as importe
    from pos_eventos e, jsonb_array_elements(e.detalle->'items') as r
    where e.restaurante_id = p_restaurante_id
      and e.ocurrido_at >= p_desde and e.ocurrido_at < p_hasta
      and (
        e.accion = 'mesa.cerrar'
        or (e.accion = 'llevar.cerrar' and coalesce(e.detalle->>'estado', 'entregada') = 'entregada')
      )
  ),
  agregado as (
    select nombre, sum(cantidad) as unidades, sum(importe) as dinero
    from renglones
    group by nombre
  )
  select jsonb_build_object(
    'por_dinero', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'unidades', unidades, 'dinero', dinero) order by dinero desc), '[]'::jsonb)
      from (select * from agregado where dinero > 0 order by dinero desc limit p_limite) t
    ),
    'por_unidades', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'unidades', unidades, 'dinero', dinero) order by unidades desc), '[]'::jsonb)
      from (select * from agregado where unidades > 0 order by unidades desc limit p_limite) t
    )
  );
$$;

grant execute on function pos_stats_platillos(uuid, timestamptz, timestamptz, int) to anon, authenticated;

-- ============================================================================
-- pos_stats_meseros: venta enviada a cocina, tickets atendidos (mesas + órdenes
-- para llevar distintas a las que les mandó algo) y ticket promedio, por mesero.
-- Ver el comentario de arriba del porqué se arma de `orden.enviar` y no de los
-- cierres.
-- ============================================================================
drop function if exists pos_stats_meseros(uuid, timestamptz, timestamptz);
create or replace function pos_stats_meseros(
  p_restaurante_id uuid,
  p_desde          timestamptz,
  p_hasta          timestamptz
) returns jsonb
language sql
stable
set search_path = public
as $$
  with envios as (
    select
      mesero_id,
      coalesce(nullif(btrim(mesero_nombre), ''), '(sin mesero)') as mesero_nombre,
      entidad,
      entidad_id,
      coalesce((detalle->>'importe')::numeric, 0) as importe
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'orden.enviar'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
  ),
  por_mesero as (
    select
      mesero_id,
      mesero_nombre,
      sum(importe)                              as venta,
      count(distinct (entidad, entidad_id))     as tickets
    from envios
    group by mesero_id, mesero_nombre
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'mesero_id', mesero_id,
      'mesero_nombre', mesero_nombre,
      'venta', venta,
      'tickets', tickets,
      'ticket_promedio', case when tickets > 0 then venta / tickets else 0 end
    )
    order by venta desc
  ), '[]'::jsonb)
  from por_mesero;
$$;

grant execute on function pos_stats_meseros(uuid, timestamptz, timestamptz) to anon, authenticated;

-- ============================================================================
-- pos_stats_ventas_serie: una fila por cada mesa/orden-para-llevar cerrada en el
-- rango, con su momento y su total. A propósito NO agrega por hora/día de semana
-- aquí: eso depende de la hora LOCAL del restaurante, y este proyecto no guarda
-- zona horaria del restaurante en ningún lado — todo el resto del código (ver
-- useBitacora.js) asume que el reloj de la tablet ES el reloj del restaurante y
-- hace ese cálculo en el navegador. Esta función solo entrega los puntos; el
-- cliente arma con ellos el heatmap hora×día, el ranking de días de la semana y
-- el acumulado del mes.
--
-- `ocurrido_at` viaja como epoch en MILISEGUNDOS, no como texto: jsonb_build_object
-- serializa un timestamptz con espacio en vez de "T" (p. ej. "2026-09-16 14:30:00+00"),
-- que `new Date(...)` en JS no tiene obligación de aceptar (el formato con espacio no
-- es el que exige el estándar, solo lo toleran algunos motores). `new Date(numero)`
-- no tiene esa ambigüedad.
-- ============================================================================
drop function if exists pos_stats_ventas_serie(uuid, timestamptz, timestamptz);
create or replace function pos_stats_ventas_serie(
  p_restaurante_id uuid,
  p_desde          timestamptz,
  p_hasta          timestamptz
) returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ocurrido_at', round(extract(epoch from ocurrido_at) * 1000),
    'total',       total,
    'tipo',        tipo
  ) order by ocurrido_at), '[]'::jsonb)
  from (
    select ocurrido_at, (detalle->>'total')::numeric as total, 'salon' as tipo
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'mesa.cerrar'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
    union all
    select ocurrido_at, (detalle->>'total')::numeric as total, 'llevar' as tipo
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'llevar.cerrar'
      and coalesce(detalle->>'estado', 'entregada') = 'entregada'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
  ) t;
$$;

grant execute on function pos_stats_ventas_serie(uuid, timestamptz, timestamptz) to anon, authenticated;

-- ============================================================================
-- pos_stats_clientes_frecuencia: cuántos clientes del padrón PARA LLEVAR (ver
-- comentario de arriba: es lo único que el POS identifica) tienen 1, 2-3 o 4+
-- órdenes entregadas, de siempre — no es un corte por periodo. Un restaurante
-- que solo hace clientes de una vez tiene un problema distinto al que no atrae
-- gente, y ese patrón no se ve en una ventana de días.
-- ============================================================================
drop function if exists pos_stats_clientes_frecuencia(uuid);
create or replace function pos_stats_clientes_frecuencia(
  p_restaurante_id uuid
) returns jsonb
language sql
stable
set search_path = public
as $$
  with conteo as (
    select cliente_id, count(*) as ordenes
    from ordenes_llevar
    where restaurante_id = p_restaurante_id
      and estado = 'entregada'
      and cliente_id is not null
    group by cliente_id
  )
  select jsonb_build_object(
    'una_vez',        count(*) filter (where ordenes = 1),
    'dos_a_tres',     count(*) filter (where ordenes between 2 and 3),
    'cuatro_mas',     count(*) filter (where ordenes >= 4),
    'total_clientes', count(*)
  )
  from conteo;
$$;

grant execute on function pos_stats_clientes_frecuencia(uuid) to anon, authenticated;
