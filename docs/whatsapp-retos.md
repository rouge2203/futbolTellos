# WhatsApp reto reminders and ownership

Database migrations: `supabase_whatsapp_retos_migration.sql` and `supabase_whatsapp_reintentos_migration.sql` (bounded retry for unknown outcomes plus the `whatsapp_fallido` admin report) in this project. Backend implementation lives in the sibling `django-lobster-backend/lobster_api/whatsapp_notifications.py` and `tellos_whatsapp_views.py`.

The migration was applied on 2026-09-23. The Spanish Utility template `reto_team2_reminder` was approved in Dualhook and Equipo 2 delivery was enabled after backend deployment on the same day. The migration defaults delivery to disabled for a fresh installation. Historical `whatsapp_enviado` values receive no guessed timestamp.

## Behavior

WhatsApp withdrawal and admin Quitar Equipo 1 promote Equipo 2 in the existing reservation. Only that occurrence changes for weekly and fortnightly reservations. Payments and booking details remain intact. The previous email is cleared. The new owner gets the existing confirmation template through a durable immediate queue, including at night; the five-minute worker also picks up admin transfers. Staff receive an email explaining the transfer, not a freed court.

Full booking deletion cascades to the reto and its notification records. Admin reto deletion deletes its booking. Fixed-series deletion removes upcoming occurrences and their queues. A message accepted by WhatsApp cannot be recalled.

Team 2 is due two hours after current-owner reminder acceptance. The five-minute worker uses current price, FUT, court and Costa Rica times. Recipient normalization deduplicates each reservation/Team 2 number, skips the current owner, and rejects missing teams or expired bookings. There is no nighttime restriction for Team 2 or transfers.

Versioned buttons and sender validation reject former owners. Legacy buttons are valid only for original ownership (version zero). Duplicate inbound event IDs do not repeat actions. Existing already-confirmed reply handling remains unchanged.

## Operations

`GET /api/tasks/send-reto-team2-reminders` requires `Authorization: Bearer <CRON_SECRET>`. Vercel invokes it every five minutes. Ordinary owner reminders retain their existing hourly schedule and daytime window.

After confirming **Approved / Utility / es** in Dualhook, activate through the service role or database administrator:

```sql
UPDATE public.whatsapp_notification_settings SET team2_enabled = true WHERE id;
```

Set it to false to pause Team 2 sending. Transfers and ordinary owner reminders continue. All notification tables and processing RPCs are inaccessible to browser roles.

Inspect `whatsapp_notifications` for status, attempts, provider ID and last error. Explicit transient provider rejections, transport failures, ambiguous provider responses and worker interruption all retry after 5, 15, 45 and 60 minutes, with five attempts maximum; the reason stays in `last_error`. An outcome we never learned is retried rather than held, because the operator prefers a duplicate reminder over a client who silently hears nothing. `wa_prepare_notification` re-checks ownership, recipient, cancellation and a recorded send before every attempt, so a reminder already known to have gone out is never repeated. In-flight ownership and recipient changes still become `uncertain` from the triggers and are superseded by a freshly queued message for the new owner. A bounded worker claims one message at a time so a slow provider cannot strand a whole batch.

When a message exhausts every attempt it becomes `failed` and `wa_report_failed_notification` raises one aggregated `whatsapp_fallido` row in `notificaciones`, which the admin bell renders as "Mensajes de WhatsApp sin enviar" with the count, the failure window and the affected reservas. Later failures join that open report; once staff mark it `atendida`, or more than three hours pass without a failure, the next one opens a fresh report. Known gap: a message rejected for `Invalid recipient phone` is set to `failed` inside `wa_prepare_notification` and does not raise a report, since a malformed number is a data-entry problem rather than a delivery outage.

Logs include per-notification outcomes and sent/skipped/failed/uncertain/retry counts. Deletion deliberately removes associated queue records. `whatsapp_action_events` retains deduplication event IDs independently of booking deletion.

## Verification

- Backend: `python manage.py test lobster_api.test_whatsapp_notifications` (all outbound sends mocked).
- Database: `psql -v ON_ERROR_STOP=1 -f tests/whatsapp_retos.sql` (transaction rolls back; no network sends).
- Concurrent workers: `DATABASE_URL=... python tests/whatsapp_claim_concurrency.py` (copies the deployed claim function into an isolated temporary schema, verifies simultaneous workers cannot claim the same notification, then removes the schema).
- Frontend: `npm test` and `npm run build`. `src/components/admin/notificaciones/mensaje.test.ts` pins the `whatsapp_fallido` wording.

The database checks cover both recurrence frequencies, transfers, payment preservation, old buttons, two-hour boundary, late assignment, invalid/owner numbers, temporary-failure backoff, uncertain claims, expired matches and deletion after an owner reminder has already scheduled Team 2. Mocked backend tests cover provider responses, template formatting, cancellation before dispatch and endpoint authorization.
