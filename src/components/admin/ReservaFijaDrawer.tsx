import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase, isReservaConflictError } from "../../lib/supabase";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import { FaRegClock } from "react-icons/fa";
import ReservaFijaOptions from "./ReservaFijaOptions";
import RetoConfirmDialog from "./RetoConfirmDialog";
import { refereeAdjustedPrice, formatFixedDate, costaRicaNow } from "../../lib/reservasFijas";
import { isFullCancha, reservationFut, canchaPrice } from "../../lib/retos";
import { GiWhistle } from "react-icons/gi";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  local: number;
  cantidad?: string;
  precio?: string;
}

interface ReservaFija {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva_fija: string;
  celular_reserva_fija: string;
  correo_reserva_fija: string;
  precio: number;
  arbitro: boolean;
  frecuencia_semanas?: 1 | 2;
  fecha_inicio?: string;
  es_reto?: boolean;
  fut?: number;
  cancha_id: number;
  dia: number;
  cancha?: Cancha;
}

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  correo_reserva: string;
  precio: number;
  arbitro: boolean;
  cancha_id: number;
  reservacion_fija_id: number | null;
}

interface ReservaFijaDrawerProps {
  open: boolean;
  onClose: () => void;
  reservaFija: ReservaFija | null;
  onUpdate: () => void;
  onDelete: () => void;
  user: User | null;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const MONTHS_SPANISH = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const formatHourAmPm = (timeStr: string): string => {
  if (!timeStr) return "N/A";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const extractTimeFromTimestamp = (timestamp: string): string => {
  if (!timestamp) return "";

  // Use regex to find HH:MM:SS pattern anywhere in the string
  // This handles various formats like "YYYY-MM-DD HH:MM:SS", "DD Mon YYYY HH:MM:SS", ISO formats, etc.
  const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (timeMatch) {
    return timeMatch[0]; // Returns "HH:MM:SS"
  }

  // Fallback: try HH:MM pattern (without seconds)
  const shortTimeMatch = timestamp.match(/(\d{1,2}):(\d{2})/);
  if (shortTimeMatch) {
    const hours = shortTimeMatch[1].padStart(2, "0");
    const minutes = shortTimeMatch[2];
    return `${hours}:${minutes}:00`;
  }

  return "";
};

const getLocalName = (local: number): string => {
  if (local === 1) return "Sabana";
  if (local === 2) return "Guadalupe";
  return `Local ${local}`;
};

export default function ReservaFijaDrawer({
  open,
  onClose,
  reservaFija,
  onUpdate,
  onDelete,
}: ReservaFijaDrawerProps) {
  const navigate = useNavigate();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);

  // Form state for editing
  const [editNombre, setEditNombre] = useState("");
  const [editCorreo, setEditCorreo] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editPrecio, setEditPrecio] = useState<number>(0);
  const [editArbitro, setEditArbitro] = useState(false);
  const [editEsReto, setEditEsReto] = useState(false);
  const [editFut, setEditFut] = useState(7);
  const [updateErrorMessage, setUpdateErrorMessage] = useState("");
  const [editDia, setEditDia] = useState<number>(1);
  const [editHoraInicio, setEditHoraInicio] = useState<string>("");
  const [editHoraFin, setEditHoraFin] = useState<string>("");
  const [showPrecioEdit, setShowPrecioEdit] = useState(false);
  const [showDiaEdit, setShowDiaEdit] = useState(false);
  const [showHoraEdit, setShowHoraEdit] = useState(false);

  // Confirmation dialogs
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [changesDescription, setChangesDescription] = useState<string[]>([]);

  // Fetch canchas
  useEffect(() => {
    const fetchCanchas = async () => {
      try {
        const { data, error } = await supabase
          .from("canchas")
          .select("id, nombre, img, local, cantidad, precio")
          .order("id");

        if (error) throw error;

        // Sort canchas: Sabana (local == 1) first, then Guadalupe (local == 2), then by id
        const sortedCanchas = (data || []).sort((a, b) => {
          if (a.local !== b.local) {
            return a.local - b.local;
          }
          return a.id - b.id;
        });

        setCanchas(sortedCanchas);
      } catch (error) {
        console.error("Error fetching canchas:", error);
      }
    };

    fetchCanchas();
  }, []);

  // Initialize form when reservaFija changes
  useEffect(() => {
    if (reservaFija) {
      setEditNombre(reservaFija.nombre_reserva_fija || "");
      setEditCorreo(reservaFija.correo_reserva_fija || "");
      setEditCelular(reservaFija.celular_reserva_fija || "");
      setEditPrecio(reservaFija.precio);
      setEditArbitro(Boolean(reservaFija.arbitro));
      setEditEsReto(Boolean(reservaFija.es_reto));
      setEditFut(reservaFija.cancha ? reservationFut({ ...reservaFija, cancha: reservaFija.cancha }) : 7);
      setUpdateErrorMessage("");
      setEditDia(reservaFija.dia);
      setEditHoraInicio(reservaFija.hora_inicio);

      // Calculate hora_fin as hora_inicio + 1 hour
      if (reservaFija.hora_inicio) {
        const [hours, minutes] = reservaFija.hora_inicio.split(":");
        const nextHour = (parseInt(hours, 10) + 1) % 24;
        const calculatedHoraFin = `${String(nextHour).padStart(2, "0")}:${minutes}:00`;
        setEditHoraFin(calculatedHoraFin);
      } else {
        setEditHoraFin(reservaFija.hora_fin);
      }

      setShowPrecioEdit(false);
      setShowDiaEdit(false);
      setShowHoraEdit(false);
      setUpdating(false); // Reset updating state when opening drawer

      // Fetch related reservas
      fetchReservas(reservaFija.id);
    }
  }, [reservaFija]);

  const fetchReservas = async (reservaFijaId: number) => {
    setLoadingReservas(true);
    try {
      const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .eq("reservacion_fija_id", reservaFijaId)
        .gt("hora_inicio", costaRicaNow())
        .order("hora_inicio", { ascending: true });

      if (error) throw error;

      setReservas(data || []);
    } catch (error) {
      console.error("Error fetching reservas:", error);
    } finally {
      setLoadingReservas(false);
    }
  };

  const handleUpdateReservaFija = async () => {
    if (!reservaFija) return;

    setUpdating(true);
    setUpdateErrorMessage("");
    try {
      // Update the reserva_fija
      const { error: updateError } = await supabase
        .from("reservas_fijas")
        .update({
          nombre_reserva_fija: editNombre,
          correo_reserva_fija: editCorreo || null,
          celular_reserva_fija: editCelular || null,
          precio: editPrecio,
          arbitro: editArbitro,
          es_reto: editEsReto,
          fut: editFut,
          dia: editDia,
          hora_inicio: editHoraInicio,
          hora_fin: editHoraFin,
        })
        .eq("id", reservaFija.id).select("id").single();

      if (updateError) throw updateError;

      // The database synchronizes future reservations and retos in the same transaction.

      // Send email for the closest upcoming reservation if correo is provided
      if (editCorreo && editCorreo.trim()) {
        try {
          // Get the closest upcoming reservation (already filtered by fetchReservas to be today or later)
          const { data: upcomingReservas } = await supabase
            .from("reservas")
            .select("*")
            .eq("reservacion_fija_id", reservaFija.id)
            .gt("hora_inicio", costaRicaNow())
            .order("hora_inicio", { ascending: true })
            .limit(1);

          if (upcomingReservas && upcomingReservas.length > 0) {
            const closestReserva = upcomingReservas[0];
            const djangoApiUrl = import.meta.env.VITE_DJANGO_API_URL || "";

            if (djangoApiUrl) {
              const reservaUrl = `${window.location.origin}/reserva/${closestReserva.id}`;
              const cancha =
                canchas.find((c) => c.id === reservaFija.cancha_id) ||
                reservaFija.cancha;

              const emailPayload = {
                reserva_id: closestReserva.id,
                hora_inicio: closestReserva.hora_inicio,
                hora_fin: closestReserva.hora_fin,
                cancha_id: reservaFija.cancha_id,
                cancha_nombre: cancha?.nombre || "",
                cancha_local: cancha?.local || 1,
                nombre_reserva: editNombre,
                celular_reserva: editCelular || "",
                correo_reserva: editCorreo,
                precio: closestReserva.precio,
                arbitro: closestReserva.arbitro,
                jugadores:
                  parseInt(cancha?.cantidad?.toString() || "0", 10) * 2,
                reserva_url: reservaUrl,
              };

              await fetch(`${djangoApiUrl}/tellos/confirm-reservation`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(emailPayload),
              });
            }
          }
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          // Don't fail the update if email fails
        }
      }

      setShowUpdateConfirm(false);

      onUpdate();
      if (reservaFija) {
        await fetchReservas(reservaFija.id);
      }
    } catch (error) {
      console.error("Error updating reserva fija:", error);
      if (isReservaConflictError(error)) {
        setUpdateErrorMessage("No se pudo actualizar: hay un conflicto en el horario elegido. No se guardó ningún cambio.");
      } else {
        setUpdateErrorMessage("No se pudo actualizar la reservación fija. No se guardó ningún cambio. Intente de nuevo.");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteReservaFija = async () => {
    if (!reservaFija) return;

    setUpdating(true);
    try {
      const { error: deleteReservasError } = await supabase
        .from("reservas")
        .delete()
        .eq("reservacion_fija_id", reservaFija.id)
        .gt("hora_inicio", costaRicaNow());

      if (deleteReservasError) throw deleteReservasError;

      // Delete the reserva_fija
      const { error: deleteError } = await supabase
        .from("reservas_fijas")
        .delete()
        .eq("id", reservaFija.id);

      if (deleteError) throw deleteError;

      setShowDeleteConfirm(false);
      onDelete();
      onClose();
    } catch (error) {
      console.error("Error deleting reserva fija:", error);
      alert("Error al eliminar la reservación fija");
    } finally {
      setUpdating(false);
    }
  };

  const handleShowUpdateConfirm = () => {
    if (!reservaFija) return;

    const changes: string[] = [];

    if (editDia !== reservaFija.dia) {
      const oldDay = DAYS_OF_WEEK.find(
        (d) => d.value === reservaFija.dia,
      )?.label;
      const newDay = DAYS_OF_WEEK.find((d) => d.value === editDia)?.label;
      changes.push(`Día cambiado de ${oldDay} a ${newDay}`);
    }

    if (
      editHoraInicio !== reservaFija.hora_inicio ||
      editHoraFin !== reservaFija.hora_fin
    ) {
      changes.push(
        `Hora cambiada de ${formatHourAmPm(reservaFija.hora_inicio)} - ${formatHourAmPm(
          reservaFija.hora_fin,
        )} a ${formatHourAmPm(editHoraInicio)} - ${formatHourAmPm(editHoraFin)}`,
      );
    }

    if (editArbitro !== Boolean(reservaFija.arbitro)) changes.push(editArbitro ? "Se agregará árbitro y ₡5,000 a las próximas reservaciones que aún no lo incluyen." : "Se quitará el árbitro y se restarán ₡5,000 donde esté incluido.");
    if (editPrecio !== reservaFija.precio) changes.push(`Precio por nueva reservación: ₡${editPrecio.toLocaleString()}.`);
    if (editEsReto !== Boolean(reservaFija.es_reto)) changes.push(editEsReto ? "Se creará un reto por cada próxima reservación y por cada nueva fecha automática." : "Las nuevas fechas dejarán de crear retos. Los retos existentes se conservan.");
    setUpdateErrorMessage("");
    setChangesDescription(changes);
    setShowUpdateConfirm(true);
  };

  const formatReservaDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = MONTHS_SPANISH[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
  };

  if (!reservaFija) return null;

  const currentCancha =
    canchas.find((c) => c.id === reservaFija.cancha_id) || reservaFija.cancha;

  // Safety check: if no cancha data, don't render
  if (!currentCancha) {
    console.error("No cancha data available for reserva fija:", reservaFija);
    return null;
  }

  return (
    <>
      {/* Updating Overlay */}
      {updating && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <img
            src="/tellos-square.svg"
            alt="Futbol Tello"
            className="w-16 h-16 animate-spin"
          />
          <p className="mt-4 text-white text-lg font-semibold">Futbol Tello</p>
          <p className="mt-2 text-white/70 text-sm">
            Actualizando reservación fija...
          </p>
        </div>
      )}

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
                          Reservación Fija
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
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="divide-y divide-gray-200 px-4 sm:px-6">
                        <div className="space-y-6 pt-6 pb-5">
                          {/* Cancha Info */}
                          {currentCancha && (
                            <div>
                              <h3 className="text-sm/6 font-medium text-gray-900 mb-2">
                                Cancha
                              </h3>
                              <div className="flex items-center gap-4">
                                <img
                                  src={currentCancha.img}
                                  alt={currentCancha.nombre}
                                  className="size-16 rounded-lg object-cover"
                                />
                                <div className="flex-1">
                                  <h3 className="text-base font-semibold text-gray-900">
                                    {currentCancha.nombre}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {getLocalName(currentCancha.local)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Day Selection */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm/6 font-medium text-gray-900">
                                Día
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowDiaEdit(!showDiaEdit)}
                                className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <PencilSquareIcon
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </button>
                            </div>
                            {showDiaEdit ? (
                              <div className="mt-2 grid grid-cols-1">
                                <select
                                  value={editDia}
                                  onChange={(e) =>
                                    setEditDia(Number(e.target.value))
                                  }
                                  className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white border border-gray-300 py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                >
                                  {DAYS_OF_WEEK.map((day) => (
                                    <option
                                      key={day.value}
                                      value={day.value}
                                      className="bg-white text-gray-900"
                                    >
                                      {day.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDownIcon
                                  aria-hidden="true"
                                  className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-400 sm:size-4"
                                />
                              </div>
                            ) : (
                              <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6">
                                {
                                  DAYS_OF_WEEK.find((d) => d.value === editDia)
                                    ?.label
                                }
                              </div>
                            )}
                          </div>

                          {/* Hour Selection */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm/6 font-medium text-gray-900">
                                Hora
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowHoraEdit(!showHoraEdit)}
                                className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <PencilSquareIcon
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </button>
                            </div>
                            {showHoraEdit ? (
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Hora de inicio
                                  </label>
                                  <input
                                    type="time"
                                    value={editHoraInicio}
                                    onChange={(e) => {
                                      const newHoraInicio = e.target.value;
                                      setEditHoraInicio(newHoraInicio);

                                      // Automatically calculate hora_fin as hora_inicio + 1 hour
                                      if (newHoraInicio) {
                                        const [hours, minutes] =
                                          newHoraInicio.split(":");
                                        const nextHour =
                                          (parseInt(hours, 10) + 1) % 24;
                                        const horaFin = `${String(nextHour).padStart(2, "0")}:${minutes}`;
                                        setEditHoraFin(horaFin);
                                      }
                                    }}
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Hora de fin
                                  </label>
                                  <input
                                    type="time"
                                    value={editHoraFin}
                                    onChange={(e) =>
                                      setEditHoraFin(e.target.value)
                                    }
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-gray-900 bg-gray-50 border border-gray-300 rounded-md px-3 py-1.5">
                                <FaRegClock className="text-primary" />
                                {formatHourAmPm(editHoraInicio)} -{" "}
                                {formatHourAmPm(editHoraFin)}
                              </div>
                            )}
                          </div>

                          {/* Reservado por section */}
                          <div>
                            <h3 className="text-sm/6 font-medium text-gray-900 mb-3">
                              Reservado por
                            </h3>
                            <div className="space-y-4">
                              <div>
                                <label
                                  htmlFor="reserva-nombre"
                                  className="block text-sm/6 font-medium text-gray-900"
                                >
                                  Nombre
                                </label>
                                <div className="mt-2">
                                  <input
                                    id="reserva-nombre"
                                    type="text"
                                    value={editNombre}
                                    onChange={(e) =>
                                      setEditNombre(e.target.value)
                                    }
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  />
                                </div>
                              </div>
                              <div>
                                <label
                                  htmlFor="reserva-correo"
                                  className="block text-sm/6 font-medium text-gray-900"
                                >
                                  Correo{" "}
                                  <span className="text-gray-500 font-normal">
                                    (Opcional)
                                  </span>
                                </label>
                                <div className="mt-2">
                                  <input
                                    id="reserva-correo"
                                    type="email"
                                    value={editCorreo}
                                    onChange={(e) =>
                                      setEditCorreo(e.target.value)
                                    }
                                    placeholder="correo@ejemplo.com"
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  />
                                </div>
                              </div>
                              <div>
                                <label
                                  htmlFor="reserva-celular"
                                  className="block text-sm/6 font-medium text-gray-900"
                                >
                                  Celular{" "}
                                  <span className="text-gray-500 font-normal">
                                    (Opcional)
                                  </span>
                                </label>
                                <div className="mt-2">
                                  <input
                                    id="reserva-celular"
                                    type="tel"
                                    value={editCelular}
                                    onChange={(e) =>
                                      setEditCelular(e.target.value)
                                    }
                                    placeholder="12345678"
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                            <span className="font-semibold">{reservaFija.frecuencia_semanas === 2 ? "Cada 2 semanas (14 días)" : "Cada semana"}</span>
                            {reservaFija.fecha_inicio && <span className="mt-1 block text-xs text-gray-500">Desde el {formatFixedDate(reservaFija.fecha_inicio)}</span>}
                          </div>
                          {isFullCancha(currentCancha) && (
                            <div>
                              <label htmlFor="fixed-edit-fut" className="mb-2 block text-sm font-medium text-gray-900">Modalidad</label>
                              <select id="fixed-edit-fut" value={editFut} onChange={(e) => { const fut = Number(e.target.value); setEditFut(fut); setEditPrecio(canchaPrice(currentCancha, fut, editArbitro)); }} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                                {[7, 8, 9].map((fut) => <option key={fut} value={fut}>FUT {fut}</option>)}
                              </select>
                            </div>
                          )}
                          <ReservaFijaOptions editing arbitro={editArbitro} esReto={editEsReto}
                            onRefereeChange={(value) => { setEditPrecio(refereeAdjustedPrice(editPrecio, editArbitro, value)); setEditArbitro(value); }} onRetoChange={setEditEsReto} />

                          {/* Price Information */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm/6 font-medium text-gray-900">
                                Precio
                              </h3>
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPrecioEdit(!showPrecioEdit)
                                }
                                className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <PencilSquareIcon
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </button>
                            </div>
                            {showPrecioEdit ? (
                              <div className="space-y-2">
                                <div>
                                  <label
                                    htmlFor="reserva-precio"
                                    className="block text-sm/6 font-medium text-gray-900 mb-2"
                                  >
                                    Precio total
                                  </label>
                                  <input
                                    id="reserva-precio"
                                    type="number"
                                    value={editPrecio}
                                    onChange={(e) =>
                                      setEditPrecio(Number(e.target.value))
                                    }
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                    placeholder="0"
                                    min="0"
                                    step="1000"
                                  />
                                </div>
                                {editArbitro && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <GiWhistle className="text-primary" />
                                      <span>Árbitro incluido</span>
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">
                                    Precio total:
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    ₡{editPrecio.toLocaleString()}
                                  </span>
                                </div>
                                {editArbitro && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <GiWhistle className="text-primary" />
                                      <span>Árbitro incluido</span>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>

                          {/* Related Reservas */}
                          <div>
                            <h3 className="text-sm/6 font-medium text-gray-900 mb-3">
                              Reservaciones Generadas
                            </h3>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                              <p className="text-xs text-blue-900">
                                Se generan reservaciones {reservaFija.frecuencia_semanas === 2 ? "cada 2 semanas" : "cada semana"}, hasta 8 semanas adelante. Las fechas canceladas no se vuelven a crear.
                              </p>
                            </div>
                            {loadingReservas ? (
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                        Fecha
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                        Hora
                                      </th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {reservas.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={3}
                                          className="px-4 py-3 text-sm text-gray-500 text-center"
                                        >
                                          No hay reservaciones generadas
                                        </td>
                                      </tr>
                                    ) : (
                                      reservas.map((reserva) => (
                                        <tr key={reserva.id}>
                                          <td className="px-4 py-3 text-sm text-gray-900">
                                            {formatReservaDate(
                                              reserva.hora_inicio,
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-500">
                                            {formatHourAmPm(
                                              extractTimeFromTimestamp(
                                                reserva.hora_inicio,
                                              ),
                                            )}{" "}
                                            -{" "}
                                            {formatHourAmPm(
                                              extractTimeFromTimestamp(
                                                reserva.hora_fin,
                                              ),
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onClose();
                                                navigate(`/admin?reserva_id=${reserva.id}`);
                                              }}
                                              className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                                            >
                                              Ver
                                            </button>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 justify-between px-4 py-4">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={updating}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                      Eliminar
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={handleShowUpdateConfirm}
                        disabled={updating || !editNombre.trim() || !Number.isFinite(editPrecio) || editPrecio < 0}
                        className="inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-700 disabled:cursor-not-allowed"
                      >
                        {updating ? "Actualizando..." : "Actualizar"}
                      </button>
                    </div>
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>

      <RetoConfirmDialog
        open={showUpdateConfirm} title="Actualizar reservación fija" tone="primary"
        description={`Los cambios se aplicarán a ${reservas.length} próximas reservaciones y a las que se generen después. Las reservaciones pasadas se conservan. ${changesDescription.join(" ")}`}
        confirmLabel="Actualizar" busy={updating} error={updateErrorMessage}
        onCancel={() => setShowUpdateConfirm(false)} onConfirm={handleUpdateReservaFija}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Está seguro de eliminar esta reservación fija?
              </DialogTitle>
              <p className="text-sm text-gray-600 mb-4">
                Esta acción eliminará también todas las reservaciones
                relacionadas ({reservas.length} reservaciones). Esta acción no
                se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  No, mantener
                </button>
                <button
                  onClick={handleDeleteReservaFija}
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
