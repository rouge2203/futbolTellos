-- Bounded auto-retry for WhatsApp sends whose outcome we never learned, plus a
-- single aggregated admin notification once a message has exhausted every attempt.
--
-- Before this change an 'uncertain' row was terminal: wa_claim_notifications only
-- ever claimed 'pending', and the whatsapp_owner_once unique index made the
-- ON CONFLICT DO NOTHING in wa_enqueue_notifications skip that reservation on every
-- later run, so the client silently never heard from us. A transport outage on
-- 2026-10-29 stranded 11 reminders that way.
--
-- The trade-off is deliberate and was chosen by the operator: a client who gets the
-- same reminder twice is better than a client who gets none. wa_prepare_notification
-- still re-validates ownership, recipient and a recorded send before every retry, so
-- a reminder already known to have gone out is never repeated.
--
-- Idempotent. Safe to re-run.
BEGIN;

-- Claimable set now includes the unknown-outcome rows.
DROP INDEX IF EXISTS public.whatsapp_due;
CREATE INDEX whatsapp_due ON public.whatsapp_notifications USING btree (due_at)
  WHERE status IN ('pending','uncertain');

-- One open report per incident: later failures join it until staff mark it done.
CREATE OR REPLACE FUNCTION public.wa_report_failed_notification(p_reserva_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cr timestamp:=now() AT TIME ZONE 'America/Costa_Rica'; existing uuid; entry jsonb;
BEGIN
  SELECT jsonb_build_object('hora_inicio',to_char(r.hora_inicio,'YYYY-MM-DD HH24:MI:SS'),
                            'hora_fin',to_char(r.hora_fin,'YYYY-MM-DD HH24:MI:SS'),
                            'cancha_id',r.cancha_id,'cancha_nombre',c.nombre,
                            'nombre_reserva',r.nombre_reserva,'celular_reserva',r.celular_reserva)
    INTO entry
    FROM public.reservas r LEFT JOIN public.canchas c ON c.id=r.cancha_id
   WHERE r.id=p_reserva_id;
  IF entry IS NULL THEN RETURN; END IF;
  SELECT id INTO existing FROM public.notificaciones
   WHERE tipo='whatsapp_fallido' AND NOT atendida AND hora_fin>=cr-interval '3 hours'
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF existing IS NULL THEN
    INSERT INTO public.notificaciones(tipo,hora_inicio,hora_fin,fechas_canceladas,cantidad_fechas)
    VALUES('whatsapp_fallido',cr,cr,jsonb_build_array(entry),1);
  ELSE
    UPDATE public.notificaciones
       SET hora_fin=cr,fechas_canceladas=fechas_canceladas||entry,cantidad_fechas=cantidad_fechas+1
     WHERE id=existing;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.wa_claim_notifications(p_reserva_id uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS SETOF public.whatsapp_notifications LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- A worker that died mid-send is retried like any other unknown outcome.
  UPDATE public.whatsapp_notifications SET status='uncertain',last_error='Worker interrupted; retrying',due_at=now()
    WHERE status='processing' AND claimed_at<now()-interval '10 minutes';
  RETURN QUERY
  WITH candidates AS (
    SELECT n.id FROM public.whatsapp_notifications n JOIN public.reservas r ON r.id=n.reserva_id
    WHERE n.status IN ('pending','uncertain') AND n.due_at<=now() AND r.hora_inicio>now() AT TIME ZONE 'America/Costa_Rica'
      AND (p_reserva_id IS NULL OR n.reserva_id=p_reserva_id)
      AND (n.kind<>'team2_reminder' OR (SELECT team2_enabled FROM public.whatsapp_notification_settings WHERE id))
      AND (n.kind<>'owner_reminder' OR COALESCE((n.metadata->>'transfer')::boolean,false) OR extract(hour FROM now() AT TIME ZONE 'America/Costa_Rica') BETWEEN 9 AND 20)
    ORDER BY n.due_at LIMIT LEAST(GREATEST(p_limit,1),100) FOR UPDATE OF n SKIP LOCKED
  ) UPDATE public.whatsapp_notifications n SET status='processing',claimed_at=now(),attempts=attempts+1
    FROM candidates c WHERE n.id=c.id RETURNING n.*;
END; $$;

CREATE OR REPLACE FUNCTION public.wa_finish_notification(p_id uuid,p_status text,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n public.whatsapp_notifications%ROWTYPE; rid uuid; retryable boolean; outcome text;
BEGIN
  IF p_status NOT IN ('sent','failed','uncertain','pending') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  SELECT reserva_id INTO rid FROM public.whatsapp_notifications WHERE id=p_id;
  -- Match reservation->notification lock order used by ownership updates.
  PERFORM id FROM public.reservas WHERE id=rid FOR UPDATE;
  SELECT * INTO n FROM public.whatsapp_notifications WHERE id=p_id AND status='processing' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- An unknown outcome backs off exactly like an explicit transient rejection.
  retryable:=p_status IN ('pending','uncertain');
  outcome:=CASE WHEN retryable AND n.attempts>=5 THEN 'failed' ELSE p_status END;
  UPDATE public.whatsapp_notifications SET status=outcome,
    provider_message_id=p_provider_id,last_error=left(p_error,500),sent_at=CASE WHEN p_status='sent' THEN now() ELSE NULL END,
    due_at=CASE WHEN retryable THEN now()+make_interval(mins=>LEAST(60,5*power(3,n.attempts-1)::integer)) ELSE due_at END WHERE id=n.id;
  IF p_status='sent' AND n.kind='owner_reminder' THEN
    UPDATE public.reservas SET whatsapp_enviado=true,whatsapp_recordatorio_enviado_at=now(),whatsapp_recordatorio_message_id=p_provider_id
    WHERE id=n.reserva_id AND whatsapp_owner_version=n.owner_version AND public.wa_phone(celular_reserva)=n.recipient;
  END IF;
  IF outcome='failed' THEN PERFORM public.wa_report_failed_notification(n.reserva_id); END IF;
END; $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT format('public.%I(%s)',p.proname,pg_get_function_identity_arguments(p.oid)) AS signature
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND p.proname IN ('wa_claim_notifications','wa_finish_notification','wa_report_failed_notification') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
