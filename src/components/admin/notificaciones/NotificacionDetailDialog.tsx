import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { CalendarIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { GiWhistle } from "react-icons/gi";
import {
  formatDateTime,
  formatFechaCorta,
  formatFechaLarga,
  formatHora,
  getLocalName,
} from "./format";
import MensajeNotificacion from "./MensajeNotificacion";
import { esAgrupada, type Notificacion } from "./types";

interface NotificacionDetailDialogProps {
  open: boolean;
  notificacion: Notificacion | null;
  marking: boolean;
  onClose: () => void;
  onMarkAtendida: (id: string) => Promise<void>;
}

export default function NotificacionDetailDialog({
  open,
  notificacion,
  marking,
  onClose,
  onMarkAtendida,
}: NotificacionDetailDialogProps) {
  // Keep the last non-null row so content doesn't vanish during the leave
  // transition after onClose sets the selected id to null.
  const [cached, setCached] = useState(notificacion);
  if (notificacion && notificacion !== cached) setCached(notificacion);
  const n = notificacion ?? cached;
  if (!n) return null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!marking) onClose();
      }}
      className="relative z-60"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/70 transition-opacity data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
      />
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel
            transition
            className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
          >
            <div className="bg-primary px-4 py-3 flex items-center gap-2">
              <GiWhistle aria-hidden="true" className="size-5 text-secondary" />
              <DialogTitle className="text-base font-semibold text-white">
                {esAgrupada(n)
                  ? "Reserva fija cancelada con árbitro"
                  : "Reserva cancelada con árbitro"}
              </DialogTitle>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-700">
                <MensajeNotificacion notificacion={n} />
              </p>

              <dl className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 space-y-1.5">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">Cliente</dt>
                  <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                    {n.nombre_reserva ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">Teléfono</dt>
                  <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                    {n.celular_reserva ?? "—"}
                  </dd>
                </div>
                {n.correo_reserva && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Correo</dt>
                    <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                      {n.correo_reserva}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">Cancha</dt>
                  <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                    {n.cancha_nombre ?? "—"}
                    {n.cancha_local != null && (
                      <> · {getLocalName(n.cancha_local)}</>
                    )}
                  </dd>
                </div>
                {!esAgrupada(n) && n.hora_inicio && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Fecha</dt>
                    <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                      {formatFechaLarga(n.hora_inicio)}
                    </dd>
                  </div>
                )}
                {n.hora_inicio && n.hora_fin && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Horario</dt>
                    <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                      {formatHora(n.hora_inicio)} – {formatHora(n.hora_fin)}
                    </dd>
                  </div>
                )}
                {n.precio != null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 shrink-0">Precio</dt>
                    <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                      ₡{n.precio.toLocaleString()}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">Recibida</dt>
                  <dd className="text-right font-medium text-gray-900 min-w-0 break-words">
                    {formatDateTime(n.created_at)}
                  </dd>
                </div>
              </dl>

              {esAgrupada(n) && n.fechas_canceladas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Fechas canceladas ({n.cantidad_fechas})
                  </p>
                  <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                    {n.fechas_canceladas.map((f) => (
                      <li
                        key={f.hora_inicio + (f.cancha_id ?? "")}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <CalendarIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-gray-400"
                        />
                        {formatFechaCorta(f.hora_inicio)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {n.atendida && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="size-5 shrink-0"
                  />
                  <span>
                    Hecho por {n.atendida_por ?? "—"}
                    {n.atendida_at && <> · {formatDateTime(n.atendida_at)}</>}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={marking}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cerrar
              </button>
              {!n.atendida && (
                <button
                  type="button"
                  onClick={() => onMarkAtendida(n.id)}
                  disabled={marking}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {marking ? "Marcando…" : "Marcar como hecho"}
                </button>
              )}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
