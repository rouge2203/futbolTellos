import { addDays, costaRicaNow } from './reservasFijas';

export interface OfferCancha { id: number; nombre: string; local: number }
export interface OfferConfig {
  apertura_sabana: string; cierre_sabana: string;
  apertura_guada: string; cierre_guada: string;
}
export interface OfferReservation {
  id: string; cancha_id: number; hora_inicio: string; hora_fin: string;
  nombre_reserva: string | null; celular_reserva: string | null;
}
export interface OfferClient { phone: string; name: string; lastReservation: string; lastCanchaId: number }
export interface OfferSlot { start: string; end: string }

// The database stores Costa Rica wall times without a timezone.
export function offerInstant(value: string): Date {
  const iso = value.replace(' ', 'T');
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}-06:00`);
}
export function normalizeOfferPhone(value: string | null): string | null {
  let digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 8) digits = `506${digits}`;
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}
export function offerWeek(date: string): { start: string; end: string } {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const monday = addDays(date, 1 - weekday);
  return { start: `${monday} 00:00:00`, end: `${addDays(monday, 7)} 00:00:00` };
}
export function linkedOfferCanchas(id: number): number[] {
  return id === 6 ? [6, 1, 3, 5] : [1, 3, 5].includes(id) ? [id, 6] : [id];
}
export function offerSlots(date: string, cancha: OfferCancha, config: OfferConfig): OfferSlot[] {
  const opening = cancha.local === 1 ? config.apertura_sabana : config.apertura_guada;
  const closing = cancha.local === 1 ? config.cierre_sabana : config.cierre_guada;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const first = minutes(opening);
  let last = minutes(closing);
  if (last <= first) last += 1440;
  const at = (minute: number) => `${addDays(date, Math.floor(minute / 1440))} ${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`;
  const result: OfferSlot[] = [];
  for (let start = first; start + 60 <= last; start += 60) result.push({ start: at(start), end: at(start + 60) });
  return result;
}
export function slotIsAvailable(slot: OfferSlot, reservations: Pick<OfferReservation, 'hora_inicio' | 'hora_fin'>[], now = new Date()): boolean {
  const start = offerInstant(slot.start).getTime();
  const end = offerInstant(slot.end).getTime();
  return start > now.getTime() && !reservations.some(r => offerInstant(r.hora_inicio).getTime() < end && offerInstant(r.hora_fin).getTime() > start);
}
export function eligibleOfferClients(history: OfferReservation[], week: Pick<OfferReservation, 'celular_reserva'>[], slot: OfferSlot, sedeCanchaIds: number[], now = new Date()): OfferClient[] {
  const target = costaRicaNow(offerInstant(slot.start));
  const targetWeekday = new Date(`${target.slice(0, 10)}T12:00:00Z`).getUTCDay();
  const targetMinute = Number(target.slice(11, 13)) * 60 + Number(target.slice(14, 16));
  const booked = new Set(week.map(r => normalizeOfferPhone(r.celular_reserva)).filter(Boolean));
  const clients = new Map<string, { client: OfferClient; priority: number }>();
  const lower = now.getTime() - 30 * 86400000;
  for (const reservation of history) {
    const instant = offerInstant(reservation.hora_inicio);
    const phone = normalizeOfferPhone(reservation.celular_reserva);
    if (!phone || booked.has(phone) || !sedeCanchaIds.includes(reservation.cancha_id) || instant.getTime() < lower || instant.getTime() >= now.getTime()) continue;
    const local = costaRicaNow(instant);
    const weekday = new Date(`${local.slice(0, 10)}T12:00:00Z`).getUTCDay();
    const minute = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
    const priority = weekday === targetWeekday ? 0
      : weekday === (targetWeekday + 1) % 7 ? 1
      : weekday === (targetWeekday + 6) % 7 ? 2 : -1;
    if (priority < 0 || Math.abs(minute - targetMinute) > (priority === 0 ? 180 : 120)) continue;
    const previous = clients.get(phone);
    // A client matching several weekdays belongs to the highest-priority group.
    if (!previous || priority < previous.priority || (priority === previous.priority && instant > offerInstant(previous.client.lastReservation))) clients.set(phone, {
      priority,
      client: { phone, name: reservation.nombre_reserva?.trim() || 'Cliente', lastReservation: reservation.hora_inicio, lastCanchaId: reservation.cancha_id },
    });
  }
  return [...clients.values()].sort((a, b) => a.priority - b.priority || offerInstant(b.client.lastReservation).getTime() - offerInstant(a.client.lastReservation).getTime() || a.client.phone.localeCompare(b.client.phone)).map(entry => entry.client);
}
export function offerDateLabel(value: string): string {
  return offerInstant(value).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', weekday: 'long', day: 'numeric', month: 'long' });
}
export function offerTimeLabel(value: string): string {
  return offerInstant(value).toLocaleTimeString('es-CR', { timeZone: 'America/Costa_Rica', hour: 'numeric', minute: '2-digit', hour12: true });
}
export function offerWhatsAppUrl(client: OfferClient, cancha: OfferCancha, slot: OfferSlot): string {
  const sede = cancha.local === 1 ? 'La Sabana' : 'El Carmen de Guadalupe';
  const ending = `${slot.end.slice(0, 10) !== slot.start.slice(0, 10) ? `${offerDateLabel(slot.end)}, ` : ''}${offerTimeLabel(slot.end)}`;
  const message = `*Reservaciones Fútbol Tello*\n\nHola ${client.name} 👋🏻, le contamos que tenemos una cancha disponible:\n\n📆 ${offerDateLabel(slot.start)}\n🕑 ${offerTimeLabel(slot.start)} - ${ending}\n🏟️ ${cancha.nombre}\n📍 ${sede}\n\nPuede reservarla antes de que se ocupe en:\nhttps://futboltello.com\n\n¡Le esperamos! ⚽`;
  // Encode the complete Unicode message once and skip the wa.me redirect.
  return `https://api.whatsapp.com/send?phone=${client.phone}&text=${encodeURIComponent(message)}`;
}
