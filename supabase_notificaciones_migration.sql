-- ============================================================
-- Notificaciones Migration: admin alerts for cancelled
-- reservations that had an arbitro (referee service)
-- Run this in the Supabase SQL Editor or via psql (TellosDB.md)
-- ============================================================
--
-- Cancellation in this app is a HARD DELETE on public.reservas,
-- so notifications are created by a statement-level AFTER DELETE
-- trigger and carry a fully denormalized snapshot (NO foreign key
-- to reservas: the row is already gone when the notification is
-- born; cancha/fija ids are informational only).

-- ------------------------------------------------------------
-- 1. Table + indexes
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  tipo                text NOT NULL DEFAULT 'cancelacion_arbitro',

  -- Snapshot of the cancelled reservation(s)
  nombre_reserva      text,
  celular_reserva     text,
  correo_reserva      text,
  cancha_id           bigint,
  cancha_nombre       text,
  cancha_local        smallint,      -- 1 = Sabana, 2 = Guadalupe
  precio              integer,
  hora_inicio         timestamp,     -- naive local CR time (earliest occurrence when grouped)
  hora_fin            timestamp,

  -- Fija metadata (NULL for one-off reservations)
  reservacion_fija_id bigint,
  fija_nombre         text,
  fija_dia            smallint,
  fija_hora_inicio    time,
  fija_hora_fin       time,

  -- All cancelled occurrences (uniform: 1 element for single cancellations)
  fechas_canceladas   jsonb NOT NULL DEFAULT '[]'::jsonb,
  cantidad_fechas     integer NOT NULL DEFAULT 1,

  -- Global "done" state shared by all admins
  atendida            boolean NOT NULL DEFAULT false,
  atendida_por        text,          -- admin email
  atendida_at         timestamptz
);

COMMENT ON TABLE public.notificaciones IS
  'Notificaciones para admins. Snapshot denormalizado: NO tiene FK a reservas porque la cancelación es un hard delete.';

CREATE INDEX IF NOT EXISTS idx_notificaciones_pendientes
  ON public.notificaciones (created_at DESC)
  WHERE atendida = false;

CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at
  ON public.notificaciones (created_at DESC);

-- ------------------------------------------------------------
-- 2. Trigger: one notification per delete statement per fija
--    (single deletes -> one row each; the ReservaFija cascade,
--    which deletes all future occurrences in ONE statement,
--    collapses into one grouped row with all dates in jsonb)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_cancelacion_arbitro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now_cr timestamp := (now() AT TIME ZONE 'America/Costa_Rica');
BEGIN
  INSERT INTO public.notificaciones (
    tipo,
    nombre_reserva, celular_reserva, correo_reserva,
    cancha_id, cancha_nombre, cancha_local,
    precio, hora_inicio, hora_fin,
    reservacion_fija_id, fija_nombre, fija_dia, fija_hora_inicio, fija_hora_fin,
    fechas_canceladas, cantidad_fechas
  )
  SELECT
    'cancelacion_arbitro',
    min(d.nombre_reserva),
    min(d.celular_reserva),
    min(d.correo_reserva),
    -- Cancha snapshot taken from the SAME (earliest) occurrence so the three
    -- values stay consistent even if a fija's dates span different canchas.
    (array_agg(d.cancha_id ORDER BY d.hora_inicio, d.id))[1],
    (array_agg(c.nombre    ORDER BY d.hora_inicio, d.id))[1],
    (array_agg(c.local     ORDER BY d.hora_inicio, d.id))[1],
    min(d.precio),
    min(d.hora_inicio),          -- earliest cancelled occurrence
    min(d.hora_fin),
    d.reservacion_fija_id,
    min(f.nombre_reserva_fija),
    min(f.dia),
    min(f.hora_inicio),
    min(f.hora_fin),
    jsonb_agg(
      jsonb_build_object(
        'hora_inicio',   to_char(d.hora_inicio, 'YYYY-MM-DD HH24:MI:SS'),
        'hora_fin',      to_char(d.hora_fin,    'YYYY-MM-DD HH24:MI:SS'),
        'cancha_id',     d.cancha_id,
        'cancha_nombre', c.nombre
      ) ORDER BY d.hora_inicio
    ),
    count(*)::int
  FROM deleted_rows d
  LEFT JOIN public.canchas        c ON c.id = d.cancha_id
  LEFT JOIN public.reservas_fijas f ON f.id = d.reservacion_fija_id
  WHERE d.arbitro IS TRUE
    AND d.hora_inicio > v_now_cr   -- future occurrences only
  GROUP BY COALESCE(d.reservacion_fija_id::text, d.id::text),
           d.reservacion_fija_id;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Never break a cancellation because notification logging failed.
    RAISE WARNING 'notify_cancelacion_arbitro failed: % (%)', SQLERRM, SQLSTATE;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cancelacion_arbitro ON public.reservas;

CREATE TRIGGER trg_notify_cancelacion_arbitro
  AFTER DELETE ON public.reservas
  REFERENCING OLD TABLE AS deleted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.notify_cancelacion_arbitro();

-- ------------------------------------------------------------
-- 3. RLS + grants
--    Only logged-in users (in this app: admins) can read;
--    only the atendida-* columns are writable by them.
--    No INSERT/DELETE policies: rows are created exclusively by
--    the SECURITY DEFINER trigger (owner bypasses RLS).
--    NOTE: USING (true) exposes the client snapshot (name/phone/
--    email) to ANY authenticated user - fine today because only
--    admins get auth accounts in this app.
-- ------------------------------------------------------------

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notificaciones FROM anon;
REVOKE ALL ON public.notificaciones FROM authenticated;
GRANT SELECT ON public.notificaciones TO authenticated;
GRANT UPDATE (atendida, atendida_por, atendida_at) ON public.notificaciones TO authenticated;

DROP POLICY IF EXISTS "notificaciones select for authenticated" ON public.notificaciones;
CREATE POLICY "notificaciones select for authenticated"
  ON public.notificaciones FOR SELECT
  TO authenticated
  USING (true);

-- WITH CHECK (atendida = true): "done" is terminal — an admin can mark a
-- notification done but not un-mark one back to pending.
DROP POLICY IF EXISTS "notificaciones update atendida for authenticated" ON public.notificaciones;
CREATE POLICY "notificaciones update atendida for authenticated"
  ON public.notificaciones FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (atendida = true);

-- ------------------------------------------------------------
-- 4. Realtime (badge/list live updates in the admin panel)
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END $$;
