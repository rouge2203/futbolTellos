import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import { BellIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import { GiWhistle } from "react-icons/gi";
import { cn } from "../../../lib/utils";
import { formatFechaHoraCorta, formatRelative } from "./format";
import { esAgrupada, type UseNotificacionesResult } from "./types";

interface NotificacionesBellProps extends UseNotificacionesResult {
  onOpenDetalle: (id: string) => void;
}

export default function NotificacionesBell({
  notificaciones,
  pendingCount,
  loading,
  loadingMore,
  hasMoreOlderPending,
  error,
  markingIds,
  recienLlegadas,
  showOlderPending,
  markAtendida,
  onOpenDetalle,
}: NotificacionesBellProps) {
  return (
    <Popover className="relative">
      <PopoverButton className="group relative rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="absolute -inset-0.5" />
        <span className="sr-only">
          {pendingCount > 0
            ? `Ver notificaciones, ${pendingCount} pendientes`
            : "Ver notificaciones"}
        </span>
        <BellIcon aria-hidden="true" className="size-6" />
        {pendingCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
          >
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </PopoverButton>

      <PopoverPanel
        transition
        className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Notificaciones
          </h3>
          {pendingCount > 0 && (
            <span className="text-xs font-medium text-gray-500">
              {pendingCount} sin atender
            </span>
          )}
        </div>

        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            Cargando…
          </p>
        ) : notificaciones.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <GiWhistle aria-hidden="true" className="mx-auto size-8 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-600">
              Sin notificaciones
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Las cancelaciones con árbitro aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto [scrollbar-color:#d1d5db_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
            {notificaciones.map((n) => {
              const cuando = esAgrupada(n)
                ? `${n.cantidad_fechas} fechas`
                : n.hora_inicio
                  ? formatFechaHoraCorta(n.hora_inicio)
                  : null;
              const detalle = [n.cancha_nombre ?? "Cancha", cuando]
                .filter(Boolean)
                .join(" · ");
              return (
              <li
                key={n.id}
                className={cn(
                  "group relative flex items-start gap-3 border-l-4 px-4 py-3 hover:bg-gray-50",
                  n.atendida ? "border-transparent" : "border-secondary",
                  recienLlegadas.has(n.id) &&
                    "motion-safe:animate-pulse bg-secondary/10",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                    n.atendida
                      ? "bg-gray-100 text-gray-400"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <GiWhistle aria-hidden="true" className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <CloseButton
                    as="button"
                    type="button"
                    onClick={() => onOpenDetalle(n.id)}
                    className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="absolute inset-0" aria-hidden="true" />
                    <span
                      className={cn(
                        "block text-sm font-semibold",
                        n.atendida ? "text-gray-500" : "text-gray-900",
                      )}
                    >
                      Reserva cancelada ❌
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-xs font-medium",
                        n.atendida ? "text-gray-400" : "text-primary",
                      )}
                    >
                      {n.atendida
                        ? `Avisado${
                            n.atendida_por
                              ? ` por ${n.atendida_por.split("@")[0]}`
                              : ""
                          }`
                        : "Avisar al árbitro"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {detalle} · {formatRelative(n.created_at)}
                    </span>
                  </CloseButton>
                </div>

                {!n.atendida ? (
                  <button
                    type="button"
                    onClick={() => markAtendida(n.id)}
                    disabled={markingIds.has(n.id)}
                    title="Marcar como hecho"
                    className="relative z-10 mt-0.5 shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="sr-only">Marcar como hecho</span>
                    <CheckCircleIcon aria-hidden="true" className="size-5" />
                  </button>
                ) : (
                  <CheckCircleIconSolid
                    aria-hidden="true"
                    className="mt-1 size-5 shrink-0 text-primary/40"
                  />
                )}
              </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p className="border-t border-gray-100 px-4 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        {hasMoreOlderPending && !loading && (
          <button
            type="button"
            onClick={showOlderPending}
            disabled={loadingMore}
            className="w-full rounded-b-lg border-t border-gray-100 px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {loadingMore ? "Cargando…" : "Ver pendientes anteriores"}
          </button>
        )}
      </PopoverPanel>
    </Popover>
  );
}
