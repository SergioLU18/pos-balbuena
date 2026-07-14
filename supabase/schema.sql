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
-- Orden de ejecución:  cleanup.sql  →  schema.sql  →  seed.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Meseros (tali no tiene este concepto) ───────────────────────────────────
create table if not exists meseros (
  id             uuid primary key default gen_random_uuid(),
  restaurante_id uuid references restaurantes(id) on delete cascade,
  nombre         text not null,
  mesas          text[] not null default '{}',   -- números de mesa asignados
  pin            text,                            -- PIN de 4 dígitos para cambiar de mesero
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ── Pedidos de cocina (tali no tiene cocina) ────────────────────────────────
-- items guarda la orden COMPLETA (tier, mitades, ingredientes, nota) para la
-- pantalla de cocina. Los renglones facturables planos viven en cuenta_items.
create table if not exists pedidos (
  id                    uuid primary key default gen_random_uuid(),
  restaurante_id        uuid references restaurantes(id) on delete cascade,
  mesa_id               uuid references mesas(id) on delete cascade,
  cuenta_id             uuid references cuentas(id) on delete set null,
  mesa_numero           text,
  mesero_nombre         text,
  items                 jsonb not null default '[]',
  estado                text not null default 'pendiente'
                        check (estado in ('pendiente','preparando','listo')),
  enviado_at            timestamptz not null default now(),
  estado_actualizado_at timestamptz
);
create index if not exists pedidos_mesa_idx   on pedidos (mesa_id);
create index if not exists pedidos_estado_idx on pedidos (estado);

-- ============================================================================
-- RPC: enviar orden. Abre la cuenta de la mesa si no hay una activa, agrega los
-- renglones con las MISMAS funciones que usa tali, recalcula el subtotal y crea
-- el pedido de cocina. Devuelve el id de la cuenta.
-- Cada elemento de p_items debe traer: nombre, precio_unitario, cantidad
-- (más el resto de la estructura rica, que se guarda tal cual en pedidos.items).
-- ============================================================================
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
  v_rest   uuid;
  v_cuenta uuid;
  v_numero text;
  v_item   jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    return null;
  end if;

  select restaurante_id, numero into v_rest, v_numero from mesas where id = p_mesa_id;

  select id into v_cuenta from cuentas where mesa_id = p_mesa_id and activa limit 1;
  if v_cuenta is null then
    insert into cuentas (mesa_id, restaurante_id, estado, subtotal, activa)
    values (p_mesa_id, v_rest, 'abierta', 0, true)
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

  insert into pedidos (restaurante_id, mesa_id, cuenta_id, mesa_numero, mesero_nombre, items, estado, enviado_at)
  values (v_rest, p_mesa_id, v_cuenta, v_numero, p_mesero_nombre, p_items, 'pendiente', now());

  return v_cuenta;
end;
$$;

-- ============================================================================
-- RPC: cerrar mesa (temporal, mientras el cierre real lo hará la app de pagos).
-- Marca la cuenta activa como cerrada — igual que tali (activa=false,
-- estado='cerrada', closed_at=now()) — y borra los pedidos de cocina de la mesa.
-- ============================================================================
create or replace function pos_cerrar_mesa(p_mesa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cuentas set activa = false, estado = 'cerrada', closed_at = now()
  where mesa_id = p_mesa_id and activa;
  delete from pedidos where mesa_id = p_mesa_id;
end;
$$;

-- ============================================================================
-- RLS · solo en las tablas nuevas del POS. Las tablas de tali conservan SUS
-- políticas: el POS lee cuentas/cuenta_items/mesas con la anon key (como ya hace
-- tali) y escribe mediante las RPCs SECURITY DEFINER de arriba.
-- ============================================================================
alter table meseros enable row level security;
alter table pedidos enable row level security;

drop policy if exists "pos meseros total" on meseros;
create policy "pos meseros total" on meseros for all to anon, authenticated using (true) with check (true);

drop policy if exists "pos pedidos total" on pedidos;
create policy "pos pedidos total" on pedidos for all to anon, authenticated using (true) with check (true);

grant execute on function pos_enviar_orden(uuid, text, jsonb) to anon, authenticated;
grant execute on function pos_cerrar_mesa(uuid)               to anon, authenticated;

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
