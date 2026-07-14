-- ============================================================================
-- pos-balbuena · datos iniciales sobre el backend de tali
-- Correr después de schema.sql. Idempotente: se puede volver a correr sin duplicar.
-- Crea el restaurante del POS y sus mesas/meseros usando las tablas de tali.
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

-- 3 meseros con sus mesas asignadas y PIN de 4 dígitos
insert into meseros (restaurante_id, nombre, mesas, pin)
select r.id, v.nombre, v.mesas, v.pin
from restaurantes r
cross join (values
  ('Doña Rosa', array['1','2','3','4','5'],      '1111'),
  ('Don Beto',  array['6','7','8','9','10'],     '2222'),
  ('Lupita',    array['11','12','13','14','15'], '3333')
) as v(nombre, mesas, pin)
where r.nombre = 'Jardín Balbuena'
  and not exists (
    select 1 from meseros m where m.restaurante_id = r.id and m.nombre = v.nombre
  );
