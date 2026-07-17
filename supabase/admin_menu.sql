-- ============================================================================
-- pos-balbuena · Fase ADMIN: mesero administrador + menú editable
-- ----------------------------------------------------------------------------
-- Se corre sobre el MISMO proyecto Supabase que comparten pos-balbuena y tali.
-- Orden de ejecución:  cleanup.sql → schema.sql → admin_menu.sql → seed.sql
--
-- Dos decisiones de diseño clave:
--
-- 1) MENÚ = se EXTIENDE la tabla compartida `platillos` de tali (no una tabla
--    nueva). tali ya la usa con un precio plano; el POS necesita más (tiers,
--    base, mitades/nota). Se agregan columnas NULlables para no romper a tali,
--    que simplemente las ignora. Así un platillo dado de alta en el POS también
--    aparece en tali (mismo restaurante, dos frontends).
--
-- 2) ESCRITURAS al menú = por RPC SECURITY DEFINER (igual que el resto del POS),
--    NO abriendo `platillos` a la anon key. `platillos` la comparte tali con una
--    postura más estricta; abrirla a anon la debilitaría para todos. Las RPCs
--    dejan a tali intacta y el POS (anon) solo escribe por funciones controladas.
--    (Las tablas pos_ingredientes / pos_modificadores SÍ son 100% del POS, así
--    que esas sí llevan políticas abiertas como meseros/pedidos.)
-- ============================================================================

-- ── 1. Rol admin en meseros ─────────────────────────────────────────────────
-- Un mesero admin entra a /admin y edita meseros y el menú. Sigue siendo
-- "atribución, no seguridad": el gate real es el mismo PIN de 4 dígitos.
alter table meseros add column if not exists es_admin boolean not null default false;

-- ── 2. Columnas POS sobre la tabla compartida `platillos` ───────────────────
-- tali: platillos(id, restaurante_id, nombre, descripcion, precio, categoria,
-- activo, created_at) con UN precio plano. El POS agrega:
--   base            – descripción de los componentes base ("Tortilla, frijol…")
--   tiers           – [{ ingredientes, nombre, precio }] niveles de precio
--   tortillas       – variante opcional [{ id, nombre, tiers[] }] (ej. Tacos
--                     Dorados: precio distinto por tipo de tortilla). Cuando un
--                     platillo la usa, `tiers` va vacío y los niveles viven aquí.
--   permite_mitades – se puede pedir a mitades (dos guisos)
--   permite_nota    – admite nota libre para cocina
-- `platillos.precio` se mantiene = el precio MÍNIMO del platillo (ver RPC), para
-- que tali siga mostrando un precio plano coherente ("desde $X").
alter table platillos add column if not exists base            text;
alter table platillos add column if not exists tiers           jsonb   not null default '[]';
alter table platillos add column if not exists tortillas       jsonb;
alter table platillos add column if not exists permite_mitades boolean not null default false;
alter table platillos add column if not exists permite_nota    boolean not null default false;
-- Allowlists por platillo: qué modificadores ("Sin X") y qué extras de pago aplican.
-- El sitio real los asocia por platillo (una quesadilla no tiene frijol que quitar; una
-- bebida no lleva extras de comida). Son arreglos de NOMBRES que referencian los
-- catálogos globales pos_modificadores / pos_extras.
alter table platillos add column if not exists modificadores   jsonb not null default '[]';
alter table platillos add column if not exists extras          jsonb not null default '[]';
-- orden: posición del platillo DENTRO de su categoría (menor = primero). El orden
-- de las CATEGORÍAS vive aparte, en pos_categorias.
alter table platillos add column if not exists orden           int   not null default 0;

-- ── 3. Ingredientes y modificadores (catálogos GLOBALes del restaurante) ────
-- En el POS no son por-platillo: el tier del platillo solo dice CUÁNTOS
-- ingredientes incluye. Prefijo pos_ porque tali no los conoce.
create table if not exists pos_ingredientes (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  nombre         text not null,
  extra          numeric not null default 0,   -- cargo extra en MXN
  activo         boolean not null default true,
  orden          int not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists pos_modificadores (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  nombre         text not null,                 -- "Sin Crema", "Sin Frijol", …
  activo         boolean not null default true,
  orden          int not null default 0,
  created_at     timestamptz not null default now()
);

-- Extras: agregados de PAGO (grupo "Extras" del sitio real), disponibles en todos
-- los platillos, sin tope. Distintos de los ingredientes (guiso, con tope por nivel)
-- y de los modificadores (remociones gratis).
create table if not exists pos_extras (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  nombre         text not null,                 -- "Aguacate", "Crema", "Chile Habanero", …
  precio         numeric not null default 0,    -- cargo en MXN
  activo         boolean not null default true,
  orden          int not null default 0,
  created_at     timestamptz not null default now()
);

-- Orden de las CATEGORÍAS del menú. Las categorías son texto libre en platillos.categoria;
-- esta tabla solo aporta el ORDEN (nombre -> orden). Una categoría en uso que no tenga
-- fila aquí se ordena al final (alfabético). unique(restaurante,nombre) para poder hacer
-- upsert al reordenar.
create table if not exists pos_categorias (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  nombre         text not null,
  orden          int not null default 0,
  created_at     timestamptz not null default now(),
  unique (restaurante_id, nombre)
);

-- ── 4. RPC: guardar (crear/editar) un platillo del menú ─────────────────────
-- p_id null => alta; p_id no null => edición. Mantiene precio = tier "Sencillo"
-- (el de menos ingredientes) para tali.
-- Se elimina la firma anterior para no dejar un overload ambiguo que confunda a
-- PostgREST al resolver por nombres de argumento.
drop function if exists pos_guardar_platillo(uuid, uuid, text, text, text, jsonb, boolean, boolean, boolean, jsonb);
drop function if exists pos_guardar_platillo(uuid, uuid, text, text, text, jsonb, boolean, boolean, boolean, jsonb, jsonb, jsonb);
create or replace function pos_guardar_platillo(
  p_id              uuid,
  p_restaurante_id  uuid,
  p_nombre          text,
  p_categoria       text,
  p_base            text,
  p_tiers           jsonb,
  p_permite_mitades boolean,
  p_permite_nota    boolean,
  p_activo          boolean,
  p_tortillas       jsonb default null,
  p_modificadores   jsonb default '[]',
  p_extras          jsonb default '[]',
  p_orden           int   default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid := p_id;
  v_precio numeric;
  v_orden  int := p_orden;
begin
  if p_nombre is null or length(trim(p_nombre)) = 0 then
    raise exception 'El nombre del platillo es obligatorio.';
  end if;

  -- Platillo nuevo sin orden explícito: se agrega al final de su categoría.
  if v_id is null and v_orden is null then
    select coalesce(max(orden), -1) + 1 into v_orden
    from platillos where restaurante_id = p_restaurante_id and categoria is not distinct from p_categoria;
  end if;

  -- precio plano (para tali) = el MÍNIMO entre los tiers directos y los tiers de
  -- cada variante de tortilla. least() ignora NULLs, así que sirve cuando el
  -- platillo usa solo una de las dos formas.
  v_precio := coalesce(
    least(
      (select min((t->>'precio')::numeric)
         from jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb)) t),
      (select min((tt->>'precio')::numeric)
         from jsonb_array_elements(coalesce(p_tortillas, '[]'::jsonb)) v,
              jsonb_array_elements(v->'tiers') tt)
    ), 0);

  if v_id is null then
    insert into platillos (restaurante_id, nombre, categoria, descripcion, precio,
                           base, tiers, tortillas, permite_mitades, permite_nota, activo, modificadores, extras, orden)
    values (p_restaurante_id, p_nombre, p_categoria, p_base, v_precio,
            p_base, coalesce(p_tiers, '[]'::jsonb), p_tortillas, p_permite_mitades, p_permite_nota, p_activo,
            coalesce(p_modificadores, '[]'::jsonb), coalesce(p_extras, '[]'::jsonb), coalesce(v_orden, 0))
    returning id into v_id;
  else
    update platillos set
      nombre = p_nombre, categoria = p_categoria, descripcion = p_base, precio = v_precio,
      base = p_base, tiers = coalesce(p_tiers, '[]'::jsonb), tortillas = p_tortillas,
      permite_mitades = p_permite_mitades, permite_nota = p_permite_nota, activo = p_activo,
      modificadores = coalesce(p_modificadores, '[]'::jsonb), extras = coalesce(p_extras, '[]'::jsonb),
      orden = coalesce(p_orden, orden)
    where id = v_id;
  end if;

  return v_id;
end;
$$;

-- ── 5. RPC: borrar un platillo (delete real) ────────────────────────────────
-- La disponibilidad se controla con `activo` (toggle en el editor); "borrar" sí
-- elimina la fila. Antes se desligan los renglones de cuentas que lo referencian
-- (platillo_id -> null): cuenta_items ya guarda nombre y precio denormalizados, así
-- que el historial de ventas queda intacto sin FK colgada.
create or replace function pos_borrar_platillo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cuenta_items set platillo_id = null where platillo_id = p_id;
  delete from platillos where id = p_id;
end;
$$;

-- ── RPC: reordenar platillos. Recibe los ids en el orden deseado y les asigna
-- orden = posición (0,1,2,…). Se usa para las flechas ▲▼ del editor de menú.
-- (platillos no es escribible por anon directo; por eso va por RPC como el resto.)
create or replace function pos_reordenar_platillos(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update platillos p
  set orden = pos.idx
  from (select id, (ord - 1) as idx from unnest(p_ids) with ordinality as t(id, ord)) pos
  where p.id = pos.id;
end;
$$;

-- ── RPC: fijar a qué platillos aplica un extra (edición desde el lado del extra).
-- La asociación vive en platillos.extras (arreglo de nombres). Esta función, en una
-- sola llamada, agrega el nombre del extra a los platillos seleccionados y lo quita
-- de los demás. p_old_extra permite renombrar: si difiere, primero se limpia el nombre
-- viejo de todos. (jsonb `-` texto quita elementos del arreglo; `?` prueba pertenencia.)
create or replace function pos_set_extra_en_platillos(
  p_restaurante_id uuid,
  p_extra          text,
  p_platillo_ids   uuid[],
  p_old_extra      text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update platillos p set extras = sub.nuevo
  from (
    select id,
      case
        when id = any(p_platillo_ids)
          then (case when base ? p_extra then base else base || to_jsonb(p_extra) end)
        else base - p_extra
      end as nuevo
    from (
      select id,
        case when p_old_extra is not null and p_old_extra <> p_extra
             then coalesce(extras, '[]'::jsonb) - p_old_extra
             else coalesce(extras, '[]'::jsonb) end as base
      from platillos where restaurante_id = p_restaurante_id
    ) t
  ) sub
  where p.id = sub.id;
end;
$$;

-- ── 6. RLS ──────────────────────────────────────────────────────────────────
-- Tablas 100% del POS: políticas abiertas (mismo criterio que meseros/pedidos).
alter table pos_ingredientes  enable row level security;
alter table pos_modificadores enable row level security;
alter table pos_extras        enable row level security;
alter table pos_categorias    enable row level security;

drop policy if exists "pos ingredientes total" on pos_ingredientes;
create policy "pos ingredientes total" on pos_ingredientes for all to anon, authenticated using (true) with check (true);

drop policy if exists "pos modificadores total" on pos_modificadores;
create policy "pos modificadores total" on pos_modificadores for all to anon, authenticated using (true) with check (true);

drop policy if exists "pos extras total" on pos_extras;
create policy "pos extras total" on pos_extras for all to anon, authenticated using (true) with check (true);

drop policy if exists "pos categorias total" on pos_categorias;
create policy "pos categorias total" on pos_categorias for all to anon, authenticated using (true) with check (true);

-- platillos (compartida): el POS solo necesita LEER con anon; las escrituras van
-- por las RPCs de arriba (security definer). Esta política es aditiva y de solo
-- lectura, así no debilita las escrituras que ya controla tali.
drop policy if exists "pos platillos lectura anon" on platillos;
create policy "pos platillos lectura anon" on platillos for select to anon using (true);

grant execute on function pos_guardar_platillo(uuid, uuid, text, text, text, jsonb, boolean, boolean, boolean, jsonb, jsonb, jsonb, int) to anon, authenticated;
grant execute on function pos_borrar_platillo(uuid) to anon, authenticated;
grant execute on function pos_reordenar_platillos(uuid[]) to anon, authenticated;
grant execute on function pos_set_extra_en_platillos(uuid, text, uuid[], text) to anon, authenticated;

-- ── 7. Realtime (un cambio de menú/mesero se refleja en todas las tablets) ──
-- meseros no estaba en la publicación; ahora el admin edita meseros y el POS se
-- suscribe a la tabla (ver usePosData), así que hay que agregarla aquí.
do $$ begin alter publication supabase_realtime add table meseros;          exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table platillos;        exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table pos_ingredientes;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table pos_modificadores; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table pos_extras;        exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table pos_categorias;    exception when duplicate_object then null; end $$;
