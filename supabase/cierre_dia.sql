-- ============================================================================
-- pos-balbuena · CIERRE DEL DÍA (Ajustes → Bitácora → "Cierre del Día")
-- ----------------------------------------------------------------------------
-- Corte de caja de un horario específico (p. ej. 4pm–11pm), no del día calendario
-- completo: junta lo cobrado en salón (mesa.cerrar) y para llevar (llevar.pagar,
-- ver llevar_pagos.sql), y por cada INSTRUMENTO de pago (Efectivo/Tarjeta/Tali)
-- da tres números — venta, propina y el total que de verdad entró a caja por ese
-- instrumento:
--
--   venta   = lo vendido (el ticket), pagado con ese instrumento.
--   propina = propina cobrada con ese instrumento — SIN IMPORTAR con qué se pagó
--             la cuenta (alguien puede pagar con tarjeta y dejar propina en
--             efectivo; ese efectivo sí está en el cajón). Por eso propina se
--             suma sobre TODAS las cuentas, filtrando por cómo se cobró la
--             propina (propina_efectivo/propina_tarjeta en pos_cerrar_mesa), no
--             por el método de la cuenta.
--   total   = venta + propina: lo que de verdad hay que contar en ese instrumento
--             al cerrar caja.
--
-- Tali no pasa por el flujo de propina de pos_cerrar_mesa (ver el cierre
-- automático en usePosData.js), así que su propina hoy siempre es 0 — se deja el
-- cálculo igual de explícito por si algún día se llega a registrar.
--
-- "Ambos" (una cuenta pagada mitad efectivo, mitad tarjeta) reparte SU VENTA en
-- lo que de verdad se contó de cada uno, igual que pos_stats_resumen.caja_efectivo
-- / caja_tarjeta. Para llevar no tiene Tali ni propina (ver PagarLlevarModal).
--
-- Corre después de bitacora.sql, schema.sql, llevar.sql y llevar_pagos.sql.
-- Idempotente.
-- ============================================================================
create or replace function pos_stats_cierre_dia(
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
      (detalle->>'total')::numeric                        as total,
      nullif(detalle->>'metodo_pago', '')                  as metodo_pago,
      coalesce((detalle->>'monto_efectivo')::numeric, 0)   as monto_efectivo,
      coalesce((detalle->>'monto_tarjeta')::numeric, 0)    as monto_tarjeta,
      coalesce((detalle->>'propina_efectivo')::numeric, 0) as propina_efectivo,
      coalesce((detalle->>'propina_tarjeta')::numeric, 0)  as propina_tarjeta
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'mesa.cerrar'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
  ),
  llevar_pagos as (
    select
      (detalle->>'total')::numeric                      as total,
      nullif(detalle->>'metodo_pago', '')                as metodo_pago,
      coalesce((detalle->>'monto_efectivo')::numeric, 0) as monto_efectivo,
      coalesce((detalle->>'monto_tarjeta')::numeric, 0)  as monto_tarjeta
    from pos_eventos
    where restaurante_id = p_restaurante_id
      and accion = 'llevar.pagar'
      and ocurrido_at >= p_desde and ocurrido_at < p_hasta
  ),
  venta as (
    select
      coalesce((select sum(case when metodo_pago = 'efectivo' then total when metodo_pago = 'ambos' then monto_efectivo else 0 end) from mesa_cierres), 0)
        + coalesce((select sum(case when metodo_pago = 'efectivo' then total when metodo_pago = 'ambos' then monto_efectivo else 0 end) from llevar_pagos), 0) as efectivo,
      coalesce((select sum(case when metodo_pago = 'tarjeta' then total when metodo_pago = 'ambos' then monto_tarjeta else 0 end) from mesa_cierres), 0)
        + coalesce((select sum(case when metodo_pago = 'tarjeta' then total when metodo_pago = 'ambos' then monto_tarjeta else 0 end) from llevar_pagos), 0) as tarjeta,
      coalesce((select sum(total) from mesa_cierres where metodo_pago is null), 0) as tali
  ),
  propina as (
    select
      coalesce((select sum(propina_efectivo) from mesa_cierres), 0)                               as efectivo,
      coalesce((select sum(propina_tarjeta) from mesa_cierres), 0)                                 as tarjeta,
      coalesce((select sum(propina_efectivo + propina_tarjeta) from mesa_cierres where metodo_pago is null), 0) as tali
  )
  select jsonb_build_object(
    'cuentas', (select count(*) from mesa_cierres) + (select count(*) from llevar_pagos),
    'total',   (select efectivo + tarjeta + tali from venta),

    'efectivo_venta',   (select efectivo from venta),
    'efectivo_propina', (select efectivo from propina),
    'efectivo_total',   (select v.efectivo + p.efectivo from venta v, propina p),

    'tarjeta_venta',   (select tarjeta from venta),
    'tarjeta_propina', (select tarjeta from propina),
    'tarjeta_total',   (select v.tarjeta + p.tarjeta from venta v, propina p),

    'tali_venta',   (select tali from venta),
    'tali_propina', (select tali from propina),
    'tali_total',   (select v.tali + p.tali from venta v, propina p),

    -- Desglose salón vs. para llevar, para quien quiera ver de dónde salió el total.
    'salon_cuentas',  (select count(*) from mesa_cierres),
    'salon_total',    coalesce((select sum(total) from mesa_cierres), 0),
    'llevar_cuentas', (select count(*) from llevar_pagos),
    'llevar_total',   coalesce((select sum(total) from llevar_pagos), 0)
  );
$$;

grant execute on function pos_stats_cierre_dia(uuid, timestamptz, timestamptz) to anon, authenticated;
