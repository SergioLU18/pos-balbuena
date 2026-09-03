-- ============================================================================
-- pos-balbuena · datos iniciales sobre el backend de tali
-- Correr después de schema.sql y admin_menu.sql (usa es_admin y las tablas de
-- menú). Idempotente: se puede volver a correr sin duplicar.
-- Crea el restaurante del POS, sus mesas/meseros y el menú (platillos +
-- ingredientes + modificadores) usando las tablas compartidas con tali.
-- ============================================================================

-- Restaurante del POS (si tu proyecto ya tiene una fila para Jardín Balbuena,
-- este insert no hace nada y todo lo demás la reutiliza por nombre).
insert into restaurantes (nombre, activo)
select 'Jardín Balbuena', true
where not exists (select 1 from restaurantes where nombre = 'Jardín Balbuena');

-- 15 mesas para ese restaurante (esquema real de tali: numero, restaurante_id, activo)
insert into mesas (numero, restaurante_id, activo)
select g::text, r.id, true
from restaurantes r
cross join generate_series(1, 15) g
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from mesas m where m.restaurante_id = r.id and m.numero = g::text
  );

-- 3 meseros con sus mesas asignadas y PIN de 4 dígitos. Doña Rosa es admin
-- (puede editar meseros y el menú desde /admin).
insert into meseros (restaurante_id, nombre, mesas, pin, es_admin)
select r.id, v.nombre, v.mesas, v.pin, v.es_admin
from restaurantes r
cross join (values
  ('Doña Rosa', array['1','2','3','4','5'],      '1111', true),
  ('Don Beto',  array['6','7','8','9','10'],     '2222', false),
  ('Lupita',    array['11','12','13','14','15'], '3333', false)
) as v(nombre, mesas, pin, es_admin)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from meseros m where m.restaurante_id = r.id and m.nombre = v.nombre
  );

-- ── Menú: platillos ─────────────────────────────────────────────────────────
-- Reconstruye el catálogo del mock (src/lib/mockMenu.js) en la tabla compartida
-- `platillos`. precio = precio mínimo (para el precio plano que muestra tali);
-- tiers/tortillas/base/flags en las columnas POS. Idempotente por (restaurante, nombre).
insert into platillos (restaurante_id, nombre, categoria, descripcion, precio, base, tiers, tortillas, permite_mitades, permite_nota, activo, modificadores, extras, orden)
select r.id, v.nombre, v.categoria, v.base, v.precio, v.base, v.tiers::jsonb, v.tortillas::jsonb, v.permite_mitades, v.permite_nota, true, v.modificadores::jsonb, v.extras::jsonb, 0
from restaurantes r
cross join (values
  ('Sope', 'Sopes', 'Tortilla hecha a mano, frijol, salsa verde, romanita, crema y queso oaxaca', 110,
    '[{"ingredientes":0,"nombre":"Sencillo","precio":110},{"ingredientes":0,"nombre":"Sencillo con Chorizo","precio":120},{"ingredientes":1,"nombre":"1 Ingrediente","precio":140},{"ingredientes":2,"nombre":"2 Ingredientes","precio":165},{"ingredientes":3,"nombre":"3 Ingredientes","precio":190}]',
    null, true, true,
    '["Sin Crema","Sin Frijol","Sin Salsa Verde","Sin Queso Oaxaca","Sin Lechuga (Romanita)"]',
    '["Aguacate","Chile de Árbol","Chile Habanero","Crema","Salsa Verde"]'),
  ('Quesadilla', 'Quesadillas', 'Tortilla hecha a mano y queso oaxaca', 120,
    '[{"ingredientes":0,"nombre":"Sencillo","precio":120},{"ingredientes":1,"nombre":"1 Ingrediente","precio":140},{"ingredientes":2,"nombre":"2 Ingredientes","precio":165},{"ingredientes":3,"nombre":"3 Ingredientes","precio":190}]',
    null, true, true,
    '["Sin Crema","Sin Salsa Verde"]',
    '["Aguacate","Chile de Árbol","Chile Habanero","Crema","Salsa Verde"]'),
  ('Tacos Dorados', 'Tacos Dorados', 'Tres tacos dorados, con lechuga, crema y queso', 150,
    '[]',
    '[{"id":"maiz","nombre":"Tortilla de Maíz","tiers":[{"ingredientes":1,"nombre":"1 Ingrediente","precio":150},{"ingredientes":2,"nombre":"2 Ingredientes","precio":175}]},{"id":"harina","nombre":"Tortilla de Harina","tiers":[{"ingredientes":1,"nombre":"1 Ingrediente","precio":175},{"ingredientes":2,"nombre":"2 Ingredientes","precio":200}]}]',
    true, true,
    '["Sin Crema","Sin Salsa Verde","Sin Queso Oaxaca","Sin Lechuga (Romanita)"]',
    '["Aguacate","Chile de Árbol","Chile Habanero","Crema","Salsa Verde"]'),
  ('Torta', 'Tortas', 'Pan de torta, frijol, crema, queso oaxaca y verduras', 160,
    '[{"ingredientes":1,"nombre":"1 Ingrediente","precio":160},{"ingredientes":2,"nombre":"2 Ingredientes","precio":190},{"ingredientes":3,"nombre":"3 Ingredientes","precio":220}]',
    null, true, true,
    '["Sin Aguacate","Sin Frijol","Sin Crema"]',
    '["Aguacate","Chile de Árbol","Chile Habanero","Crema","Salsa Verde"]'),
  ('Sincronizada', 'Sincronizadas', 'Dos tortillas de harina con queso oaxaca', 110,
    '[{"ingredientes":0,"nombre":"Sencillo","precio":110},{"ingredientes":1,"nombre":"1 Ingrediente","precio":130},{"ingredientes":2,"nombre":"2 Ingredientes","precio":155},{"ingredientes":3,"nombre":"3 Ingredientes","precio":180}]',
    null, true, true,
    '["Sin Aguacate","Sin Queso Oaxaca","Sin Salsa Roja","Sin Crema"]',
    '["Aguacate","Chile de Árbol","Chile Habanero","Crema","Salsa Verde"]'),
  ('Burrita', 'Burritas', 'Tortilla de harina, frijol, crema y queso oaxaca', 120,
    '[{"ingredientes":0,"nombre":"Sencillo","precio":120},{"ingredientes":1,"nombre":"1 Ingrediente","precio":140},{"ingredientes":2,"nombre":"2 Ingredientes","precio":165},{"ingredientes":3,"nombre":"3 Ingredientes","precio":190}]',
    null, true, true,
    '["Sin Aguacate","Sin Queso Oaxaca","Sin Salsa Roja","Sin Crema"]',
    '["Aguacate","Chile de Árbol","Chile Habanero","Crema","Salsa Verde"]'),
  ('Ensalada', 'Ensaladas', 'Lechuga romanita, jitomate, aderezo de la casa', 150,
    '[{"ingredientes":1,"nombre":"1 Ingrediente","precio":150},{"ingredientes":2,"nombre":"2 Ingredientes","precio":180}]',
    null, false, true,
    '["Sin Salsa Verde","Sin Queso Oaxaca","Sin Crema"]',
    '["Aguacate","Chile de Árbol","Chile Habanero","Crema","Salsa Verde"]'),
  ('Refresco', 'Bebidas', 'Elige tu sabor', 40,
    '[]',
    '[{"id":"coca-cola-regular","nombre":"Coca Cola Regular","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"coca-cola-light","nombre":"Coca Cola Light","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"coca-cola-sin-azucar","nombre":"Coca Cola Sin Azúcar","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"fanta","nombre":"Fanta","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"cebada","nombre":"Cebada","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"bebi","nombre":"Bebi","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"agua-de-horchata","nombre":"Agua de Horchata","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"agua-de-jamaica","nombre":"Agua de Jamaica","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"jamaica-con-canela-y-limon-sin-azucar","nombre":"Jamaica con Canela y Limón sin Azúcar","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"te-negro-stevia","nombre":"Té Negro Stevia","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"agua-purificada","nombre":"Agua Purificada","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]}]',
    false, false, '[]', '[]'),
  ('Flan de Queso Oaxaca', 'Postres', 'Postre individual', 70,
    '[{"ingredientes":0,"nombre":"Único","precio":70}]',
    null, false, false, '[]', '[]')
) as v(nombre, categoria, base, precio, tiers, tortillas, permite_mitades, permite_nota, modificadores, extras)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from platillos p where p.restaurante_id = r.id and p.nombre = v.nombre
  );

-- ── Menú: ingredientes globales ─────────────────────────────────────────────
-- Lista real de la sucursal Av. Líbano (balbuena.app/libano).
insert into pos_ingredientes (restaurante_id, nombre, extra, orden)
select r.id, v.nombre, v.extra, v.orden
from restaurantes r
cross join (values
  ('Aguacate', 0, 0), ('Asado', 0, 1), ('Asado Rojo', 0, 2), ('Champiñones', 0, 3),
  ('Chicharrón Prensado', 0, 4), ('Chorizo', 0, 5), ('Empanizado de Pollo', 15, 6),
  ('Extra de Queso Oaxaca', 0, 7), ('Huitlacoche', 15, 8), ('Jamón', 0, 9),
  ('Papa', 0, 10), ('Pollo Deshebrado', 0, 11), ('Rajas Poblanas', 0, 12), ('Tinga de Res', 15, 13)
) as v(nombre, extra, orden)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from pos_ingredientes i where i.restaurante_id = r.id and i.nombre = v.nombre
  );

-- ── Menú: extras (agregados de pago) ────────────────────────────────────────
insert into pos_extras (restaurante_id, nombre, precio, orden)
select r.id, v.nombre, v.precio, v.orden
from restaurantes r
cross join (values
  ('Aguacate', 30, 0), ('Chile de Árbol', 5, 1), ('Chile Habanero', 5, 2),
  ('Crema', 10, 3), ('Salsa Verde', 10, 4)
) as v(nombre, precio, orden)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from pos_extras e where e.restaurante_id = r.id and e.nombre = v.nombre
  );

-- ── Menú: orden de las categorías (Sopes primero) ───────────────────────────
insert into pos_categorias (restaurante_id, nombre, orden)
select r.id, v.nombre, v.orden
from restaurantes r
cross join (values
  ('Sopes', 0), ('Quesadillas', 1), ('Tacos Dorados', 2), ('Tortas', 3),
  ('Sincronizadas', 4), ('Burritas', 5), ('Ensaladas', 6), ('Bebidas', 7), ('Postres', 8)
) as v(nombre, orden)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from pos_categorias c where c.restaurante_id = r.id and c.nombre = v.nombre
  );

-- ── Menú: modificadores de remoción ─────────────────────────────────────────
insert into pos_modificadores (restaurante_id, nombre, orden)
select r.id, v.nombre, v.orden
from restaurantes r
cross join (values
  ('Sin Crema', 0), ('Sin Frijol', 1), ('Sin Salsa Verde', 2), ('Sin Salsa Roja', 3),
  ('Sin Queso Oaxaca', 4), ('Sin Lechuga (Romanita)', 5), ('Sin Aguacate', 6)
) as v(nombre, orden)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from pos_modificadores mo where mo.restaurante_id = r.id and mo.nombre = v.nombre
  );
