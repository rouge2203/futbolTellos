-- All fixtures and notification claims roll back. No network send occurs.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE r uuid; t uuid; n uuid; event text; res jsonb; ctx jsonb; total integer; f bigint; freq integer;
BEGIN
  ASSERT NOT has_function_privilege('authenticated','public.wa_reservation_action(uuid,text,text,text,integer)','EXECUTE'), 'actions restricted to backend';
  ASSERT NOT has_table_privilege('authenticated','public.whatsapp_notifications','SELECT'), 'queue is private';
  UPDATE public.whatsapp_notification_settings SET team2_enabled=true;
  INSERT INTO public.reservas(hora_inicio,hora_fin,cancha_id,nombre_reserva,celular_reserva,correo_reserva,precio,arbitro,fut)
  VALUES('2099-06-15 08:00','2099-06-15 09:00',6,'Owner QA','88880001','qa@example.invalid',47000,true,8) RETURNING id INTO r;
  INSERT INTO public.retos(reserva_id,equipo1_nombre,equipo2_encargado,equipo2_celular,equipo2_nombre)
  VALUES(r,'Original team','New QA','88880002','New team') RETURNING id INTO t;
  INSERT INTO public.pagos(reserva_id,monto_efectivo,monto_sinpe,completo) VALUES(r,5000,0,false);
  UPDATE public.reservas SET whatsapp_enviado=true,whatsapp_recordatorio_enviado_at=now()-interval '2 hours'+interval '1 second' WHERE id=r;
  PERFORM public.wa_enqueue_notifications();
  SELECT id INTO n FROM public.whatsapp_notifications WHERE reserva_id=r AND kind='team2_reminder';
  ASSERT n IS NOT NULL, 'team 2 queued after owner acceptance';
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=0, 'not before two hours';
  UPDATE public.reservas SET whatsapp_recordatorio_enviado_at=now()-interval '2 hours' WHERE id=r;
  UPDATE public.whatsapp_notifications SET due_at=now() WHERE id=n;
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=1, 'eligible at two-hour boundary, no quiet-hours gate';
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=0, 'claimed only once';
  ctx:=public.wa_prepare_notification(n);
  ASSERT ctx->'reservation'->>'precio'='47000' AND ctx->'reto'->>'equipo2_encargado'='New QA', 'fresh render context';
  -- A claimed message must not send after the team is removed.
  PERFORM public.quitar_oponente_reto(t,2);
  ASSERT public.wa_prepare_notification(n) IS NULL, 'removed team invalidates claimed send';
  ASSERT (SELECT status='uncertain' FROM public.whatsapp_notifications WHERE id=n), 'in-flight recipient change cannot safely retry';
  -- This mocked sender never dispatched; release the known-unsent fixture only.
  UPDATE public.whatsapp_notifications SET status='cancelled' WHERE id=n;
  UPDATE public.retos SET equipo2_encargado='New QA',equipo2_celular='88880002',equipo2_nombre='New team' WHERE id=t;
  PERFORM public.wa_enqueue_notifications();
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=1, 'unsent returning recipient can be requeued';
  PERFORM public.wa_finish_notification(n,'sent','qa-provider-team2',NULL);
  PERFORM public.wa_enqueue_notifications();
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=0, 'sent team 2 is not duplicated';
  -- Wrong sender and stale version cannot cancel or confirm.
  res:=public.wa_reservation_action(r,'50688889999','cancel','qa-wrong-'||r,0);
  ASSERT res->>'status'='stale' AND EXISTS(SELECT 1 FROM public.reservas WHERE id=r), 'sender guard';
  res:=public.wa_reservation_action(r,'50688880001','cancel','qa-transfer-'||r,0);
  ASSERT res->>'status'='transferred', 'WhatsApp withdrawal transfers';
  ASSERT (SELECT nombre_reserva='New QA' AND celular_reserva='88880002' AND correo_reserva IS NULL AND precio=47000 AND arbitro AND fut=8 AND hora_inicio='2099-06-15 08:00' AND whatsapp_owner_version=1 AND whatsapp_enviado IS NULL AND whatsapp_confirmada IS NULL AND whatsapp_recordatorio_enviado_at IS NULL FROM public.reservas WHERE id=r), 'booking preserved and ownership tracking reset';
  ASSERT (SELECT equipo1_nombre='New team' AND equipo1_encargado='New QA' AND equipo2_encargado IS NULL AND equipo2_celular IS NULL FROM public.retos WHERE id=t), 'reto reopened';
  ASSERT (SELECT count(*) FROM public.pagos WHERE reserva_id=r)=1, 'payment retained';
  ASSERT (SELECT count(*) FROM public.whatsapp_notifications WHERE reserva_id=r AND owner_version=1 AND status='pending')=2, 'new owner plus admin immediately queued';
  res:=public.wa_reservation_action(r,'50688880001','cancel','qa-transfer-'||r,0);
  ASSERT res->>'status'='duplicate', 'duplicate webhook does not transfer twice';
  res:=public.wa_reservation_action(r,'50688880001','confirm','qa-old-owner-'||r,0);
  ASSERT res->>'status'='stale', 'former owner buttons rejected';
  PERFORM public.wa_claim_notifications(r,10);
  SELECT id INTO n FROM public.whatsapp_notifications WHERE reserva_id=r AND owner_version=1 AND kind='owner_reminder';
  ASSERT public.wa_prepare_notification(n)->'notification'->>'recipient'='50688880002', 'new owner gets confirmation request';
  PERFORM public.wa_finish_notification(n,'sent','qa-provider-owner',NULL);
  ASSERT (SELECT whatsapp_recordatorio_enviado_at=now() AND whatsapp_recordatorio_message_id='qa-provider-owner' AND whatsapp_enviado FROM public.reservas WHERE id=r), 'new timer persisted after send only';
  UPDATE public.retos SET equipo2_encargado='Third QA',equipo2_celular='88880003' WHERE id=t;
  PERFORM public.wa_enqueue_notifications();
  SELECT id INTO n FROM public.whatsapp_notifications WHERE reserva_id=r AND kind='team2_reminder' AND recipient='50688880003';
  ASSERT (SELECT due_at=now()+interval '2 hours' FROM public.whatsapp_notifications WHERE id=n), 'fresh timer for new rival';
  -- Critical regression: owner's message is already sent, then full cancellation.
  DELETE FROM public.reservas WHERE id=r;
  ASSERT NOT EXISTS(SELECT 1 FROM public.retos WHERE id=t), 'full reservation deletion cascades reto';
  ASSERT NOT EXISTS(SELECT 1 FROM public.whatsapp_notifications WHERE reserva_id=r), 'all notifications removed on full cancellation';
  ASSERT public.wa_prepare_notification(n) IS NULL, 'cannot prepare after cancellation';
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=0, 'no later reminder after cancellation';

  -- Admin promotion uses the same atomic notification path; fixed parent unaffected.
  FOREACH freq IN ARRAY ARRAY[1,2] LOOP
    INSERT INTO public.reservas_fijas(nombre_reserva_fija,celular_reserva_fija,cancha_id,dia,hora_inicio,hora_fin,precio,arbitro,frecuencia_semanas,fecha_inicio,es_reto,fut)
    VALUES('Fixed QA','88880001',6,1,make_time(8+freq,0,0),make_time(9+freq,0,0),45000,false,freq,'2099-06-15',true,8) RETURNING id INTO f;
    INSERT INTO public.reservas(reservacion_fija_id,hora_inicio) VALUES(f,'2099-06-15'::date+make_time(8+freq,0,0)) RETURNING id INTO r;
    SELECT id INTO t FROM public.retos WHERE reserva_id=r;
    UPDATE public.retos SET equipo2_encargado='Fixed rival QA',equipo2_celular='88880002' WHERE id=t;
    PERFORM public.quitar_oponente_reto(t,1);
    ASSERT (SELECT nombre_reserva_fija='Fixed QA' AND frecuencia_semanas=freq FROM public.reservas_fijas WHERE id=f), 'parent schedule remains owned by original team';
    ASSERT (SELECT nombre_reserva='Fixed rival QA' AND reservacion_fija_id=f FROM public.reservas WHERE id=r), 'only occurrence transfers';
    ASSERT EXISTS(SELECT 1 FROM public.whatsapp_notifications WHERE reserva_id=r AND kind='owner_reminder' AND metadata->>'transfer'='true'), 'admin transfer queues immediate confirmation';
    -- Failed send does not cancel booking or undo promotion.
    PERFORM public.wa_claim_notifications(r,10);
    SELECT id INTO n FROM public.whatsapp_notifications WHERE reserva_id=r AND kind='owner_reminder';
    PERFORM public.wa_finish_notification(n,'uncertain',NULL,'Timeout');
    ASSERT EXISTS(SELECT 1 FROM public.reservas WHERE id=r AND nombre_reserva='Fixed rival QA'), 'send failure does not undo transfer';
    ASSERT (SELECT status='uncertain' AND due_at=now()+interval '5 minutes' FROM public.whatsapp_notifications WHERE id=n), 'uncertain send waits for the backoff instead of stranding';
    -- Upcoming-series deletion uses the same child deletion safeguard.
    DELETE FROM public.reservas WHERE reservacion_fija_id=f;
    DELETE FROM public.reservas_fijas WHERE id=f;
    ASSERT NOT EXISTS(SELECT 1 FROM public.retos WHERE id=t), 'series child deletion removes reto';
    ASSERT NOT EXISTS(SELECT 1 FROM public.whatsapp_notifications WHERE reserva_id=r), 'series child deletion removes queue';
  END LOOP;

  INSERT INTO public.reservas(hora_inicio,hora_fin,cancha_id,nombre_reserva,celular_reserva,precio)
    VALUES('2099-06-16 08:00','2099-06-16 09:00',2,'Solo QA','88880001',23000) RETURNING id INTO r;
  INSERT INTO public.retos(reserva_id) VALUES(r) RETURNING id INTO t;
  res:=public.wa_reservation_action(r,'88880001','cancel','qa-solo-'||r,0);
  ASSERT res->>'status'='cancelled' AND NOT EXISTS(SELECT 1 FROM public.reservas WHERE id=r) AND NOT EXISTS(SELECT 1 FROM public.retos WHERE id=t), 'without rival cancels fully';
  -- Late assignment, normalized owner exclusion, invalid recipients and match expiry.
  INSERT INTO public.reservas(hora_inicio,hora_fin,cancha_id,nombre_reserva,celular_reserva,precio,whatsapp_enviado,whatsapp_recordatorio_enviado_at)
  VALUES('2099-06-17 08:00','2099-06-17 09:00',2,'Late QA','88880001',23000,true,now()-interval '3 hours') RETURNING id INTO r;
  INSERT INTO public.retos(reserva_id) VALUES(r) RETURNING id INTO t;
  PERFORM public.wa_enqueue_notifications();
  ASSERT NOT EXISTS(SELECT 1 FROM public.whatsapp_notifications WHERE reserva_id=r), 'no opponent means no message';
  UPDATE public.retos SET equipo2_encargado='Late rival',equipo2_celular='123' WHERE id=t;
  PERFORM public.wa_enqueue_notifications();
  ASSERT NOT EXISTS(SELECT 1 FROM public.whatsapp_notifications WHERE reserva_id=r), 'invalid phone skipped';
  UPDATE public.retos SET equipo2_celular='+506 8888-0001' WHERE id=t;
  PERFORM public.wa_enqueue_notifications();
  ASSERT NOT EXISTS(SELECT 1 FROM public.whatsapp_notifications WHERE reserva_id=r), 'owner phone skipped after normalization';
  UPDATE public.retos SET equipo2_celular='88880002' WHERE id=t;
  PERFORM public.wa_enqueue_notifications();
  SELECT id INTO n FROM public.whatsapp_notifications WHERE reserva_id=r;
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=1, 'late assignment immediately due';
  PERFORM public.wa_finish_notification(n,'pending',NULL,'Explicit temporary rejection');
  ASSERT (SELECT due_at=now()+interval '5 minutes' AND attempts=1 FROM public.whatsapp_notifications WHERE id=n), 'explicit failure backs off';
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=0, 'no early retry';
  UPDATE public.whatsapp_notifications SET status='processing',claimed_at=now()-interval '11 minutes' WHERE id=n;
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=1, 'interrupted claim is swept back and retried';
  ASSERT (SELECT status='processing' AND attempts=2 FROM public.whatsapp_notifications WHERE id=n), 'the retry counts as an attempt';
  UPDATE public.whatsapp_notifications SET status='pending',due_at=now() WHERE id=n;
  UPDATE public.reservas SET hora_inicio='2000-06-17 08:00',hora_fin='2000-06-17 09:00' WHERE id=r;
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=0, 'expired match not dispatched';
  PERFORM public.eliminar_reto(t);
  ASSERT NOT EXISTS(SELECT 1 FROM public.reservas WHERE id=r) AND NOT EXISTS(SELECT 1 FROM public.whatsapp_notifications WHERE reserva_id=r), 'admin reto deletion removes booking and notifications';

  -- A transport failure retries on the bounded backoff rather than stranding the client.
  INSERT INTO public.reservas(hora_inicio,hora_fin,cancha_id,nombre_reserva,celular_reserva,precio)
  VALUES('2099-06-18 08:00','2099-06-18 09:00',2,'Retry QA','88880004',23000) RETURNING id INTO r;
  INSERT INTO public.whatsapp_notifications(reserva_id,kind,owner_version,recipient,due_at,metadata)
  VALUES(r,'owner_reminder',0,public.wa_phone('88880004'),now(),'{"transfer":true}') RETURNING id INTO n;
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=1, 'reminder claimed for its first attempt';
  PERFORM public.wa_finish_notification(n,'uncertain',NULL,'Transport failure; provider acceptance unknown');
  ASSERT (SELECT status='uncertain' AND attempts=1 AND due_at=now()+interval '5 minutes' FROM public.whatsapp_notifications WHERE id=n), 'transport failure schedules a retry';
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=0, 'no retry before the backoff elapses';
  UPDATE public.whatsapp_notifications SET due_at=now() WHERE id=n;
  ASSERT (SELECT count(*) FROM public.wa_claim_notifications(r,10))=1, 'uncertain send retried once due';
  ASSERT NOT EXISTS(SELECT 1 FROM public.notificaciones WHERE tipo='whatsapp_fallido'), 'a retryable failure alerts nobody';

  -- Exhausting every attempt is terminal and raises exactly one admin notification.
  UPDATE public.whatsapp_notifications SET attempts=5 WHERE id=n;
  PERFORM public.wa_finish_notification(n,'uncertain',NULL,'Transport failure; provider acceptance unknown');
  ASSERT (SELECT status='failed' FROM public.whatsapp_notifications WHERE id=n), 'retries stop after five attempts';
  ASSERT (SELECT count(*) FROM public.notificaciones WHERE tipo='whatsapp_fallido' AND NOT atendida)=1, 'exhausted send raises an admin notification';
  ASSERT (SELECT cantidad_fechas=1 AND jsonb_array_length(fechas_canceladas)=1 AND hora_fin>=hora_inicio FROM public.notificaciones WHERE tipo='whatsapp_fallido' AND NOT atendida), 'one reserva and a failure window reported';

  -- Further failures join the open report instead of spamming the bell.
  INSERT INTO public.reservas(hora_inicio,hora_fin,cancha_id,nombre_reserva,celular_reserva,precio)
  VALUES('2099-06-19 08:00','2099-06-19 09:00',2,'Retry QA dos','88880005',23000) RETURNING id INTO r;
  INSERT INTO public.whatsapp_notifications(reserva_id,kind,owner_version,recipient,due_at,metadata,attempts)
  VALUES(r,'owner_reminder',0,public.wa_phone('88880005'),now(),'{"transfer":true}',5) RETURNING id INTO n;
  PERFORM public.wa_claim_notifications(r,10);
  PERFORM public.wa_finish_notification(n,'uncertain',NULL,'Transport failure; provider acceptance unknown');
  ASSERT (SELECT count(*) FROM public.notificaciones WHERE tipo='whatsapp_fallido' AND NOT atendida)=1, 'failures aggregate into one open report';
  ASSERT (SELECT cantidad_fechas=2 AND jsonb_array_length(fechas_canceladas)=2 FROM public.notificaciones WHERE tipo='whatsapp_fallido' AND NOT atendida), 'both reservas listed in the open report';

  -- Once staff mark the report done, a later failure opens a fresh one.
  UPDATE public.notificaciones SET atendida=true WHERE tipo='whatsapp_fallido';
  INSERT INTO public.reservas(hora_inicio,hora_fin,cancha_id,nombre_reserva,celular_reserva,precio)
  VALUES('2099-06-20 08:00','2099-06-20 09:00',2,'Retry QA tres','88880006',23000) RETURNING id INTO r;
  INSERT INTO public.whatsapp_notifications(reserva_id,kind,owner_version,recipient,due_at,metadata,attempts)
  VALUES(r,'owner_reminder',0,public.wa_phone('88880006'),now(),'{"transfer":true}',5) RETURNING id INTO n;
  PERFORM public.wa_claim_notifications(r,10);
  PERFORM public.wa_finish_notification(n,'uncertain',NULL,'Transport failure; provider acceptance unknown');
  ASSERT (SELECT count(*) FROM public.notificaciones WHERE tipo='whatsapp_fallido')=2, 'an attended report is not reopened';
  ASSERT (SELECT cantidad_fechas=1 FROM public.notificaciones WHERE tipo='whatsapp_fallido' AND NOT atendida), 'the fresh report starts its own count';

  RAISE NOTICE 'WhatsApp queue, transfer, ownership, cancellation and recurring assertions passed';
END; $$;
ROLLBACK;
