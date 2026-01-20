import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabase";
import { FaRegClock } from "react-icons/fa";
import { GiWhistle } from "react-icons/gi";
import { TbPlayFootball, TbRun } from "react-icons/tb";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio?: string;
}

interface Configuracion {
  apertura_guada: string;
  apertura_sabana: string;
  cierre_sabana: string;
  cierre_guada: string;
}

interface CreateReservaFijaDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const ARBITRO_COST = 5000;
const LINKED_CANCHAS = [1, 3, 5];

const formatHourAmPm = (hour: number): string => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
};

export default function CreateReservaFijaDrawer({
  open,
  onClose,
  onSuccess,
}: CreateReservaFijaDrawerProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [selectedCancha, setSelectedCancha] = useState<Cancha | null>(null);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(
    null
  );
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<number | null>(null);
  const [arbitro, setArbitro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 2 states
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");

  // Custom price state
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [showPriceEdit, setShowPriceEdit] = useState(false);

  // Success notification state
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Confirmation and conflict states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [conflictDates, setConflictDates] = useState<Date[]>([]);
  const [availableDatesToCreate, setAvailableDatesToCreate] = useState<Date[]>([]);

  // Fetch canchas and configuracion
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [canchasResult, configResult] = await Promise.all([
          supabase.from("canchas").select("*").order("id"),
          supabase.from("configuracion").select("*").limit(1).single(),
        ]);

        if (canchasResult.error) throw canchasResult.error;
        if (configResult.error) throw configResult.error;

        // Sort canchas: Sabana (local == 1) first, then Guadalupe (local == 2), then by id
        const sortedCanchas = (canchasResult.data || []).sort((a, b) => {
          if (a.local !== b.local) {
            return a.local - b.local;
          }
          return a.id - b.id;
        });

        setCanchas(sortedCanchas);
        setConfiguracion(configResult.data);

        // Set default cancha
        if (sortedCanchas.length > 0) {
          setSelectedCancha(sortedCanchas[0]);
          if (sortedCanchas[0].cantidad === "7-8-9") {
            setSelectedPlayers(7);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedDay(1);
      setSelectedHour(null);
      setSelectedPlayers(null);
      setArbitro(false);
      setNombre("");
      setCelular("");
      setCorreo("");
      setCustomPrice(null);
      setShowPriceEdit(false);
    }
  }, [open]);

  // Reset custom price when cancha, players, or arbitro changes
  useEffect(() => {
    setCustomPrice(null);
    setShowPriceEdit(false);
  }, [selectedCancha?.id, selectedPlayers, arbitro]);

  const parseTimeToHour = (timeStr: string): number => {
    return parseInt(timeStr.split(":")[0], 10);
  };

  const getAvailableHours = (): number[] => {
    if (!configuracion || !selectedCancha) return [];

    const aperturaStr =
      selectedCancha.local === 1
        ? configuracion.apertura_sabana
        : configuracion.apertura_guada;
    const cierreStr =
      selectedCancha.local === 1
        ? configuracion.cierre_sabana
        : configuracion.cierre_guada;

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

    return hours;
  };

  const isSpecialCancha = selectedCancha?.cantidad === "7-8-9";

  const parsePrecio = (precioStr: string | undefined): number => {
    if (!precioStr) return 0;
    return parseInt(precioStr.replace(/\./g, ""), 10) || 0;
  };

  const getBasePrice = (): number => {
    if (!selectedCancha) return 0;

    if (isSpecialCancha && selectedPlayers) {
      if (selectedPlayers === 7) return 40000;
      if (selectedPlayers === 8) return 45000;
      if (selectedPlayers === 9) return 50000;
    }

    return parsePrecio(selectedCancha.precio);
  };

  const getPrice = (): number => {
    // If custom price is set, use it
    if (customPrice !== null && customPrice > 0) {
      return customPrice;
    }
    // Otherwise, calculate the default price
    const arbitroCost =
      selectedCancha?.local === 2 && arbitro ? ARBITRO_COST : 0;
    return getBasePrice() + arbitroCost;
  };

  const handleNextStep = () => {
    if (!selectedCancha || selectedHour === null) return;
    setStep(2);
  };

  const handleBackStep = () => {
    setStep(1);
  };

  // Get next 4 weeks of dates for the selected day
  const getNext4WeeksDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();

    // Find the next occurrence of the selected day
    let currentDate = new Date(today);
    const targetDay = selectedDay === 7 ? 0 : selectedDay; // Convert to JS day (0 = Sunday)

    while (currentDate.getDay() !== targetDay) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add the next 4 occurrences
    for (let i = 0; i < 4; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return dates;
  };

  const checkForConflicts = async (dates: Date[]): Promise<Date[]> => {
    if (!selectedCancha || selectedHour === null) return [];

    const conflicts: Date[] = [];

    for (const date of dates) {
      const dateStr = formatLocalDate(date);
      const startOfDay = `${dateStr} 00:00:00`;
      const endOfDay = `${dateStr} 23:59:59`;

      let canchaIds: number[];
      if (selectedCancha.id === 6) {
        canchaIds = [6, ...LINKED_CANCHAS];
      } else if (LINKED_CANCHAS.includes(selectedCancha.id)) {
        canchaIds = [selectedCancha.id, 6];
      } else {
        canchaIds = [selectedCancha.id];
      }

      const { data: reservasData } = await supabase
        .from("reservas")
        .select("hora_inicio")
        .in("cancha_id", canchaIds)
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay);

      const hours = (reservasData || []).map((r) =>
        parseHourFromTimestamp(r.hora_inicio)
      );

      if (hours.includes(selectedHour)) {
        conflicts.push(date);
      }
    }

    return conflicts;
  };

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseHourFromTimestamp = (timestamp: string): number => {
    const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      return parseInt(timeMatch[1], 10);
    }
    return new Date(timestamp).getHours();
  };

  const handleConfirmar = async () => {
    if (submitting || !selectedCancha || selectedHour === null || !nombre.trim())
      return;

    const dates = getNext4WeeksDates();
    const conflicts = await checkForConflicts(dates);
    const availableDates = dates.filter(
      (date) => !conflicts.some((c) => c.getTime() === date.getTime())
    );

    setConflictDates(conflicts);
    setAvailableDatesToCreate(availableDates);
    setShowConfirmDialog(true);
  };

  const handleProceedWithCreation = async () => {
    setShowConfirmDialog(false);
    await createReservaFija(availableDatesToCreate);
  };

  const formatConflictDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleString("es-ES", { month: "long" });
    const year = date.getFullYear();
    const dayOfWeek = DAYS_OF_WEEK.find((d) => {
      const targetDay = d.value === 7 ? 0 : d.value;
      return date.getDay() === targetDay;
    })?.label || "";
    return `${dayOfWeek} ${day} de ${month} de ${year}`;
  };

  const createReservaFija = async (availableDates: Date[]) => {
    setSubmitting(true);

    try {
      // Create the reserva_fija
      const horaInicio = `${String(selectedHour).padStart(2, "0")}:00:00`;
      const horaFin = `${String((selectedHour! + 1) % 24).padStart(
        2,
        "0"
      )}:00:00`;

      const { data: reservaFijaData, error: reservaFijaError } = await supabase
        .from("reservas_fijas")
        .insert({
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          nombre_reserva_fija: nombre,
          celular_reserva_fija: celular || null,
          correo_reserva_fija: correo || null,
          cancha_id: selectedCancha!.id,
          precio: getPrice(),
          arbitro: arbitro,
          dia: selectedDay,
        })
        .select()
        .single();

      if (reservaFijaError) throw reservaFijaError;

      // Create reservas for available dates only
      if (availableDates.length > 0) {
        const formatLocalTimestamp = (d: Date, hour: number): string => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const hours = String(hour).padStart(2, "0");
          return `${year}-${month}-${day} ${hours}:00:00`;
        };

        const reservasToInsert = availableDates.map((date) => {
          const horaInicioTimestamp = formatLocalTimestamp(date, selectedHour!);
          
          // Calculate end hour and date
          const endHour = (selectedHour! + 1) % 24;
          const endDate = new Date(date);
          
          // If end hour wraps around (e.g., 23 -> 0), add one day
          if (endHour < selectedHour! || (endHour === 0 && selectedHour! === 23)) {
            endDate.setDate(endDate.getDate() + 1);
          }
          
          const horaFinTimestamp = formatLocalTimestamp(endDate, endHour);

          return {
            hora_inicio: horaInicioTimestamp,
            hora_fin: horaFinTimestamp,
            nombre_reserva: nombre,
            celular_reserva: celular || null,
            correo_reserva: correo || null,
            cancha_id: selectedCancha!.id,
            precio: getPrice(),
            arbitro: arbitro,
            reservacion_fija_id: reservaFijaData.id,
          };
        });

        const { error: reservasError } = await supabase
          .from("reservas")
          .insert(reservasToInsert);

        if (reservasError) throw reservasError;
      }

      // Success - show notification
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
        onSuccess();
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error creating reserva fija:", error);
      alert("Error al crear la reservación fija. Por favor intente de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const availableHours = getAvailableHours();
  const canProceedToStep2 = selectedCancha && selectedHour !== null;
  const canSubmit = nombre.trim() && !submitting;

  return (
    <>
      {/* Submitting Overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <img
            src="/tellos-square.svg"
            alt="Futbol Tello"
            className="w-16 h-16 animate-spin"
          />
          <p className="mt-4 text-white text-lg font-semibold">Futbol Tello</p>
          <p className="mt-2 text-white/70 text-sm">
            Creando reservación fija...
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
                  <div className="h-0 flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="bg-primary px-4 py-6 sm:px-6">
                      <div className="flex items-center justify-between">
                        <DialogTitle className="text-base font-semibold text-white">
                          {step === 1
                            ? "Crear Reservación Fija"
                            : "Confirmar Reservación Fija"}
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

                    <div className="flex flex-1 flex-col justify-between overflow-x-hidden">
                      <div className="divide-y divide-gray-200 px-4 sm:px-6 overflow-x-hidden">
                        {loading ? (
                          <div className="flex flex-col items-center justify-center py-12">
                            <img
                              src="/tellos-square.svg"
                              alt="Futbol Tello"
                              className="w-12 h-12 animate-spin"
                            />
                            <p className="mt-3 text-gray-900 text-base font-semibold">
                              Futbol Tello
                            </p>
                            <p className="mt-1 text-gray-500 text-sm">
                              Cargando...
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-6 pt-6 pb-5">
                            {step === 1 ? (
                              <>
                                {/* Cancha Selection */}
                                <div>
                                  <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                                    Cancha
                                  </label>
                                  <select
                                    value={selectedCancha?.id || ""}
                                    onChange={(e) => {
                                      const cancha = canchas.find(
                                        (c) => c.id === Number(e.target.value)
                                      );
                                      if (cancha) {
                                        setSelectedCancha(cancha);
                                        setSelectedHour(null);
                                        if (cancha.cantidad === "7-8-9") {
                                          setSelectedPlayers(7);
                                        } else {
                                          setSelectedPlayers(null);
                                        }
                                        // Reset arbitro if switching to Sabana (local == 1)
                                        if (cancha.local === 1) {
                                          setArbitro(false);
                                        }
                                      }
                                    }}
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  >
                                    {canchas.map((cancha) => (
                                      <option
                                        key={cancha.id}
                                        value={cancha.id}
                                        className="bg-white text-gray-900"
                                      >
                                        {cancha.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Day Selection */}
                                <div>
                                  <label className="block text-sm/6 font-medium text-gray-900 mb-2">
                                    Día de la semana
                                  </label>
                                  <select
                                    value={selectedDay}
                                    onChange={(e) =>
                                      setSelectedDay(Number(e.target.value))
                                    }
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
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
                                </div>

                                {/* Player Selection (Special Cancha) */}
                                {isSpecialCancha && (
                                  <div>
                                    <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-0.5">
                                      <TbRun className="text-primary" />
                                      <TbPlayFootball className="text-primary -ml-1" />
                                      Seleccione cantidad de jugadores
                                    </h3>
                                    <div className="flex gap-2">
                                      {[7, 8, 9].map((players) => (
                                        <button
                                          key={players}
                                          type="button"
                                          onClick={() =>
                                            setSelectedPlayers(players)
                                          }
                                          className={`flex-1 py-3 rounded-lg border transition-all font-bold ${
                                            selectedPlayers === players
                                              ? "bg-primary border-primary text-white"
                                              : "bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10"
                                          }`}
                                        >
                                          FUT {players}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Hour Selection */}
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900 flex gap-2 items-center mb-3">
                                    <FaRegClock className="text-primary" />
                                    Seleccione una hora
                                  </h3>
                                  <div className="grid grid-cols-4 gap-2">
                                    {availableHours.map((hour) => {
                                      const isSelected = selectedHour === hour;
                                      return (
                                        <button
                                          key={hour}
                                          type="button"
                                          onClick={() => setSelectedHour(hour)}
                                          className={`py-3 text-base tracking-tight rounded-lg border transition-all font-medium ${
                                            isSelected
                                              ? "bg-primary border-primary text-white"
                                              : "bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10"
                                          }`}
                                        >
                                          {formatHourAmPm(hour)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Arbitro Checkbox - Only for Guadalupe (local == 2) */}
                                {selectedCancha?.local === 2 && (
                                  <div>
                                    <div className="flex gap-3">
                                      <div className="flex h-6 shrink-0 items-center">
                                        <div className="group grid size-4 grid-cols-1">
                                          <input
                                            id="arbitro-create"
                                            name="arbitro-create"
                                            type="checkbox"
                                            checked={arbitro}
                                            onChange={(e) =>
                                              setArbitro(e.target.checked)
                                            }
                                            className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                          />
                                          <svg
                                            fill="none"
                                            viewBox="0 0 14 14"
                                            className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white"
                                          >
                                            <path
                                              d="M3 8L6 11L11 3.5"
                                              strokeWidth={2}
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              className="opacity-0 group-has-checked:opacity-100"
                                            />
                                          </svg>
                                        </div>
                                      </div>
                                      <div className="text-base">
                                        <label
                                          htmlFor="arbitro-create"
                                          className="font-medium text-gray-900 flex items-center gap-2"
                                        >
                                          <GiWhistle className="text-primary text-lg" />
                                          Contratar árbitro
                                        </label>
                                        <p className="text-gray-600 text-sm">
                                          + ₡5,000 al precio total
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Price Display */}
                                {selectedHour !== null && (
                                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-600 text-sm">
                                        Precio total
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {showPriceEdit ? (
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-900 font-medium">
                                              ₡
                                            </span>
                                            <input
                                              type="number"
                                              value={customPrice || getPrice()}
                                              onChange={(e) =>
                                                setCustomPrice(
                                                  parseInt(e.target.value) || 0
                                                )
                                              }
                                              className="w-32 px-3 py-1 border border-gray-300 rounded-lg text-gray-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                            />
                                            <button
                                              onClick={() => {
                                                setShowPriceEdit(false);
                                              }}
                                              className="text-primary hover:text-primary/80"
                                            >
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={2}
                                                stroke="currentColor"
                                                className="size-5"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  d="M4.5 12.75l6 6 9-13.5"
                                                />
                                              </svg>
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <span className="text-gray-900 font-bold text-lg">
                                              ₡ {getPrice().toLocaleString()}
                                            </span>
                                            <button
                                              onClick={() => setShowPriceEdit(true)}
                                              className="text-gray-400 hover:text-primary transition-colors"
                                            >
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={1.5}
                                                stroke="currentColor"
                                                className="size-4"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                                />
                                              </svg>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Step 2: Contact Info */}
                                {selectedCancha && (
                                  <>
                                    {/* Cancha Summary */}
                                    <div className="relative w-full h-32 rounded-xl overflow-hidden">
                                      <img
                                        src={selectedCancha.img}
                                        alt={selectedCancha.nombre}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                      <div className="absolute bottom-2 left-4">
                                        <h2 className="text-lg font-bold text-white">
                                          {selectedCancha.nombre}
                                        </h2>
                                      </div>
                                    </div>

                                    {/* Reservation Details */}
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                                      <div className="flex items-center justify-between">
                                        <span className="text-gray-600 text-sm">
                                          Día
                                        </span>
                                        <span className="text-gray-900 font-medium">
                                          {
                                            DAYS_OF_WEEK.find(
                                              (d) => d.value === selectedDay
                                            )?.label
                                          }
                                        </span>
                                      </div>
                                      <div className="border-t border-gray-200" />
                                      <div className="flex items-center justify-between">
                                        <span className="text-gray-600 text-sm">
                                          Hora
                                        </span>
                                        <span className="text-gray-900 font-medium">
                                          {selectedHour !== null
                                            ? `${formatHourAmPm(selectedHour)} - ${formatHourAmPm((selectedHour + 1) % 24)}`
                                            : ""}
                                        </span>
                                      </div>
                                      <div className="border-t border-gray-200" />
                                      <div className="flex items-center justify-between">
                                        <span className="text-gray-600 text-sm">
                                          Precio total
                                        </span>
                                        <span className="text-gray-900 font-bold text-lg">
                                          ₡ {getPrice().toLocaleString()}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Contact Form */}
                                    <div className="space-y-4">
                                      <h3 className="text-gray-900 font-medium">
                                        Datos de contacto
                                      </h3>

                                      {/* Nombre */}
                                      <div>
                                        <label
                                          htmlFor="nombre-create"
                                          className="block text-sm/6 font-medium text-gray-900"
                                        >
                                          Nombre completo *
                                        </label>
                                        <div className="mt-2">
                                          <input
                                            id="nombre-create"
                                            name="nombre-create"
                                            type="text"
                                            placeholder="Mi Nombre"
                                            value={nombre}
                                            onChange={(e) =>
                                              setNombre(e.target.value)
                                            }
                                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                                          />
                                        </div>
                                      </div>

                                      {/* Celular */}
                                      <div>
                                        <label
                                          htmlFor="celular-create"
                                          className="block text-sm/6 font-medium text-gray-900"
                                        >
                                          Celular (opcional)
                                        </label>
                                        <div className="mt-2">
                                          <input
                                            id="celular-create"
                                            name="celular-create"
                                            type="tel"
                                            placeholder="8888-8888"
                                            value={celular}
                                            onChange={(e) =>
                                              setCelular(e.target.value)
                                            }
                                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                                          />
                                        </div>
                                      </div>

                                      {/* Correo */}
                                      <div>
                                        <label
                                          htmlFor="correo-create"
                                          className="block text-sm/6 font-medium text-gray-900"
                                        >
                                          Correo electrónico (opcional)
                                        </label>
                                        <div className="mt-2">
                                          <input
                                            id="correo-create"
                                            name="correo-create"
                                            type="email"
                                            placeholder="micorreo@ejemplo.com"
                                            value={correo}
                                            onChange={(e) =>
                                              setCorreo(e.target.value)
                                            }
                                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Info about automatic reservas */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                      <p className="text-sm text-blue-900">
                                        <strong>Nota:</strong> Se crearán
                                        automáticamente reservaciones para las
                                        próximas 4 semanas.
                                      </p>
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  {!loading && (
                    <div className="flex shrink-0 justify-end gap-3 px-4 sm:px-6 py-4">
                      {step === 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleNextStep}
                            disabled={!canProceedToStep2}
                            className="inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-700 disabled:cursor-not-allowed"
                          >
                            Siguiente
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleBackStep}
                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                          >
                            Atrás
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmar}
                            disabled={!canSubmit}
                            className="inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-700 disabled:cursor-not-allowed"
                          >
                            {submitting ? "Creando..." : "Crear Reservación Fija"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                Confirmar creación de reservación fija
              </DialogTitle>

              {conflictDates.length > 0 ? (
                <>
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-yellow-900 mb-2">
                      ⚠️ Conflictos detectados
                    </p>
                    <p className="text-sm text-yellow-800 mb-3">
                      Ya existen reservaciones en las siguientes fechas. Estas
                      reservaciones NO se crearán:
                    </p>
                    <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1 mb-3">
                      {conflictDates.map((date, index) => (
                        <li key={index}>{formatConflictDate(date)}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Se crearán <strong>{availableDatesToCreate.length}</strong>{" "}
                    reservaciones para las fechas disponibles de las próximas 4
                    semanas.
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  Se crearán <strong>4 reservaciones</strong> automáticamente
                  para las próximas 4 semanas.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleProceedWithCreation}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                >
                  Confirmar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Success Notification */}
      {showSuccessNotification && (
        <div
          aria-live="assertive"
          className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-[110]"
        >
          <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
            <div className="pointer-events-auto w-full max-w-sm translate-y-0 transform rounded-lg bg-white opacity-100 shadow-lg outline-1 outline-black/5 transition duration-300 ease-out">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                      className="size-6 text-green-400"
                    >
                      <path
                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      Reservación fija creada exitosamente
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Se han generado las reservaciones para las próximas semanas.
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowSuccessNotification(false)}
                      className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-primary"
                    >
                      <span className="sr-only">Close</span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                        className="size-5"
                      >
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
