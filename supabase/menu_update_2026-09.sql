-- ============================================================================
-- pos-balbuena · Actualización de menú (fotos Jardín Balbuena, sep 2026)
-- ----------------------------------------------------------------------------
-- Corre DESPUÉS de schema.sql + admin_menu.sql + seed.sql, sobre datos ya
-- sembrados. A diferencia de seed.sql (guardado con `not exists`, solo alta),
-- este script hace UPDATE de filas existentes + alta de lo que faltaba.
-- Idempotente: se puede volver a correr.
--
-- Cambios vs. lo que había cargado:
--   1. Todos los precios de platillos bajan $5 en cada nivel.
--   2. Ensalada: se agregan los niveles "Sencilla" y "3 Ingredientes".
--   3. Bebidas: se dan de alta Aguas Frescas, Agua Mineral, Té Negro y
--      Agua Purificada (antes solo existía "Refresco").
--   4. Extras: se agrega "Para Llevar" (+$5 por producto).
--   5. Descripciones base alineadas al texto de las fotos.
--   6. (Opcional, ver abajo) Torta "Con Queso +$30".
-- ============================================================================

-- ── 1. Platillos: tiers, precio plano (mínimo) y descripción base ───────────

update platillos p set
  tiers = '[{"ingredientes":0,"nombre":"Sencillo","precio":105},{"ingredientes":0,"nombre":"Sencillo con Chorizo","precio":115},{"ingredientes":1,"nombre":"1 Ingrediente","precio":135},{"ingredientes":2,"nombre":"2 Ingredientes","precio":160},{"ingredientes":3,"nombre":"3 Ingredientes","precio":185}]'::jsonb,
  precio = 105,
  base = 'Tortilla de maíz de gran tamaño hecha a mano, con frijol y salsa verde de la casa, romanita, crema y queso oaxaca',
  descripcion = 'Tortilla de maíz de gran tamaño hecha a mano, con frijol y salsa verde de la casa, romanita, crema y queso oaxaca'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Sope';

update platillos p set
  tiers = '[{"ingredientes":0,"nombre":"Sencilla","precio":115},{"ingredientes":1,"nombre":"1 Ingrediente","precio":135},{"ingredientes":2,"nombre":"2 Ingredientes","precio":160},{"ingredientes":3,"nombre":"3 Ingredientes","precio":185}]'::jsonb,
  precio = 115,
  base = 'Gran tortilla de maíz frita hecha a mano, rellena de queso oaxaca. Se sugiere bañarla en salsa verde y crema',
  descripcion = 'Gran tortilla de maíz frita hecha a mano, rellena de queso oaxaca. Se sugiere bañarla en salsa verde y crema'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Quesadilla';

update platillos p set
  tiers = '[]'::jsonb,
  tortillas = '[{"id":"maiz","nombre":"Tortilla de Maíz","tiers":[{"ingredientes":1,"nombre":"1 Ingrediente","precio":145},{"ingredientes":2,"nombre":"2 Ingredientes","precio":170}]},{"id":"harina","nombre":"Tortilla de Harina","tiers":[{"ingredientes":1,"nombre":"1 Ingrediente","precio":170},{"ingredientes":2,"nombre":"2 Ingredientes","precio":195}]}]'::jsonb,
  precio = 145,
  base = 'Orden de 3 tacos dorados bañados con salsa verde, romanita, crema y queso oaxaca (surtidos +$15)',
  descripcion = 'Orden de 3 tacos dorados bañados con salsa verde, romanita, crema y queso oaxaca (surtidos +$15)'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Tacos Dorados';

update platillos p set
  tiers = '[{"ingredientes":1,"nombre":"1 Ingrediente","precio":155},{"ingredientes":2,"nombre":"2 Ingredientes","precio":185},{"ingredientes":3,"nombre":"3 Ingredientes","precio":215}]'::jsonb,
  precio = 155,
  base = 'Pan horneado de gran tamaño con frijol, crema y aguacate',
  descripcion = 'Pan horneado de gran tamaño con frijol, crema y aguacate'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Torta';

update platillos p set
  tiers = '[{"ingredientes":0,"nombre":"Sencilla","precio":105},{"ingredientes":1,"nombre":"1 Ingrediente","precio":125},{"ingredientes":2,"nombre":"2 Ingredientes","precio":150},{"ingredientes":3,"nombre":"3 Ingredientes","precio":175}]'::jsonb,
  precio = 105,
  base = 'Tortilla de maíz con queso oaxaca. Bañada con aguacate, salsa roja y crema',
  descripcion = 'Tortilla de maíz con queso oaxaca. Bañada con aguacate, salsa roja y crema'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Sincronizada';

update platillos p set
  tiers = '[{"ingredientes":0,"nombre":"Sencilla","precio":115},{"ingredientes":1,"nombre":"1 Ingrediente","precio":135},{"ingredientes":2,"nombre":"2 Ingredientes","precio":160},{"ingredientes":3,"nombre":"3 Ingredientes","precio":185}]'::jsonb,
  precio = 115,
  base = 'Tortilla de harina con queso oaxaca. Bañada con aguacate, salsa roja y crema',
  descripcion = 'Tortilla de harina con queso oaxaca. Bañada con aguacate, salsa roja y crema'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Burrita';

update platillos p set
  tiers = '[{"ingredientes":0,"nombre":"Sencilla","precio":115},{"ingredientes":1,"nombre":"1 Ingrediente","precio":145},{"ingredientes":2,"nombre":"2 Ingredientes","precio":175},{"ingredientes":3,"nombre":"3 Ingredientes","precio":205}]'::jsonb,
  precio = 115,
  base = 'A base de romanita, salsa verde, crema y queso oaxaca',
  descripcion = 'A base de romanita, salsa verde, crema y queso oaxaca'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Ensalada';

-- Refresco: precio igual ($40), solo se alinea la descripción a la foto.
update platillos p set
  base = 'Refresco en botella (Coca Cola regular/light/sin azúcar, Fanta, Sprite, Cristal Fresa, Cebada, Sidra Negra, Mundet, Fresca, Bebi)',
  descripcion = 'Refresco en botella (Coca Cola regular/light/sin azúcar, Fanta, Sprite, Cristal Fresa, Cebada, Sidra Negra, Mundet, Fresca, Bebi)'
from restaurantes r
where p.restaurante_id = r.id and r.nombre = 'Jardín Balbuena' and p.nombre = 'Refresco';

-- Flan: precio ($70) y descripción sin cambios.

-- ── 2. Bebidas que faltaban (alta idempotente por nombre) ───────────────────
insert into platillos (restaurante_id, nombre, categoria, descripcion, precio, base, tiers, tortillas, permite_mitades, permite_nota, activo)
select r.id, v.nombre, 'Bebidas', v.base, v.precio, v.base, v.tiers::jsonb, null, false, false, true
from restaurantes r
cross join (values
  ('Aguas Frescas', 'Horchata o jamaica; jamaica con canela y limón, sin azúcar', 40,
    '[{"ingredientes":0,"nombre":"Único","precio":40}]'),
  ('Agua Mineral', 'Agua mineral en botella', 45,
    '[{"ingredientes":0,"nombre":"Único","precio":45}]'),
  ('Té Negro', 'Té negro con stevia', 40,
    '[{"ingredientes":0,"nombre":"Único","precio":40}]'),
  ('Agua Purificada', 'Agua purificada en botella', 40,
    '[{"ingredientes":0,"nombre":"Único","precio":40}]')
) as v(nombre, base, precio, tiers)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from platillos p where p.restaurante_id = r.id and p.nombre = v.nombre
  );

-- ── 3. Extra "Para Llevar" (+$5 por producto) ──────────────────────────────
insert into pos_extras (restaurante_id, nombre, precio, orden)
select r.id, 'Para Llevar', 5, 5
from restaurantes r
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from pos_extras e where e.restaurante_id = r.id and e.nombre = 'Para Llevar'
  );

-- ── 4. (OPCIONAL) Torta "Con Queso +$30" ───────────────────────────────────
-- El menú ofrece este cargo SOLO para la Torta, pero pos_extras es un catálogo
-- global (aparece en todos los platillos). Descomenta si prefieres tenerlo como
-- extra global; si no, se maneja como nota del mesero.
-- insert into pos_extras (restaurante_id, nombre, precio, orden)
-- select r.id, 'Con Queso (Torta)', 30, 6
-- from restaurantes r
-- where r.nombre = 'Jardín Balbuena'
--   and not exists (
--     select 1 from pos_extras e where e.restaurante_id = r.id and e.nombre = 'Con Queso (Torta)'
--   );
