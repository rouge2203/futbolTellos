import { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import { fetchAllPages } from '../../lib/fetchAllPages';
import { addDays, costaRicaToday } from '../../lib/reservasFijas';
import { offerDateLabel } from '../../lib/ofrecerCanchas';

interface WaitingEntry { id: number; date: string; note: string }

export default function OfferWaitingList() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<WaitingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const today = costaRicaToday();

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchAllPages<WaitingEntry>((from, to) => supabase.from('lista_espera')
      .select('id,date,note').gte('date', today).order('date').order('id').range(from, to))
      .then(data => { if (active) setEntries(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, today, retry]);

  const dateLabel = (value: string) => {
    const date = value.slice(0, 10);
    return date === today ? 'Hoy' : date === addDays(today, 1) ? 'Mañana' : offerDateLabel(`${date} 12:00:00`);
  };

  return <section aria-label="Lista de espera" className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
    <button type="button" aria-expanded={open} aria-controls="offer-waiting-list" onClick={() => { if (!open) { setLoading(true); setError(false); } setOpen(value => !value); }}
      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary">
      Lista de espera
      <ChevronDownIcon aria-hidden="true" className={`size-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id="offer-waiting-list" className="max-h-56 overflow-y-auto px-3 pb-3">
      {loading ? <p role="status" className="py-3 text-xs text-gray-500">Cargando lista de espera...</p>
        : error ? <div role="alert" className="py-2 text-xs text-red-800">No se pudo cargar la lista. <button type="button" onClick={() => { setLoading(true); setError(false); setRetry(value => value + 1); }} className="font-semibold underline">Reintentar</button></div>
        : entries.length ? <ul className="space-y-4 pt-2">{entries.map((entry, index) => <li key={entry.id} className="relative flex gap-x-3">
          {index < entries.length - 1 && <div aria-hidden="true" className="absolute top-0 -bottom-4 left-0 flex w-5 justify-center"><div className="w-px bg-gray-200" /></div>}
          <div aria-hidden="true" className="relative flex size-5 flex-none items-center justify-center bg-gray-50"><div className="size-1.5 rounded-full bg-gray-100 ring ring-gray-300" /></div>
          <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-sm text-gray-900">{entry.note}</p><time dateTime={entry.date} className="mt-1 block text-[11px] leading-4 text-gray-500">{dateLabel(entry.date)}</time></div>
        </li>)}</ul>
        : <p className="py-2 text-xs text-gray-500">No hay entradas para hoy ni los próximos días.</p>}
    </div>}
  </section>;
}
