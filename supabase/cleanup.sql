-- ============================================================================
-- pos-balbuena · limpieza del intento anterior (tablas pos_ separadas)
-- ----------------------------------------------------------------------------
-- Deshace lo que dejó el primer enfoque (tablas duplicadas con prefijo pos_ y
-- las huérfanas sin prefijo del primerísimo intento), y revierte la política
-- permisiva que se había agregado a las tablas REALES de tali.
--
-- Correr UNA vez, ANTES de schema.sql. Es idempotente.
-- ============================================================================

-- 1) Quitar la política "acceso total" que el primer intento agregó a las tablas
--    reales de tali. No tocamos su RLS ni sus políticas propias.
drop policy if exists "pos acceso total" on mesas;
drop policy if exists "pos acceso total" on cuentas;
drop policy if exists "pos acceso total" on cuenta_items;

-- 2) Borrar las funciones del POS que apuntaban a tablas pos_ (se recrean, ya
--    apuntando a las tablas de tali, en schema.sql).
drop function if exists pos_enviar_orden(uuid, text, jsonb);
drop function if exists pos_cerrar_mesa(uuid);

-- 3) Borrar las tablas duplicadas del POS. Las versiones unificadas de `meseros`
--    y `pedidos` (que tali no tiene) se recrean en schema.sql sobre el mismo
--    restaurante. tali no consulta `meseros` ni `pedidos`, así que son del POS.
drop table if exists pos_pedidos      cascade;
drop table if exists pos_cuenta_items cascade;
drop table if exists pos_cuentas      cascade;
drop table if exists pos_mesas        cascade;
drop table if exists pos_meseros      cascade;
drop table if exists pedidos          cascade;
drop table if exists meseros          cascade;
