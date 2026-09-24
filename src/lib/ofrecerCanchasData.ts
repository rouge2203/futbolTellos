import { supabase } from './supabase';
import { fetchAllPages } from './fetchAllPages';
import { costaRicaNow } from './reservasFijas';
import { linkedOfferCanchas, offerWeek, type OfferReservation, type OfferSlot } from './ofrecerCanchas';

const fields = 'id,cancha_id,hora_inicio,hora_fin,nombre_reserva,celular_reserva';
export function fetchOfferReservations(canchaId: number, range: OfferSlot) {
  return fetchAllPages<OfferReservation>((from, to) => supabase.from('reservas').select(fields)
    .in('cancha_id', linkedOfferCanchas(canchaId)).lt('hora_inicio', range.end).gt('hora_fin', range.start)
    .order('hora_inicio').order('id').range(from, to));
}
export function fetchOfferWeek(date: string) {
  const week = offerWeek(date);
  return fetchAllPages<Pick<OfferReservation, 'celular_reserva'>>((from, to) => supabase.from('reservas').select('celular_reserva')
    .gte('hora_inicio', week.start).lt('hora_inicio', week.end).order('hora_inicio').order('id').range(from, to));
}
export function fetchOfferHistory(canchaIds: number[], now = new Date()) {
  return fetchAllPages<OfferReservation>((from, to) => supabase.from('reservas').select(fields)
    .in('cancha_id', canchaIds).gte('hora_inicio', costaRicaNow(new Date(now.getTime() - 30 * 86400000)))
    .lt('hora_inicio', costaRicaNow(now)).order('hora_inicio').order('id').range(from, to));
}
