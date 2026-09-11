-- ============================================================================
-- pos-balbuena · BITÁCORA (quién hizo qué, cuándo)
-- ----------------------------------------------------------------------------
-- Antes de esto el POS no guardaba ningún rastro de acciones: se podía ver el
-- ESTADO actual (qué pedidos hay, qué mesas están abiertas) pero no quién lo
-- dejó así. En un restaurante la pregunta que llega tarde casi siempre es de
-- ese tipo — "¿quién le quitó ese platillo a la 7?", "¿quién le movió el precio
-- a los huaraches?" — y hasta hoy no había manera de contestarla.
--
-- Cómo se llena: TODA escritura del POS pasa por una RPC `pos_*` (ver schema.sql,
-- admin_menu.sql y llevar.sql). Cada una llama a `pos_log` al final, dentro de su
-- misma transacción, así que un evento registrado implica que la operación de
-- verdad ocurrió — y si la operación se revierte, su evento se va con ella.
--
-- Qué NO es: prueba a prueba de manipulación. No hay auth: la app usa la anon key
-- y el mesero se identifica con un PIN guardado en el store del navegador, así que
-- el actor viaja como PARÁMETRO de la RPC. Una petición armada a mano puede firmar
-- con el nombre de quien sea. Sirve para reconstruir el turno con el equipo, no
-- para sostener una acusación por sí sola.
--
-- Orden de ejecución:
--   cleanup.sql → schema.sql → bitacora.sql → admin_menu.sql → llevar.sql → seed.sql
-- (después de schema.sql porque referencia `meseros`; antes de los otros dos
--  porque sus RPCs ya llaman a `pos_log`.)
-- ============================================================================

-- ── La bitácora ─────────────────────────────────────────────────────────────
-- bigserial y no uuid: esta tabla se lee SIEMPRE en orden cronológico y crece por
-- append. Un id secuencial da ese orden gratis y desempata dos eventos que caen en
-- el mismo milisegundo (pasa: cerrar una mesa escribe su cierre y el de su cuenta).
--
-- mesero_nombre es copia denormalizada a propósito, igual que `pedidos.mesero_nombre`:
-- cuando un mesero se da de baja la FK se pone en null y el nombre sobrevive. Una
-- bitácora que dice "(sin mesero) borró el platillo" no sirve de nada.
--
-- detalle jsonb en vez de columnas por acción: cada tipo de evento tiene datos
-- distintos (un cambio de cantidad guarda de/a, un cierre de mesa guarda el ticket
-- completo) y no vale la pena una tabla por forma. Lo que sí es fijo — quién, qué,
-- cuándo, sobre qué — son columnas de verdad, porque es por lo que se filtra.
create table if not exists pos_eventos (
  id             bigserial primary key,
  restaurante_id uuid references restaurantes(id) on delete cascade,
  ocurrido_at    timestamptz not null default now(),
  mesero_id      uuid references meseros(id) on delete set null,
  mesero_nombre  text,
  accion         text not null,
  entidad        text,
  entidad_id     uuid,
  etiqueta       text,
  detalle        jsonb not null default '{}'
);

-- El índice que sostiene la pantalla de bitácora: el turno de hoy, del más reciente
-- al más viejo. Los otros dos son las preguntas que se hacen de verdad — "todo lo de
-- Luis" y "todo lo que le pasó a la mesa 7".
create index if not exists pos_eventos_rest_fecha_idx   on pos_eventos (restaurante_id, ocurrido_at desc);
create index if not exists pos_eventos_mesero_fecha_idx on pos_eventos (mesero_id, ocurrido_at desc);
create index if not exists pos_eventos_entidad_idx      on pos_eventos (entidad, entidad_id, ocurrido_at desc);
create index if not exists pos_eventos_accion_idx       on pos_eventos (accion, ocurrido_at desc);

-- ── Vocabulario de `accion` ─────────────────────────────────────────────────
-- Se deja como texto libre (sin check constraint) para que agregar un evento nuevo
-- no exija una migración del constraint, pero el formato es fijo: `entidad.verbo`,
-- en minúsculas. Los que existen hoy:
--
--   orden.enviar        se mandaron platillos a cocina (mesa o para llevar)
--   item.editar         cambió la cantidad de un renglón YA enviado
--   item.eliminar       se quitó un renglón YA enviado
--   cocina.estado       una comanda cambió de columna en el tablero
--   mesa.cerrar         se cerró la cuenta de una mesa (trae el ticket congelado)
--   mesa.unir           se juntó una mesa a otra (sobre la principal; la cuenta de la
--                       secundaria pasa a la principal)
--   mesa.separar        se soltó una mesa de su principal (lo pedido se queda en la principal)
--   mesa.crear / mesa.renombrar / mesa.borrar / mesa.reordenar
--   mesero.mesas        se le fijaron las mesas que atiende
--   mesero.baja         se dio de baja a un mesero
--   llevar.crear        se abrió una orden para llevar
--   llevar.cerrar       se entregó o canceló (trae el ticket congelado)
--   cliente.guardar     alta o edición de un cliente del padrón
--   platillo.crear / platillo.editar / platillo.borrar / platillo.reordenar
--   extra.platillos     cambió a qué platillos aplica un extra
--   ingrediente.crear / ingrediente.editar / ingrediente.borrar
--   modificador.crear / modificador.editar / modificador.borrar
--   extra.crear / extra.editar / extra.borrar
--   categoria.reordenar
--   mesero.crear / mesero.editar   (el PIN nunca se registra; solo SI cambió)

-- ============================================================================
-- Helper: registrar un evento. Lo llaman las RPCs del POS, nunca el cliente.
--
-- NUNCA tumba la operación que está registrando. Si el insert falla —la tabla
-- todavía no existe en esa base, el jsonb viene mal armado, lo que sea— se traga
-- el error y deja un `warning` en los logs de Postgres. El criterio es de POS, no
-- de banco: perder la venta porque no se pudo escribir su bitácora sería peor que
-- perder la línea de bitácora. El bloque `exception` abre una subtransacción, así
-- que el rollback alcanza solo al insert fallido.
--
-- Si p_mesero_nombre viene nulo se resuelve desde `meseros`: así quien llama puede
-- mandar solo el id y la bitácora sigue quedando legible.
-- ============================================================================
create or replace function pos_log(
  p_restaurante_id uuid,
  p_mesero_id      uuid,
  p_mesero_nombre  text,
  p_accion         text,
  p_entidad        text  default null,
  p_entidad_id     uuid  default null,
  p_etiqueta       text  default null,
  p_detalle        jsonb default '{}'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pos_eventos (
    restaurante_id, mesero_id, mesero_nombre, accion, entidad, entidad_id, etiqueta, detalle
  ) values (
    p_restaurante_id,
    p_mesero_id,
    coalesce(
      nullif(btrim(p_mesero_nombre), ''),
      (select nombre from meseros where id = p_mesero_id)
    ),
    p_accion,
    p_entidad,
    p_entidad_id,
    p_etiqueta,
    coalesce(p_detalle, '{}'::jsonb)
  );
exception when others then
  raise warning '[bitacora] no se pudo registrar %: %', p_accion, sqlerrm;
end;
$$;

-- ============================================================================
-- RLS. Misma postura que el resto de las tablas del POS para LEER (la pantalla de
-- bitácora usa la anon key), pero SIN políticas de insert/update/delete: escribir
-- es exclusivo de `pos_log`, que es SECURITY DEFINER y por eso se salta RLS.
--
-- Esto es lo que hace que la bitácora valga algo: aunque el actor sea autodeclarado,
-- nadie con la anon key puede insertar eventos falsos ni borrar los que ya están —
-- solo pueden nacer desde adentro de una RPC que de verdad hizo la operación.
-- ============================================================================
alter table pos_eventos enable row level security;

drop policy if exists "pos eventos lectura" on pos_eventos;
create policy "pos eventos lectura" on pos_eventos for select to anon, authenticated using (true);

revoke insert, update, delete on pos_eventos from anon, authenticated;

-- pos_log no es llamable desde la app: solo la invocan otras RPCs del servidor. Si
-- anon pudiera llamarla, podría meter eventos falsos firmados como cualquiera, y eso
-- es justo lo que la bitácora promete que no pasa.
--
-- El revoke va contra LOS TRES a propósito: Postgres le concede EXECUTE a PUBLIC por
-- default, y además Supabase le concede EXECUTE a anon y authenticated de forma
-- EXPLÍCITA en cada función que se crea en public (alter default privileges). Revocar
-- solo uno deja la puerta abierta por el otro. El dueño de la función la sigue pudiendo
-- ejecutar, que es como la llaman las RPCs SECURITY DEFINER.
revoke all on function pos_log(uuid, uuid, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
