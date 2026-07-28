import { useState, useEffect } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabase";
import { formatSinpe, isValidSinpe, normalizeSinpe } from "../../lib/sinpe";
import { FaRegCalendarCheck } from "react-icons/fa";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio: string;
  sinpe_nombre?: string | null;
  sinpe_numero?: string | null;
}

interface EditCanchaDrawerProps {
  open: boolean;
  onClose: () => void;
  cancha: Cancha | null;
  onSuccess: () => void;
}

export default function EditCanchaDrawer({
  open,
  onClose,
  cancha,
  onSuccess,
}: EditCanchaDrawerProps) {
  const [precio, setPrecio] = useState("");
  const [sinpeNombre, setSinpeNombre] = useState("");
  const [sinpeNumero, setSinpeNumero] = useState("");
  const [reservationCount, setReservationCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize editable fields whenever the drawer opens.
  //
  // `open` must be in the deps, not just `cancha`: Canchas.tsx keeps
  // selectedCancha set after closing, so reopening the same card passes the
  // identical object reference, React bails on the setState, and an effect
  // keyed only on `cancha` would never re-run — leaving abandoned edits in the
  // form. That was survivable for precio; it is not for a SINPE number.
  useEffect(() => {
    if (open && cancha) {
      setPrecio(cancha.precio || "");
      setSinpeNombre(cancha.sinpe_nombre || "");
      setSinpeNumero(normalizeSinpe(cancha.sinpe_numero || ""));
    }
  }, [open, cancha]);

  // Fetch reservation count for last 7 days
  useEffect(() => {
    const fetchReservationCount = async () => {
      if (!cancha) return;

      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateStr = sevenDaysAgo.toISOString().split("T")[0];
        const startOfDay = `${dateStr} 00:00:00`;

        const { count, error } = await supabase
          .from("reservas")
          .select("*", { count: "exact", head: true })
          .eq("cancha_id", cancha.id)
          .gte("hora_inicio", startOfDay);

        if (error) throw error;
        setReservationCount(count || 0);
      } catch (error) {
        console.error("Error fetching reservation count:", error);
        setReservationCount(null);
      }
    };

    if (open && cancha) {
      setLoading(true);
      fetchReservationCount().finally(() => setLoading(false));
    }
  }, [open, cancha]);

  const isCancha6 = cancha?.id === 6;
  const sinpeNumeroInvalido = sinpeNumero !== "" && !isValidSinpe(sinpeNumero);
  const sinpeIncompleto = sinpeNombre.trim() === "" || sinpeNumero === "";

  const handleSave = async () => {
    if (!cancha || sinpeNumeroInvalido) return;

    setSaving(true);
    try {
      const updates: Record<string, string | null> = {
        sinpe_nombre: sinpeNombre.trim() || null,
        sinpe_numero: normalizeSinpe(sinpeNumero) || null,
      };
      // Cancha 6's precio is a range ("40.000-50.000") wired to hardcoded tier
      // logic in CanchaDetails.tsx, so it stays locked — but its SINPE data is
      // editable like any other cancha's.
      if (!isCancha6) updates.precio = precio;

      const { data, error } = await supabase
        .from("canchas")
        .update(updates)
        .eq("id", cancha.id)
        .select();

      if (error) throw error;

      // RLS ("canchas update for superuser") filters rows silently: PostgREST
      // reports success with zero rows when the caller is not a superuser.
      // Without this check the drawer would claim it saved and write nothing.
      if (!data || data.length === 0) {
        alert(
          "No se pudo guardar. Solo un superusuario puede editar las canchas.",
        );
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating cancha:", error);
      alert("Error al actualizar la cancha. Por favor intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (!cancha) return null;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />

      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <DialogPanel
              transition
              className="pointer-events-auto w-screen max-w-2xl transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
            >
              <div className="relative flex h-full flex-col divide-y divide-gray-200 bg-white shadow-xl">
                <div className="h-0 flex-1 overflow-y-auto">
                  <div className="bg-primary px-4 py-6 sm:px-6">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-base font-semibold text-white">
                        Editar Cancha
                      </DialogTitle>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          onClick={onClose}
                          className="relative rounded-md text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                          <span className="absolute -inset-2.5" />
                          <span className="sr-only">Cerrar panel</span>
                          <XMarkIcon aria-hidden="true" className="size-6" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1">
                      <p className="text-sm text-white/80">
                        Edita la información de la cancha.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between">
                    <div className="divide-y divide-gray-200 px-4 sm:px-6">
                      <div className="space-y-6 pt-6 pb-5">
                        {/* Cancha Image */}
                        <div>
                          <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                            Imagen
                          </label>
                          <div className="mt-2">
                            <img
                              src={cancha.img}
                              alt={cancha.nombre}
                              className="w-full h-48 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        </div>

                        {/* Cancha Nombre */}
                        <div>
                          <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                            Nombre
                          </label>
                          <div className="mt-2">
                            <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-600 sm:text-sm/6">
                              {cancha.nombre}
                            </div>
                          </div>
                        </div>

                        {/* Cantidad */}
                        <div>
                          <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                            Cantidad
                          </label>
                          <div className="mt-2">
                            <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-600 sm:text-sm/6">
                              FUT {cancha.cantidad}
                            </div>
                          </div>
                        </div>

                        {/* Precio */}
                        <div>
                          <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                            Precio
                          </label>
                          <div className="mt-2 space-y-2">
                            <input
                              type="text"
                              value={precio}
                              onChange={(e) => setPrecio(e.target.value)}
                              disabled={isCancha6}
                              className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed sm:text-sm/6"
                              placeholder="23.000"
                            />
                            {isCancha6 && (
                              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <InformationCircleIcon className="size-5 text-yellow-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-900">
                                  El precio de esta cancha se maneja por rangos
                                  (FUT 7-8-9). Contacta a Lobster para
                                  actualizarlo.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Datos de SINPE Móvil (por cancha) */}
                        <div>
                          <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                            Nombre del titular SINPE
                          </label>
                          <div className="mt-2">
                            <input
                              type="text"
                              value={sinpeNombre}
                              onChange={(e) => setSinpeNombre(e.target.value)}
                              className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                              placeholder="Kathia Salas"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                            Número de SINPE
                          </label>
                          <div className="mt-2 space-y-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={sinpeNumero}
                              onChange={(e) =>
                                setSinpeNumero(normalizeSinpe(e.target.value))
                              }
                              className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                              placeholder="86167000"
                            />
                            <p className="text-sm text-gray-500">
                              {sinpeNumero === ""
                                ? "8 dígitos, sin guion. Esto es lo que el cliente ve en la página de pago de su reserva."
                                : sinpeNumeroInvalido
                                  ? `Faltan dígitos (${sinpeNumero.length}/8).`
                                  : `El cliente verá: ${formatSinpe(sinpeNumero)}`}
                            </p>
                            {sinpeIncompleto && (
                              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <InformationCircleIcon className="size-5 text-yellow-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-900">
                                  Si estos campos quedan vacíos o incompletos,
                                  el cliente no verá ningún número de SINPE y se
                                  le pedirá escribirnos por WhatsApp.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reservation Statistics */}
                        <div>
                          <label className="block text-sm/6 font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <FaRegCalendarCheck className="text-primary" />
                            Reservaciones (últimos 7 días)
                          </label>
                          <div className="mt-2">
                            {loading ? (
                              <div className="flex items-center gap-2 text-gray-600">
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
                                <span className="text-sm">Cargando...</span>
                              </div>
                            ) : (
                              <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6">
                                {reservationCount !== null
                                  ? `${reservationCount} reservación${
                                      reservationCount !== 1 ? "es" : ""
                                    }`
                                  : "No disponible"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex shrink-0 justify-end gap-3 px-4 py-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      saving ||
                      (!isCancha6 && !precio.trim()) ||
                      sinpeNumeroInvalido
                    }
                    className="inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-700 disabled:cursor-not-allowed"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
