-- Bebidas → picker de SABOR (como las tortillas de los tacos).
-- El "Refresco" pasa de un solo tier "Único $40" a 11 sabores (variantes), todos a $40.
-- seed.sql solo INSERTA filas nuevas (not exists), así que para una base ya sembrada hay
-- que ACTUALIZAR la fila existente. Idempotente: se puede correr varias veces.
update platillos p
set tortillas   = '[{"id":"coca-cola-regular","nombre":"Coca Cola Regular","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"coca-cola-light","nombre":"Coca Cola Light","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"coca-cola-sin-azucar","nombre":"Coca Cola Sin Azúcar","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"fanta","nombre":"Fanta","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"cebada","nombre":"Cebada","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"bebi","nombre":"Bebi","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"agua-de-horchata","nombre":"Agua de Horchata","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"agua-de-jamaica","nombre":"Agua de Jamaica","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"jamaica-con-canela-y-limon-sin-azucar","nombre":"Jamaica con Canela y Limón sin Azúcar","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"te-negro-stevia","nombre":"Té Negro Stevia","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]},{"id":"agua-purificada","nombre":"Agua Purificada","tiers":[{"ingredientes":0,"nombre":"Único","precio":40}]}]'::jsonb,
    tiers       = '[]'::jsonb,
    base        = 'Elige tu sabor',
    descripcion = 'Elige tu sabor',
    precio      = 40
from restaurantes r
where p.restaurante_id = r.id
  and r.nombre = 'Jardín Balbuena'
  and p.nombre = 'Refresco';
