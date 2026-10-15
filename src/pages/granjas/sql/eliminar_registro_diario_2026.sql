-- Ejecutar en el SQL Editor de Supabase del proyecto correspondiente.
-- Alcance: todas las granjas, por fecha del registro productivo.
BEGIN;

SELECT count(*) AS registros_2026_antes
FROM public.registro_diario_granja
WHERE "Fecha" >= DATE '2026-01-01'
  AND "Fecha" < DATE '2027-01-01';

WITH eliminados AS (
  DELETE FROM public.registro_diario_granja
  WHERE "Fecha" >= DATE '2026-01-01'
    AND "Fecha" < DATE '2027-01-01'
  RETURNING id
)
SELECT count(*) AS registros_eliminados FROM eliminados;

SELECT count(*) AS registros_2026_restantes
FROM public.registro_diario_granja
WHERE "Fecha" >= DATE '2026-01-01'
  AND "Fecha" < DATE '2027-01-01';

COMMIT;
