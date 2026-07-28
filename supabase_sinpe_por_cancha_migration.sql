-- ============================================================
-- SINPE por cancha: cada cancha tiene su propio SINPE Móvil
-- Run this in the Supabase SQL Editor or via psql (TellosDB.md)
-- ============================================================
--
-- Antes: src/pages/ReservaDetalles.tsx mostraba "Kathia Salas" /
-- "8616-7000" para TODAS las canchas, así que los clientes de
-- Mitad de Cuadra y de Guadalupe enviaban su adelanto del 50%
-- a la cuenta equivocada.
--
-- OJO: esto NO se puede resolver por "local". Las canchas 2 y 4
-- son ambas local = 1 (Sabana) pero usan cuentas distintas, así
-- que el dato tiene que vivir por cancha.
--
-- sinpe_numero se guarda como 8 dígitos SIN guion ("86167000").
-- El guion se agrega al mostrarlo (formatSinpe en src/lib/sinpe.ts).

-- ------------------------------------------------------------
-- 1. Columnas
-- ------------------------------------------------------------

ALTER TABLE public.canchas
  ADD COLUMN IF NOT EXISTS sinpe_nombre text,
  ADD COLUMN IF NOT EXISTS sinpe_numero text;

COMMENT ON COLUMN public.canchas.sinpe_nombre IS
  'Titular de la cuenta SINPE Móvil de esta cancha. Se muestra al cliente en /reserva/:id.';
COMMENT ON COLUMN public.canchas.sinpe_numero IS
  'Número SINPE Móvil de esta cancha: 8 dígitos sin guion ni espacios (ej. "86167000").';

-- ------------------------------------------------------------
-- 2. Backfill (antes del CHECK, a propósito)
--
--    OJO: el "WHERE ... AND sinpe_numero IS NULL" NO es adorno.
--    Los dueños pueden cambiar estos números desde /admin/canchas.
--    Si este archivo se vuelve a correr (restore, clon, staging,
--    o alguien que lo pega de nuevo en el SQL editor) sin esa
--    guarda, le pisaría los cambios sin avisar. Así solo llena
--    lo que está vacío.
-- ------------------------------------------------------------

UPDATE public.canchas SET sinpe_nombre = 'Kathia Salas',    sinpe_numero = '86167000'
  WHERE id = 2          AND sinpe_numero IS NULL;   -- Cancha Esquinera (Sabana)
UPDATE public.canchas SET sinpe_nombre = 'Sebastián Tello', sinpe_numero = '61808040'
  WHERE id = 4          AND sinpe_numero IS NULL;   -- Cancha Mitad de Cuadra (Sabana)
UPDATE public.canchas SET sinpe_nombre = 'José Tello',      sinpe_numero = '61808030'
  WHERE id IN (1,3,5,6) AND sinpe_numero IS NULL;   -- Guadalupe (Cancha 1, 2, 3 y Completa)

-- ------------------------------------------------------------
-- 3. Validación: un número mal escrito nunca debe llegar al cliente.
--    NULL sí se permite (una cancha nueva puede no tenerlo todavía);
--    en ese caso la app no muestra ningún número y le pide al
--    cliente que nos escriba, en vez de adivinar.
--
--    Los celulares de Costa Rica son 8 dígitos que empiezan en
--    6, 7 u 8. Exigirlo aquí atrapa el error más probable: pegar
--    "+506 8616-7000" y que quede "50686167" — 8 dígitos, se ve
--    válido, y es un número que no existe.
-- ------------------------------------------------------------

ALTER TABLE public.canchas DROP CONSTRAINT IF EXISTS canchas_sinpe_numero_check;
ALTER TABLE public.canchas
  ADD CONSTRAINT canchas_sinpe_numero_check
  CHECK (sinpe_numero IS NULL OR sinpe_numero ~ '^[678][0-9]{7}$');

-- Nombre y número van juntos o no van: la app no muestra nada si
-- falta uno, así que un registro a medias solo esconde el problema.
ALTER TABLE public.canchas DROP CONSTRAINT IF EXISTS canchas_sinpe_pareja_check;
ALTER TABLE public.canchas
  ADD CONSTRAINT canchas_sinpe_pareja_check
  CHECK ((nullif(btrim(coalesce(sinpe_nombre, '')), '') IS NULL) = (sinpe_numero IS NULL));

-- ------------------------------------------------------------
-- 4. RLS / grants: nada que hacer.
--    public.canchas no tiene ACLs por columna y los grants son a
--    nivel de tabla, así que las columnas nuevas ya quedan
--    cubiertas. La política "canchas update for superuser"
--    (USING/WITH CHECK is_superuser()) ya gobierna las escrituras
--    desde el panel de admin.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 5. Refrescar el cache de esquema de PostgREST.
--    Supabase lo recarga solo con un event trigger de DDL, pero
--    de forma asíncrona. Este NOTIFY lo fuerza: sin él, el SELECT
--    de abajo puede verse perfecto mientras la API REST todavía
--    responde 42703 a select=...,sinpe_nombre — y ahí el frontend
--    nuevo rompe TODAS las páginas /reserva/:id.
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 6. Verificación (SQL). Los 6 registros deben quedar llenos:
--      2       -> Kathia Salas    / 86167000
--      4       -> Sebastián Tello / 61808040
--      1,3,5,6 -> José Tello      / 61808030
--
--    Esto NO es suficiente antes de desplegar el frontend: hay que
--    comprobar la API REST también (ver el paso de despliegue).
-- ------------------------------------------------------------

SELECT id, nombre, local, sinpe_nombre, sinpe_numero,
       (sinpe_nombre IS NULL OR sinpe_numero IS NULL) AS sin_configurar
FROM public.canchas ORDER BY id;
