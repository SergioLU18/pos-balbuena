-- ============================================================================
-- pos-balbuena · datos iniciales (mesas y meseros)
-- Correr después de schema.sql. Idempotente: se puede volver a correr sin duplicar.
-- Refleja los datos que antes vivían en src/lib/mockMesas.js y src/lib/mockMeseros.js.
-- ============================================================================

-- 15 mesas (números "1".."15")
insert into pos_mesas (numero)
select generate_series(1, 15)::text
on conflict (numero) do nothing;

-- 3 meseros con sus mesas asignadas y PIN de 4 dígitos (idempotente por nombre)
insert into pos_meseros (nombre, mesas, pin)
select v.nombre, v.mesas, v.pin
from (values
  ('Doña Rosa', array['1','2','3','4','5'],      '1111'),
  ('Don Beto',  array['6','7','8','9','10'],     '2222'),
  ('Lupita',    array['11','12','13','14','15'], '3333')
) as v(nombre, mesas, pin)
where not exists (select 1 from pos_meseros m where m.nombre = v.nombre);

-- Backfill del PIN para filas ya existentes que aún no lo tengan.
update pos_meseros set pin = '1111' where nombre = 'Doña Rosa' and pin is null;
update pos_meseros set pin = '2222' where nombre = 'Don Beto'  and pin is null;
update pos_meseros set pin = '3333' where nombre = 'Lupita'    and pin is null;
