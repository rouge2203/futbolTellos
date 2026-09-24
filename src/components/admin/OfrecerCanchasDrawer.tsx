import { useEffect, useRef, useState } from 'react';
import OfferWaitingList from './OfferWaitingList';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FaRegCalendarCheck, FaRegClock, FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { addDays, costaRicaToday } from '../../lib/reservasFijas';
import { eligibleOfferClients, normalizeOfferPhone, offerDateLabel, offerSlots, offerTimeLabel, offerWhatsAppUrl, slotIsAvailable, type OfferCancha, type OfferClient, type OfferConfig, type OfferSlot } from '../../lib/ofrecerCanchas';
import { fetchOfferHistory, fetchOfferReservations, fetchOfferWeek } from '../../lib/ofrecerCanchasData';

interface Props { onClose: () => void; defaultDate?: Date; defaultCanchaId?: number }

// Mounted only while open, so every opening starts with fresh availability and clients.
export default function OfrecerCanchasDrawer({ onClose, defaultDate, defaultCanchaId = 1 }: Props) {
  const today = costaRicaToday();
  const defaultDay = defaultDate ? `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}` : today;
  const [date, setDate] = useState(defaultDay < today ? today : defaultDay);
  const [displayedMonth, setDisplayedMonth] = useState(`${(defaultDay < today ? today : defaultDay).slice(0, 7)}-01`);
  const [canchaId, setCanchaId] = useState(defaultCanchaId);
  const [canchas, setCanchas] = useState<OfferCancha[]>([]);
  const [config, setConfig] = useState<OfferConfig | null>(null);
  const [slots, setSlots] = useState<OfferSlot[]>([]);
  const [selected, setSelected] = useState<OfferSlot | null>(null);
  const [clients, setClients] = useState<OfferClient[]>([]);
  const [clientPage, setClientPage] = useState(1);
  const clientPageCount = Math.max(1, Math.ceil(clients.length / 4));
  const currentClientPage = Math.min(clientPage, clientPageCount);
  const pageClients = clients.slice((currentClientPage - 1) * 4, currentClientPage * 4);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const alive = useRef(true);
  const popup = useRef<Window | null>(null);
  const cancha = canchas.find(c => c.id === canchaId);

  const firstOfMonth = new Date(`${displayedMonth}T12:00:00Z`);
  const nextMonth = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 1, 12));
  const lastOfMonth = addDays(nextMonth.toISOString().slice(0, 10), -1);
  const firstWeekday = firstOfMonth.getUTCDay() || 7;
  const lastWeekday = new Date(`${lastOfMonth}T12:00:00Z`).getUTCDay() || 7;
  const calendarStart = addDays(displayedMonth, 1 - firstWeekday);
  const dayCount = Number(lastOfMonth.slice(8)) + firstWeekday - 1 + 7 - lastWeekday;
  const calendarDays = Array.from({ length: dayCount }, (_, index) => addDays(calendarStart, index));
  const monthLabel = firstOfMonth.toLocaleDateString('es-CR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).replace(' de ', ' ');
  const changeMonth = (offset: number) => {
    setDisplayedMonth(new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + offset, 1, 12)).toISOString().slice(0, 10));
  };
  const displayedSlots = cancha && config ? offerSlots(date, cancha, config) : [];
  const hourLabel = (start: string) => {
    const hour = Number(start.slice(11, 13));
    return `${hour % 12 || 12}:${start.slice(14, 16)} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; popup.current?.close(); };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      supabase.from('canchas').select('id,nombre,local').order('local').order('id'),
      supabase.from('configuracion').select('apertura_sabana,cierre_sabana,apertura_guada,cierre_guada').limit(1).single(),
    ]).then(([courts, hours]) => {
      if (courts.error) throw courts.error;
      if (hours.error) throw hours.error;
      if (!active) return;
      setCanchas(courts.data ?? []);
      setConfig(hours.data);
      if (!courts.data?.some(c => c.id === defaultCanchaId)) setCanchaId(courts.data?.[0]?.id ?? 1);
    }).catch(() => { if (active) setError('No se pudieron cargar las canchas. Intente de nuevo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [defaultCanchaId, reload]);

  useEffect(() => {
    let active = true;
    setSlots([]);
    setLoadingSlots(false);
    setSelected(null);
    setClients([]);
    if (!cancha || !config || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < costaRicaToday()) return;
    const options = offerSlots(date, cancha, config);
    if (!options.length) return;
    setLoadingSlots(true);
    fetchOfferReservations(cancha.id, { start: options[0].start, end: options[options.length - 1].end })
      .then(reservations => { if (active) setSlots(options.filter(slot => slotIsAvailable(slot, reservations))); })
      .catch(() => { if (active) setError('No se pudo verificar la disponibilidad. Intente de nuevo.'); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [date, cancha, config]);

  useEffect(() => {
    let active = true;
    setClients([]);
    setClientPage(1);
    if (!selected || !cancha) { setLoadingClients(false); return; }
    setLoadingClients(true);
    const now = new Date();
    const ids = canchas.filter(c => c.local === cancha.local).map(c => c.id);
    Promise.all([fetchOfferHistory(ids, now), fetchOfferWeek(selected.start.slice(0, 10))])
      .then(([history, week]) => { if (active) setClients(eligibleOfferClients(history, week, selected, ids, now)); })
      .catch(() => { if (active) setError('No se pudieron cargar los clientes. Intente de nuevo.'); })
      .finally(() => { if (active) setLoadingClients(false); });
    return () => { active = false; };
  }, [selected, cancha, canchas]);

  const resetSelection = () => { setSelected(null); setSlots([]); setClients([]); setError(''); setNotice(''); };
  const openWhatsApp = async (client: OfferClient) => {
    if (!selected || !cancha || checking) return;
    setChecking(client.phone);
    setError('');
    setNotice('');
    // Open in the click gesture, then navigate only after the fresh checks succeed.
    const target = window.open('about:blank', '_blank');
    if (!target) { setChecking(null); setNotice('Permita las ventanas emergentes para abrir WhatsApp.'); return; }
    target.opener = null;
    popup.current = target;
    try {
      const [reservations, week] = await Promise.all([
        fetchOfferReservations(cancha.id, selected), fetchOfferWeek(selected.start.slice(0, 10)),
      ]);
      if (!alive.current) { target.close(); return; }
      if (!slotIsAvailable(selected, reservations)) {
        target.close();
        setSlots(current => current.filter(slot => slot.start !== selected.start));
        setSelected(null);
        setNotice('Este horario ya no está disponible. Seleccione otro horario.');
      } else if (week.some(r => normalizeOfferPhone(r.celular_reserva) === client.phone)) {
        target.close();
        setClients(current => current.filter(c => !week.some(r => normalizeOfferPhone(r.celular_reserva) === c.phone)));
        setNotice('El cliente ya tiene una reservación esa semana. Se actualizó la lista.');
      } else {
        target.location.href = offerWhatsAppUrl(client, cancha, selected);
        setNotice('Se abrió WhatsApp con el mensaje preparado. Revíselo y envíelo desde el chat.');
      }
    } catch {
      target.close();
      if (alive.current) setError('No se pudo verificar la disponibilidad. No se abrió el chat. Intente de nuevo.');
    } finally {
      popup.current = null;
      if (alive.current) setChecking(null);
    }
  };

  return <Dialog open onClose={onClose} className="relative z-50">
    <DialogBackdrop transition className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0" />
    <div className="fixed inset-0 overflow-hidden">
      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
        <DialogPanel transition className="pointer-events-auto flex w-screen max-w-2xl flex-col bg-white shadow-xl transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700">
          <div className="flex items-center justify-between bg-primary px-4 py-6 sm:px-6">
            <DialogTitle className="text-base font-semibold text-white">Ofrecer Canchas</DialogTitle>
            <button type="button" onClick={onClose} aria-label="Cerrar panel" className="rounded-md p-1 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><XMarkIcon className="size-6" /></button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 text-gray-900 sm:px-6">
            <p className="text-sm text-gray-600">Seleccione un horario disponible para ofrecerlo a clientes que suelen jugar en esta sede.</p>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" disabled={!!checking} onClick={() => { resetSelection(); setReload(n => n + 1); }} className="ml-2 font-semibold underline">Reintentar</button></div>}
            {notice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
            {loading ? <p role="status" className="py-8 text-center text-sm text-gray-500">Cargando canchas...</p> : <>
              <fieldset disabled={!!checking} className="space-y-6 disabled:opacity-60">
                <div>
                  <label htmlFor="offer-cancha" className="block text-sm/6 font-medium text-gray-900 mb-2">Cancha</label>
                  <select id="offer-cancha" value={canchaId} onChange={e => { resetSelection(); setCanchaId(Number(e.target.value)); }} className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6">
                    {canchas.map(c => <option key={c.id} value={c.id} className="bg-white text-gray-900">{c.nombre}</option>)}
                  </select>
                </div>
                {cancha && <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3"><FaRegCalendarCheck className="text-primary" />Seleccione una fecha</h3>
                    <div className="text-center">
                      <div className="flex items-center text-gray-900">
                        <button type="button" onClick={() => changeMonth(-1)} className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500">
                          <span className="sr-only">Mes anterior</span><ChevronLeftIcon className="size-5" />
                        </button>
                        <div aria-live="polite" className="flex-auto text-sm font-semibold capitalize">{monthLabel}</div>
                        <button type="button" onClick={() => changeMonth(1)} className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500">
                          <span className="sr-only">Mes siguiente</span><ChevronRightIcon className="size-5" />
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-7 text-xs/6 text-gray-500">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <div key={index}>{day}</div>)}</div>
                      <div className="isolate mt-2 grid grid-cols-7 gap-px rounded-lg bg-gray-200 text-sm shadow-sm ring-1 ring-gray-200">
                        {calendarDays.map((day, index) => {
                          const isCurrentMonth = day.slice(0, 7) === displayedMonth.slice(0, 7);
                          const isToday = day === today;
                          const isSelected = day === date;
                          const isPast = day < today;
                          const isDisabled = !isCurrentMonth || isPast;
                          return <button key={day} type="button" disabled={isDisabled} aria-label={offerDateLabel(`${day} 12:00:00`)} aria-pressed={isSelected}
                            onClick={() => { if (day !== date) { resetSelection(); setDate(day); } }}
                            className={`py-1.5 focus:z-10 ${isCurrentMonth && !isPast ? 'bg-white hover:bg-gray-100' : isCurrentMonth ? 'bg-amber-50/50' : 'bg-gray-50'} ${isSelected ? 'font-semibold text-white' : isToday ? 'font-semibold text-primary' : isDisabled ? 'text-gray-400' : 'text-gray-900'} ${index === 0 ? 'rounded-tl-lg' : ''} ${index === 6 ? 'rounded-tr-lg' : ''} ${index === calendarDays.length - 7 ? 'rounded-bl-lg' : ''} ${index === calendarDays.length - 1 ? 'rounded-br-lg' : ''} ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                            <time dateTime={day} className={`mx-auto flex size-7 items-center justify-center rounded-full ${isSelected ? isToday ? 'bg-primary' : 'bg-gray-900' : ''}`}>{Number(day.slice(8))}</time>
                          </button>;
                        })}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 flex gap-2 items-center mb-3"><FaRegClock className="text-primary" />Seleccione una hora{loadingSlots && <span role="status" className="text-gray-500 text-xs ml-2">(cargando...)</span>}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {displayedSlots.map(slot => {
                        const unavailable = loadingSlots || !slots.some(available => available.start === slot.start);
                        const isSelected = selected?.start === slot.start;
                        return <button type="button" key={slot.start} disabled={unavailable} aria-pressed={isSelected}
                          aria-label={`${hourLabel(slot.start)}${slot.start.slice(0, 10) !== date ? ', día siguiente' : ''}${unavailable ? ', no disponible' : ''}`}
                          onClick={() => { setError(''); setNotice(''); setSelected(slot); }}
                          className={`py-3 text-base tracking-tight rounded-lg border transition-all font-medium ${unavailable ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed line-through' : isSelected ? 'bg-primary border-primary text-white' : 'bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10'}`}>
                          {hourLabel(slot.start)}{slot.start.slice(0, 10) !== date && <span className="mt-1 block text-xs">Día siguiente</span>}
                        </button>;
                      })}
                    </div>
                    {!loadingSlots && !slots.length && !error && <p className="text-gray-500 text-sm text-center mt-4">No hay horarios disponibles para esta fecha</p>}
                  </div>
                </>}
              </fieldset>
              <OfferWaitingList />
              {selected && <section aria-label="Clientes sugeridos" className="border-t border-gray-200 pt-5">
                <h3 className="font-semibold">Clientes sugeridos</h3>
                <p className="mt-2 text-sm font-medium capitalize">{offerDateLabel(selected.start)} · {offerTimeLabel(selected.start)} – {offerTimeLabel(selected.end)}</p>
                {loadingClients ? <p role="status" className="py-6 text-sm text-gray-500">Buscando clientes...</p> : clients.length ? <ul className="mt-4 divide-y divide-gray-100">{pageClients.map(client => <li key={client.phone} className="flex items-center gap-3 py-4">
                  <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{client.name}</p><p className="text-sm text-gray-600">+{client.phone}</p><p className="mt-1 text-[11px] leading-4 text-gray-500">Última reserva: {offerDateLabel(client.lastReservation)}, {offerTimeLabel(client.lastReservation)} · {canchas.find(c => c.id === client.lastCanchaId)?.nombre ?? `Cancha ${client.lastCanchaId}`}</p></div>
                  <button type="button" aria-label={`Ofrecer cancha por WhatsApp a ${client.name}`} disabled={!!checking} onClick={() => void openWhatsApp(client)} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 focus-visible:outline-2 focus-visible:outline-green-700 disabled:opacity-50">{checking === client.phone ? <span className="size-5 animate-spin rounded-full border-2 border-green-200 border-t-green-700" /> : <FaWhatsapp className="size-6" />}</button>
                </li>)}</ul> : !error && <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">No hay clientes que coincidan con este horario y estén libres esa semana.</p>}
                {!loadingClients && clientPageCount > 1 && <nav aria-label="Paginación de clientes sugeridos" className="mt-3 flex items-center justify-end gap-2">
                  <button type="button" aria-label="Página anterior de clientes" disabled={currentClientPage === 1 || !!checking} onClick={() => setClientPage(currentClientPage - 1)} className="flex size-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeftIcon className="size-4" /></button>
                  <span aria-live="polite" aria-label={`Página ${currentClientPage} de ${clientPageCount}`} className="text-xs tabular-nums text-gray-500">{currentClientPage} / {clientPageCount}</span>
                  <button type="button" aria-label="Página siguiente de clientes" disabled={currentClientPage === clientPageCount || !!checking} onClick={() => setClientPage(currentClientPage + 1)} className="flex size-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30"><ChevronRightIcon className="size-4" /></button>
                </nav>}
                {checking && <p role="status" className="mt-3 text-sm text-gray-500">Verificando horario y reservaciones del cliente...</p>}
              </section>}
            </>}
          </div>
        </DialogPanel>
      </div>
    </div>
  </Dialog>;
}
