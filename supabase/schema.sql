-- ============================================================================
-- pos-balbuena · esquema de backend (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- Modelo transaccional del POS: mesas, meseros, cuentas abiertas, renglones de
-- cuenta y pedidos de cocina. El catálogo de platillos (menú, ingredientes,
-- modificadores) sigue viviendo en el código (src/lib/mockMenu.js) porque es
-- configuración estática, no datos transaccionales.
--
-- Todas las tablas llevan prefijo `pos_` porque este proyecto Supabase se comparte
-- con la app hermana (tali), que ya tiene tablas `mesas`, `cuentas` y `cuenta_items`
-- con otra estructura. El prefijo evita la colisión.
--
-- Correr una vez en el SQL Editor de Supabase (o `supabase db push`).
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Meseros ─────────────────────────────────────────────────────────────────
create table if not exists pos_meseros (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  mesas      text[] not null default '{}',   -- números de mesa asignados (p. ej. {'1','2','3'})
  pin        text,                            -- PIN de 4 dígitos para cambiar de mesero (atribución, no seguridad)
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
-- Para proyectos donde la tabla ya existía sin la columna.
alter table pos_meseros add column if not exists pin text;

-- ── Mesas ───────────────────────────────────────────────────────────────────
create table if not exists pos_mesas (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null unique,
  activo     boolean not null default true,
  pos_x      real,   -- posición en el mapa del piso, fracción 0..1 del ancho; null = cuadrícula por defecto
  pos_y      real,   -- fracción 0..1 del alto
  created_at timestamptz not null default now()
);

-- ── Cuentas (una abierta por mesa a la vez) ─────────────────────────────────
create table if not exists pos_cuentas (
  id         uuid primary key default gen_random_uuid(),
  mesa_id    uuid not null references pos_mesas(id) on delete cascade,
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);
-- Garantiza a nivel de base que no existan dos cuentas activas para la misma mesa.
create unique index if not exists pos_cuentas_una_activa_por_mesa
  on pos_cuentas (mesa_id) where activa;

-- ── Renglones de cuenta ─────────────────────────────────────────────────────
-- El renglón se guarda completo como JSON (tier, mitades, ingredientes, modificadores,
-- nota, cantidad) porque el precio se calcula en el cliente (calcItemPrecio) a partir de
-- esa misma estructura. Así el objeto que renderiza la app y el que persiste son idénticos.
create table if not exists pos_cuenta_items (
  id         uuid primary key default gen_random_uuid(),
  cuenta_id  uuid not null references pos_cuentas(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- ── Pedidos de cocina ───────────────────────────────────────────────────────
-- Uno por cada "enviar a cocina": un ticket completo tal como se pidió.
create table if not exists pos_pedidos (
  id                    uuid primary key default gen_random_uuid(),
  mesa_id               uuid not null references pos_mesas(id) on delete cascade,
  cuenta_id             uuid references pos_cuentas(id) on delete set null,
  mesa_numero           text,
  mesero_nombre         text,
  items                 jsonb not null default '[]',
  estado                text not null default 'pendiente'
                        check (estado in ('pendiente','preparando','listo')),
  enviado_at            timestamptz not null default now(),
  estado_actualizado_at timestamptz
);

create index if not exists pos_pedidos_mesa_idx   on pos_pedidos (mesa_id);
create index if not exists pos_pedidos_estado_idx on pos_pedidos (estado);

-- ============================================================================
-- RPCs (operaciones atómicas de varios pasos, estilo SECURITY DEFINER)
-- ============================================================================

-- Envía una orden: abre la cuenta de la mesa si no hay una activa, agrega los
-- renglones y crea el pedido de cocina. Devuelve el id de la cuenta.
create or replace function pos_enviar_orden(
  p_mesa_id       uuid,
  p_mesero_nombre text,
  p_items         jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta_id   uuid;
  v_mesa_numero text;
  v_item        jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    return null;
  end if;

  select numero into v_mesa_numero from pos_mesas where id = p_mesa_id;

  select id into v_cuenta_id from pos_cuentas where mesa_id = p_mesa_id and activa limit 1;
  if v_cuenta_id is null then
    insert into pos_cuentas (mesa_id) values (p_mesa_id) returning id into v_cuenta_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into pos_cuenta_items (cuenta_id, data) values (v_cuenta_id, v_item);
  end loop;

  insert into pos_pedidos (mesa_id, cuenta_id, mesa_numero, mesero_nombre, items, estado, enviado_at)
  values (p_mesa_id, v_cuenta_id, v_mesa_numero, p_mesero_nombre, p_items, 'pendiente', now());

  return v_cuenta_id;
end;
$$;

-- Cierra la mesa: marca la cuenta activa como cerrada y borra sus pedidos de cocina.
-- (Temporal: en la integración real el cierre lo hará la app de pagos al liquidar.)
create or replace function pos_cerrar_mesa(p_mesa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update pos_cuentas set activa = false, closed_at = now() where mesa_id = p_mesa_id and activa;
  delete from pos_pedidos where mesa_id = p_mesa_id;
end;
$$;

-- ============================================================================
-- RLS · esta es una herramienta interna sin login (tablet compartida con
-- selector de mesero), así que la anon key tiene acceso completo a las tablas
-- del POS. Si más adelante se agrega auth, endurecer estas políticas.
-- ============================================================================
alter table pos_meseros      enable row level security;
alter table pos_mesas        enable row level security;
alter table pos_cuentas      enable row level security;
alter table pos_cuenta_items enable row level security;
alter table pos_pedidos      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pos_meseros','pos_mesas','pos_cuentas','pos_cuenta_items','pos_pedidos']
  loop
    execute format('drop policy if exists "pos acceso total" on %I', t);
    execute format(
      'create policy "pos acceso total" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant execute on function pos_enviar_orden(uuid, text, jsonb) to anon, authenticated;
grant execute on function pos_cerrar_mesa(uuid)               to anon, authenticated;

-- ============================================================================
-- Realtime · el mesero y la cocina se sincronizan por estos cambios.
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table pos_mesas;
  alter publication supabase_realtime add table pos_cuentas;
  alter publication supabase_realtime add table pos_cuenta_items;
  alter publication supabase_realtime add table pos_pedidos;
exception when duplicate_object then null;
end $$;
