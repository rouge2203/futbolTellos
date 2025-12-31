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
import { FaRegCalendarCheck } from "react-icons/fa";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio: string;
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
  const [reservationCount, setReservationCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize precio when cancha changes
  useEffect(() => {
    if (cancha) {
      setPrecio(cancha.precio || "");
    }
  }, [cancha]);

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

  const handleSave = async () => {
    if (!cancha || cancha.id === 6) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("canchas")
        .update({ precio })
        .eq("id", cancha.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating cancha:", error);
      alert("Error al actualizar la cancha. Por favor intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const isCancha6 = cancha?.id === 6;

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
              className="pointer-events-auto w-screen max-w-md transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
            >
              <div className="relative flex h-full flex-col divide-y divide-white/10 bg-bg shadow-xl">
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
                    <div className="divide-y divide-white/10 px-4 sm:px-6">
                      <div className="space-y-6 pt-6 pb-5">
                        {/* Cancha Image */}
                        <div>
                          <label className="block text-sm/6 font-medium text-white mb-2">
                            Imagen
                          </label>
                          <div className="mt-2">
                            <img
                              src={cancha.img}
                              alt={cancha.nombre}
                              className="w-full h-48 object-cover rounded-lg border border-white/10"
                            />
                          </div>
                        </div>

                        {/* Cancha Nombre */}
                        <div>
                          <label className="block text-sm/6 font-medium text-white mb-2">
                            Nombre
                          </label>
                          <div className="mt-2">
                            <div className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white/60 sm:text-sm/6">
                              {cancha.nombre}
                            </div>
                          </div>
                        </div>

                        {/* Cantidad */}
                        <div>
                          <label className="block text-sm/6 font-medium text-white mb-2">
                            Cantidad
                          </label>
                          <div className="mt-2">
                            <div className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white/60 sm:text-sm/6">
                              FUT {cancha.cantidad}
                            </div>
                          </div>
                        </div>

                        {/* Precio */}
                        <div>
                          <label className="block text-sm/6 font-medium text-white mb-2">
                            Precio
                          </label>
                          <div className="mt-2 space-y-2">
                            <input
                              type="text"
                              value={precio}
                              onChange={(e) => setPrecio(e.target.value)}
                              disabled={isCancha6}
                              className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:bg-white/5 disabled:text-gray-500 disabled:cursor-not-allowed sm:text-sm/6"
                              placeholder="23.000"
                            />
                            {isCancha6 && (
                              <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                <InformationCircleIcon className="size-5 text-yellow-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-yellow-200">
                                  Contacta a Lobster para actualizar esta cancha.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reservation Statistics */}
                        <div>
                          <label className="block text-sm/6 font-medium text-white mb-2 flex items-center gap-2">
                            <FaRegCalendarCheck className="text-secondary" />
                            Reservaciones (últimos 7 días)
                          </label>
                          <div className="mt-2">
                            {loading ? (
                              <div className="flex items-center gap-2 text-white/60">
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
                                <span className="text-sm">Cargando...</span>
                              </div>
                            ) : (
                              <div className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white sm:text-sm/6">
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
                    className="rounded-md bg-white/5 px-3 py-2 text-sm font-semibold text-white shadow-xs inset-ring inset-ring-white/10 hover:bg-white/10"
                  >
                    Cerrar
                  </button>
                  {!isCancha6 && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !precio.trim()}
                      className="inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  )}
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

