import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  LinkIcon,
  PencilSquareIcon,
  ChevronDownIcon,
} from "@heroicons/react/20/solid";
import { FaCheck, FaRegCalendarCheck, FaRegClock } from "react-icons/fa";
import { GiWhistle } from "react-icons/gi";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  local: number;
  cantidad?: string;
  precio?: string;
}

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  correo_reserva: string;
  sinpe_reserva: string | null;
  confirmada: boolean | null;
  confirmada_por: string | null;
  precio: number;
  arbitro: boolean;
  cancha: Cancha;
}

interface Configuracion {
  apertura_guada: string;
  apertura_sabana: string;
  cierre_sabana: string;
  cierre_guada: string;
}

interface ReservationDrawerProps {
  open: boolean;
  onClose: () => void;
  reserva: Reserva | null;
  mode: "edit" | "cancel";
  onUpdate: (updates: {
    hora_inicio: string;
    hora_fin: string;
    nombre_reserva: string;
    correo_reserva: string;
    celular_reserva: string;
    precio: number;
    cancha_id?: number;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onConfirmSinpe: (id: number, hasComprobante: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
  user: User | null;
}

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

const DAYS_SPANISH = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function ReservationDrawer({
  open,
  onClose,
  reserva,
  mode,
  onUpdate,
  onDelete,
  onConfirmSinpe,
  onRefresh,
}: ReservationDrawerProps) {
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(
    null
  );
  const [canchas, setCanchas] = useState<Cancha[]>([]);

  // Form state for editing
  const [editNombre, setEditNombre] = useState("");
  const [editCorreo, setEditCorreo] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editPrecio, setEditPrecio] = useState<number>(0);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editHour, setEditHour] = useState<number | null>(null);
  const [editCanchaId, setEditCanchaId] = useState<number | null>(null);
  const [availableHours, setAvailableHours] = useState<number[]>([]);
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [showHourSelector, setShowHourSelector] = useState(false);
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [showCanchaSelector, setShowCanchaSelector] = useState(false);
  const [showPrecioEdit, setShowPrecioEdit] = useState(false);

  // Confirmation dialogs
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSinpeConfirm, setShowSinpeConfirm] = useState(false);
  const [showSinpeNoComprobanteConfirm, setShowSinpeNoComprobanteConfirm] =
    useState(false);
  const [showSinpeSuccess, setShowSinpeSuccess] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Generate dates for today + 10 days
  const dates = Array.from({ length: 11 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  // Fetch configuracion and canchas
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configResult, canchasResult] = await Promise.all([
          supabase.from("configuracion").select("*").limit(1).single(),
          supabase.from("canchas").select("id, nombre, img, local").order("id"),
        ]);

        if (configResult.error) throw configResult.error;
        if (canchasResult.error) throw canchasResult.error;

        // Sort canchas: Sabana (local == 1) first, then Guadalupe (local == 2), then by id
        const sortedCanchas = (canchasResult.data || []).sort((a, b) => {
          if (a.local !== b.local) {
            return a.local - b.local;
          }
          return a.id - b.id;
        });

        setConfiguracion(configResult.data);
        setCanchas(sortedCanchas);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Initialize form when reserva changes
  useEffect(() => {
    if (reserva) {
      setEditNombre(reserva.nombre_reserva);
      setEditCorreo(reserva.correo_reserva);
      setEditCelular(reserva.celular_reserva);
      setEditPrecio(reserva.precio);
      setEditCanchaId(reserva.cancha.id);

      const date = parseDateFromTimestamp(reserva.hora_inicio);
      setEditDate(date);
      const hour = parseHourFromTimestamp(reserva.hora_inicio);
      setEditHour(hour);
      setShowHourSelector(false);
      setShowDateSelector(false);
      setShowCanchaSelector(false);
      setShowPrecioEdit(false);
    }
  }, [reserva]);

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseDateFromTimestamp = (timestamp: string): Date => {
    const match = timestamp.match(
      /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/
    );
    if (match) {
      return new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5]),
        parseInt(match[6])
      );
    }
    return new Date(timestamp);
  };

  const parseHourFromTimestamp = (timestamp: string): number => {
    const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      return parseInt(timeMatch[1], 10);
    }
    return new Date(timestamp).getHours();
  };

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `Local ${local}`;
  };

  // Calculate available hours when date/cancha changes
  useEffect(() => {
    if (!reserva || !configuracion || !editDate) return;

    const calculateAvailableHours = async () => {
      const currentCanchaId = editCanchaId || reserva.cancha.id;
      const currentCancha =
        canchas.find((c) => c.id === currentCanchaId) || reserva.cancha;

      const aperturaStr =
        currentCancha.local === 1
          ? configuracion.apertura_sabana
          : configuracion.apertura_guada;
      const cierreStr =
        currentCancha.local === 1
          ? configuracion.cierre_sabana
          : configuracion.cierre_guada;

      const parseTimeToHour = (timeStr: string): number => {
        return parseInt(timeStr.split(":")[0], 10);
      };

      const apertura = parseTimeToHour(aperturaStr);
      let cierre = parseTimeToHour(cierreStr);

      if (cierre <= apertura) {
        cierre = cierre + 24;
      }

      const hours: number[] = [];
      for (let h = apertura; h < cierre; h++) {
        const displayHour = h < 24 ? h : h - 24;
        hours.push(displayHour);
      }

      // Check if date is today
      const today = new Date();
      const isTodayDate =
        editDate.getDate() === today.getDate() &&
        editDate.getMonth() === today.getMonth() &&
        editDate.getFullYear() === today.getFullYear();

      if (isTodayDate) {
        const getCurrentHourCR = (): number => {
          const now = new Date();
          const crTime = new Date(
            now.toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
          );
          return crTime.getHours();
        };
        const currentHour = getCurrentHourCR();
        const filteredHours = hours.filter((h) => h > currentHour);
        setAvailableHours(filteredHours);
      } else {
        setAvailableHours(hours);
      }

      // Fetch reserved hours
      const dateStr = formatLocalDate(editDate);
      const startOfDay = `${dateStr} 00:00:00`;
      const endOfDay = `${dateStr} 23:59:59`;

      const LINKED_CANCHAS = [1, 3, 5];
      let canchaIds: number[];
      if (currentCanchaId === 6) {
        canchaIds = [6, ...LINKED_CANCHAS];
      } else if (LINKED_CANCHAS.includes(currentCanchaId)) {
        canchaIds = [currentCanchaId, 6];
      } else {
        canchaIds = [currentCanchaId];
      }

      const { data: reservasData } = await supabase
        .from("reservas")
        .select("hora_inicio")
        .in("cancha_id", canchaIds)
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay)
        .neq("id", reserva.id); // Exclude current reservation

      const reserved = (reservasData || []).map((r) =>
        parseHourFromTimestamp(r.hora_inicio)
      );
      setReservedHours(reserved);
    };

    calculateAvailableHours();
  }, [reserva, configuracion, editDate, editCanchaId, canchas]);

  const handleUpdateReserva = async () => {
    if (!reserva || !editDate || editHour === null) return;

    setUpdating(true);
    try {
      const horaInicio = new Date(editDate);
      horaInicio.setHours(editHour, 0, 0, 0);
      const horaFin = new Date(horaInicio);
      horaFin.setHours(horaFin.getHours() + 1);

      const formatLocalTimestamp = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      await onUpdate({
        hora_inicio: formatLocalTimestamp(horaInicio),
        hora_fin: formatLocalTimestamp(horaFin),
        nombre_reserva: editNombre,
        correo_reserva: editCorreo,
        celular_reserva: editCelular,
        precio: editPrecio,
        ...(editCanchaId && editCanchaId !== reserva.cancha.id
          ? { cancha_id: editCanchaId }
          : {}),
      });

      setShowUpdateConfirm(false);
      // Refresh the table first
      await onRefresh();
      // Don't close the drawer - keep it open
    } catch (error) {
      console.error("Error updating reserva:", error);
      alert("Error al actualizar la reservación");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmSinpe = async () => {
    if (!reserva) return;

    const hasComprobante = reserva.sinpe_reserva !== null;
    if (!hasComprobante) {
      setShowSinpeConfirm(false);
      setShowSinpeNoComprobanteConfirm(true);
      return;
    }

    await onConfirmSinpe(reserva.id, hasComprobante);
    setShowSinpeConfirm(false);
    setShowSinpeSuccess(true);
  };

  const handleConfirmSinpeNoComprobante = async () => {
    if (!reserva) return;

    await onConfirmSinpe(reserva.id, false);
    setShowSinpeNoComprobanteConfirm(false);
    setShowSinpeSuccess(true);
  };

  const handleDeleteReserva = async () => {
    if (!reserva) return;

    setUpdating(true);
    try {
      await onDelete(reserva.id);
      setShowCancelConfirm(false);
      onClose();
      await onRefresh();
    } catch (error) {
      console.error("Error deleting reserva:", error);
      alert("Error al cancelar la reservación");
    } finally {
      setUpdating(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setEditDate(date);
    setEditHour(null);
    setShowDateSelector(false);
    setShowHourSelector(true);
  };

  const handleCanchaSelect = (canchaId: number) => {
    setEditCanchaId(canchaId);
    setShowCanchaSelector(false);
    setEditDate(null);
    setEditHour(null);
    setShowDateSelector(true);
  };

  if (!reserva) return null;

  // Sort canchas: Sabana (local == 1) first, then Guadalupe (local == 2), then by id
  const sortedCanchas = [...canchas].sort((a, b) => {
    if (a.local !== b.local) {
      return a.local - b.local;
    }
    return a.id - b.id;
  });

  const currentCancha =
    canchas.find((c) => c.id === (editCanchaId || reserva.cancha.id)) ||
    reserva.cancha;
  const isSabana = currentCancha.local === 1;

  return (
    <>
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
                          {mode === "edit"
                            ? "Editar Reservación"
                            : "Cancelar Reservación"}
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
                          {mode === "edit"
                            ? "Edita la información de la reservación."
                            : "Revisa la información antes de cancelar."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="divide-y divide-gray-200 px-4 sm:px-6">
                        <div className="space-y-6 pt-6 pb-5">
                          {/* Cancha Info */}
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
                            {mode === "edit" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowCanchaSelector(!showCanchaSelector)
                                }
                                className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <PencilSquareIcon
                                  aria-hidden="true"
                                  className="size-5"
                                />
                              </button>
                            )}
                          </div>

                          {/* Cancha Selector */}
                          {showCanchaSelector && mode === "edit" && (
                            <div className="space-y-4 rounded-lg bg-gray-50 p-4 border border-gray-200">
                              <label className="block text-sm/6 font-medium text-gray-900">
                                Seleccionar Cancha
                              </label>
                              <div className="mt-2 grid grid-cols-1">
                                <select
                                  value={editCanchaId || ""}
                                  onChange={(e) =>
                                    handleCanchaSelect(Number(e.target.value))
                                  }
                                  className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white border border-gray-300 py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                >
                                  {sortedCanchas.map((cancha) => (
                                    <option
                                      key={cancha.id}
                                      value={cancha.id}
                                      className="bg-white text-gray-900"
                                    >
                                      {cancha.nombre} -{" "}
                                      {getLocalName(cancha.local)}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDownIcon
                                  aria-hidden="true"
                                  className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-400 sm:size-4"
                                />
                              </div>
                            </div>
                          )}

                          {/* Date Selection */}
                          <div>
                            <label
                              htmlFor="reserva-date"
                              className="block text-sm/6 font-medium text-gray-900"
                            >
                              Fecha
                            </label>
                            <div className="mt-2 flex items-center gap-2">
                              {mode === "edit" ? (
                                <>
                                  <input
                                    id="reserva-date"
                                    type="text"
                                    value={
                                      editDate
                                        ? `${editDate.getDate()} de ${
                                            MONTHS_SPANISH[editDate.getMonth()]
                                          } de ${editDate.getFullYear()}`
                                        : ""
                                    }
                                    readOnly
                                    className="flex-1 block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowDateSelector(!showDateSelector)
                                    }
                                    className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                  >
                                    <PencilSquareIcon
                                      aria-hidden="true"
                                      className="size-5"
                                    />
                                  </button>
                                </>
                              ) : (
                                <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6">
                                  {editDate
                                    ? `${editDate.getDate()} de ${
                                        MONTHS_SPANISH[editDate.getMonth()]
                                      } de ${editDate.getFullYear()}`
                                    : ""}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Date Selector */}
                          {showDateSelector && mode === "edit" && (
                            <div className="space-y-4 rounded-lg bg-gray-50 p-4 border border-gray-200">
                              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                <FaRegCalendarCheck className="text-secondary" />
                                Seleccione una fecha
                              </h3>
                              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {dates.map((date, index) => {
                                  const isSelected =
                                    editDate &&
                                    date.toDateString() ===
                                      editDate.toDateString();
                                  const isToday = index === 0;
                                  return (
                                    <button
                                      key={date.toISOString()}
                                      type="button"
                                      onClick={() => handleDateSelect(date)}
                                      className={`shrink-0 w-16 py-3 rounded-xl border transition-all flex flex-col items-center ${
                                        isSelected
                                          ? "bg-primary border-primary text-white"
                                          : "bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10"
                                      }`}
                                    >
                                      <span className="text-4xl tracking-tighter font-semibold">
                                        {date.getDate()}
                                      </span>
                                      <span className="text-xs tracking-tight uppercase mt-1.5">
                                        {isToday
                                          ? "Hoy"
                                          : DAYS_SPANISH[date.getDay()]}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Hour Selection */}
                          <div>
                            <label className="block text-sm/6 font-medium text-gray-900">
                              Hora
                            </label>
                            <div className="mt-2">
                              {mode === "edit" ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={
                                        editHour !== null
                                          ? `${String(editHour).padStart(
                                              2,
                                              "0"
                                            )}:00`
                                          : ""
                                      }
                                      readOnly
                                      className="flex-1 block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowHourSelector(!showHourSelector)
                                      }
                                      className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                    >
                                      <PencilSquareIcon
                                        aria-hidden="true"
                                        className="size-5"
                                      />
                                    </button>
                                  </div>
                                  {showHourSelector && (
                                    <div className="space-y-3 rounded-lg bg-gray-50 p-4 border border-gray-200">
                                      <h3 className="text-sm font-medium text-gray-900 flex gap-2 items-center">
                                        <FaRegClock className="text-secondary" />
                                        Seleccione una hora
                                      </h3>
                                      <div className="grid grid-cols-4 gap-2">
                                        {availableHours.map((hour) => {
                                          const isReserved =
                                            reservedHours.includes(hour);
                                          const isSelected = editHour === hour;
                                          return (
                                            <button
                                              key={hour}
                                              type="button"
                                              onClick={() => {
                                                if (!isReserved) {
                                                  setEditHour(hour);
                                                  setShowHourSelector(false);
                                                }
                                              }}
                                              disabled={isReserved}
                                              className={`py-3 text-base tracking-tight rounded-lg border transition-all font-medium ${
                                                isReserved
                                                  ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed line-through"
                                                  : isSelected
                                                  ? "bg-primary border-primary text-white"
                                                  : "bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10"
                                              }`}
                                            >
                                              {hour}:00
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {availableHours.every((h) =>
                                        reservedHours.includes(h)
                                      ) && (
                                        <p className="text-gray-500 text-sm text-center mt-4">
                                          No hay horarios disponibles para esta
                                          fecha
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6">
                                  {editHour !== null
                                    ? `${String(editHour).padStart(2, "0")}:00`
                                    : ""}
                                </div>
                              )}
                            </div>
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
                                    disabled={mode === "cancel"}
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm/6"
                                  />
                                </div>
                              </div>
                              <div>
                                <label
                                  htmlFor="reserva-correo"
                                  className="block text-sm/6 font-medium text-gray-900"
                                >
                                  Correo
                                </label>
                                <div className="mt-2">
                                  <input
                                    id="reserva-correo"
                                    type="email"
                                    value={editCorreo}
                                    onChange={(e) =>
                                      setEditCorreo(e.target.value)
                                    }
                                    disabled={mode === "cancel"}
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm/6"
                                  />
                                </div>
                              </div>
                              <div>
                                <label
                                  htmlFor="reserva-celular"
                                  className="block text-sm/6 font-medium text-gray-900"
                                >
                                  Celular
                                </label>
                                <div className="mt-2">
                                  <input
                                    id="reserva-celular"
                                    type="tel"
                                    value={editCelular}
                                    onChange={(e) =>
                                      setEditCelular(e.target.value)
                                    }
                                    disabled={mode === "cancel"}
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm/6"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Price Information */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm/6 font-medium text-gray-900">
                                Precio
                              </h3>
                              {mode === "edit" && (
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
                              )}
                            </div>
                            {showPrecioEdit && mode === "edit" ? (
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
                                {isSabana && (
                                  <div className="flex justify-between text-sm text-gray-600">
                                    <span>Adelanto (50%):</span>
                                    <span>
                                      ₡
                                      {Math.ceil(
                                        editPrecio / 2
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {reserva.cancha.local === 2 &&
                                  reserva.arbitro && (
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
                                    ₡{reserva.precio.toLocaleString()}
                                  </span>
                                </div>
                                {isSabana && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">
                                      Adelanto (50%):
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      ₡
                                      {Math.ceil(
                                        reserva.precio / 2
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {reserva.cancha.local === 2 &&
                                  reserva.arbitro && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <GiWhistle className="text-primary" />
                                      <span>Árbitro incluido</span>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>

                          {/* SINPE Section (Sabana only) */}
                          {isSabana && (
                            <div>
                              <h3 className="text-sm/6 font-medium text-gray-900 mb-3">
                                Comprobante SINPE (adelanto)
                              </h3>
                              {reserva.sinpe_reserva ? (
                                <div className="space-y-3">
                                  <img
                                    src={reserva.sinpe_reserva}
                                    alt="Comprobante SINPE"
                                    className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                                  />
                                  {reserva.confirmada && (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                      <div className="flex items-center gap-2 text-primary">
                                        <FaCheck className="text-primary" />
                                        <span className="text-sm font-medium">
                                          Confirmada por:{" "}
                                          {reserva.confirmada_por || "Admin"}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {mode === "edit" && !reserva.confirmada && (
                                    <button
                                      type="button"
                                      onClick={() => setShowSinpeConfirm(true)}
                                      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                                    >
                                      Confirmar SINPE
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {reserva.confirmada ? (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                      <div className="flex items-center gap-2 text-primary">
                                        <FaCheck className="text-primary" />
                                        <span className="text-sm font-medium text-primary">
                                          Confirmada por:{" "}
                                          {reserva.confirmada_por || "Admin"}{" "}
                                          (No hay comprobante)
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-sm text-gray-600">
                                        SINPE pendiente
                                      </p>
                                      {mode === "edit" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setShowSinpeConfirm(true)
                                          }
                                          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                                        >
                                          Confirmar SINPE
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="pt-4 pb-6">
                          <div className="flex text-sm">
                            <a
                              href={`${window.location.origin}/reserva/${reserva.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center font-medium text-primary hover:text-primary/80"
                            >
                              <LinkIcon
                                aria-hidden="true"
                                className="size-5 text-primary group-hover:text-primary/80"
                              />
                              <span className="ml-2">
                                Ir a vista del cliente
                              </span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 justify-end px-4 py-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                    {mode === "edit" ? (
                      <button
                        type="button"
                        onClick={() => setShowUpdateConfirm(true)}
                        disabled={
                          updating ||
                          !editNombre ||
                          !editCorreo ||
                          !editCelular ||
                          editHour === null ||
                          !editDate
                        }
                        className="ml-4 inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-700 disabled:cursor-not-allowed"
                      >
                        {updating ? "Actualizando..." : "Actualizar"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={updating}
                        className="ml-4 inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed"
                      >
                        {updating ? "Cancelando..." : "Cancelar Reservación"}
                      </button>
                    )}
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Update Confirmation Dialog */}
      <Dialog
        open={showUpdateConfirm}
        onClose={() => setShowUpdateConfirm(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Está seguro de actualizar esta reservación?
              </DialogTitle>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpdateConfirm(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateReserva}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                >
                  Actualizar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Está seguro de cancelar esta reservación?
              </DialogTitle>
              <p className="text-sm text-gray-600 mb-4">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  No, mantener
                </button>
                <button
                  onClick={handleDeleteReserva}
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                >
                  Sí, cancelar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* SINPE Confirmation Dialog */}
      <Dialog
        open={showSinpeConfirm}
        onClose={() => setShowSinpeConfirm(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Confirmar el SINPE de esta reservación?
              </DialogTitle>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSinpeConfirm(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSinpe}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                >
                  Confirmar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* SINPE No Comprobante Confirmation Dialog */}
      <Dialog
        open={showSinpeNoComprobanteConfirm}
        onClose={() => setShowSinpeNoComprobanteConfirm(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Confirmar sin comprobante?
              </DialogTitle>
              <p className="text-sm text-gray-600 mb-4">
                ¿Está seguro de confirmar esta reservación sin comprobante
                SINPE? Esta acción confirmará el pago sin verificación del
                comprobante.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSinpeNoComprobanteConfirm(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSinpeNoComprobante}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                >
                  Confirmar sin comprobante
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* SINPE Success Dialog */}
      <Dialog
        open={showSinpeSuccess}
        onClose={() => setShowSinpeSuccess(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <div className="flex items-center gap-3 mb-4">
                <div className="shrink-0">
                  <FaCheck className="text-secondary text-2xl" />
                </div>
                <DialogTitle className="text-base font-semibold text-gray-900">
                  Reservación confirmada
                </DialogTitle>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                El SINPE ha sido confirmado exitosamente.
              </p>
              <button
                onClick={() => {
                  setShowSinpeSuccess(false);
                  onRefresh();
                }}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
              >
                Cerrar
              </button>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
