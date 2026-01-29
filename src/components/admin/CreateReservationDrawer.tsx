import { useState, useEffect } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabase";
import { FaRegCalendarCheck, FaRegClock } from "react-icons/fa";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { GiWhistle } from "react-icons/gi";

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

interface CreateReservationDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultCanchaId?: number;
  defaultDate?: Date;
  onSuccess: (reservaId: number) => void;
}

const DAYS_SPANISH_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
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
const ARBITRO_COST = 5000;
const LINKED_CANCHAS = [1, 3, 5];

const formatHourAmPm = (hour: number): string => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
};

export default function CreateReservationDrawer({
  open,
  onClose,
  defaultCanchaId = 1,
  defaultDate,
  onSuccess,
}: CreateReservationDrawerProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [selectedCancha, setSelectedCancha] = useState<Cancha | null>(null);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    defaultDate || new Date(),
  );
  const [displayedMonth, setDisplayedMonth] = useState<Date>(
    defaultDate || new Date(),
  );
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<number | null>(null);
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [arbitro, setArbitro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 2 states
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");

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
        const defaultCancha = sortedCanchas.find(
          (c) => c.id === defaultCanchaId,
        );
        if (defaultCancha) {
          setSelectedCancha(defaultCancha);
          if (defaultCancha.cantidad === "7-8-9") {
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
  }, [open, defaultCanchaId]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedDate(defaultDate || new Date());
      setDisplayedMonth(defaultDate || new Date());
      setSelectedHour(null);
      setSelectedPlayers(null);
      setArbitro(false);
      setNombre("");
      setCelular("");
      setCorreo("");
    }
  }, [open, defaultDate]);

  // Update selected date when defaultDate prop changes and drawer is open
  useEffect(() => {
    if (open && defaultDate) {
      setSelectedDate(defaultDate);
      setDisplayedMonth(defaultDate);
    }
  }, [open, defaultDate]);

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

  // Fetch reservations when date or cancha changes
  useEffect(() => {
    const fetchReservas = async () => {
      if (!selectedCancha) return;

      setLoadingReservas(true);
      try {
        const dateStr = formatLocalDate(selectedDate);
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

        const { data: reservasData, error: reservasError } = await supabase
          .from("reservas")
          .select("hora_inicio")
          .in("cancha_id", canchaIds)
          .gte("hora_inicio", startOfDay)
          .lte("hora_inicio", endOfDay);

        if (reservasError) throw reservasError;

        const hours = (reservasData || []).map((r) =>
          parseHourFromTimestamp(r.hora_inicio),
        );

        setReservedHours(hours);
      } catch (err) {
        console.error("Error fetching reservas:", err);
      } finally {
        setLoadingReservas(false);
      }
    };

    if (selectedCancha) {
      fetchReservas();
    }
  }, [selectedDate, selectedCancha]);

  const parseTimeToHour = (timeStr: string): number => {
    return parseInt(timeStr.split(":")[0], 10);
  };

  const getCurrentHourCR = (): number => {
    const now = new Date();
    const crTime = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Costa_Rica" }),
    );
    return crTime.getHours();
  };

  const isToday = (): boolean => {
    const today = new Date();
    const crToday = new Date(
      today.toLocaleString("en-US", { timeZone: "America/Costa_Rica" }),
    );
    const crSelected = new Date(
      selectedDate.toLocaleString("en-US", { timeZone: "America/Costa_Rica" }),
    );

    return (
      crToday.getFullYear() === crSelected.getFullYear() &&
      crToday.getMonth() === crSelected.getMonth() &&
      crToday.getDate() === crSelected.getDate()
    );
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
    const hourMapping: { displayHour: number; isNextDay: boolean }[] = [];

    for (let h = apertura; h < cierre; h++) {
      const displayHour = h < 24 ? h : h - 24;
      const isNextDay = h >= 24;
      hours.push(displayHour);
      hourMapping.push({ displayHour, isNextDay });
    }

    if (isToday()) {
      const currentHour = getCurrentHourCR();
      return hours.filter((hour, index) => {
        const mapping = hourMapping[index];
        if (mapping.isNextDay) return true;
        return hour > currentHour;
      });
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
    const arbitroCost =
      selectedCancha?.local === 2 && arbitro ? ARBITRO_COST : 0;
    return getBasePrice() + arbitroCost;
  };

  const getPlayerCount = (): number => {
    if (!selectedCancha) return 0;
    if (isSpecialCancha && selectedPlayers) {
      return selectedPlayers;
    }
    return parseInt(selectedCancha.cantidad?.toString() || "0", 10);
  };

  const handleNextStep = () => {
    if (!selectedCancha || !selectedHour) return;
    setStep(2);
  };

  const handleBackStep = () => {
    setStep(1);
  };

  const handleConfirmar = async () => {
    if (submitting || !selectedCancha || !selectedHour || !nombre.trim())
      return;

    setSubmitting(true);

    try {
      const horaInicio = new Date(selectedDate);
      horaInicio.setHours(selectedHour, 0, 0, 0);

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

      const { data, error } = await supabase
        .from("reservas")
        .insert({
          hora_inicio: formatLocalTimestamp(horaInicio),
          hora_fin: formatLocalTimestamp(horaFin),
          nombre_reserva: nombre,
          celular_reserva: celular || null,
          correo_reserva: correo || null,
          cancha_id: selectedCancha.id,
          precio: getPrice(),
          arbitro: arbitro,
        })
        .select()
        .single();

      if (error) throw error;

      // Send email if correo is provided
      if (correo && correo.trim()) {
        try {
          const djangoApiUrl = import.meta.env.VITE_DJANGO_API_URL || "";
          if (djangoApiUrl) {
            const reservaUrl = `${window.location.origin}/reserva/${data.id}`;
            const horaInicioStr = formatLocalTimestamp(horaInicio);
            const horaFinStr = formatLocalTimestamp(horaFin);

            const emailPayload = {
              reserva_id: data.id,
              hora_inicio: horaInicioStr,
              hora_fin: horaFinStr,
              cancha_id: selectedCancha.id,
              cancha_nombre: selectedCancha.nombre,
              cancha_local: selectedCancha.local,
              nombre_reserva: nombre,
              celular_reserva: celular || "",
              correo_reserva: correo,
              precio: getPrice(),
              arbitro: arbitro,
              jugadores: getPlayerCount() * 2,
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
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          // Don't fail the reservation creation if email fails
        }
      }

      // Success - refresh and close, return reservation ID
      onSuccess(data.id);
      onClose();
    } catch (error) {
      console.error("Error creating reservation:", error);
      alert("Error al crear la reservación. Por favor intente de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const availableHours = getAvailableHours();
  const canProceedToStep2 =
    selectedCancha && selectedHour !== null && !loadingReservas;
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
          <p className="mt-2 text-white/70 text-sm">Creando reservación...</p>
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
                            ? "Crear Reservación"
                            : "Confirmar Reservación"}
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
                                        (c) => c.id === Number(e.target.value),
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

                                {/* Date Selection - Calendar */}
                                {selectedCancha && (
                                  <>
                                    <div>
                                      <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
                                        <FaRegCalendarCheck className="text-primary" />
                                        Seleccione una fecha
                                      </h3>
                                      <div className="text-center">
                                        {/* Month navigation */}
                                        <div className="flex items-center text-gray-900">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newMonth = new Date(
                                                displayedMonth,
                                              );
                                              newMonth.setMonth(
                                                newMonth.getMonth() - 1,
                                              );
                                              // Don't go before current month
                                              const today = new Date();
                                              if (
                                                newMonth.getFullYear() >
                                                  today.getFullYear() ||
                                                (newMonth.getFullYear() ===
                                                  today.getFullYear() &&
                                                  newMonth.getMonth() >=
                                                    today.getMonth())
                                              ) {
                                                setDisplayedMonth(newMonth);
                                              }
                                            }}
                                            className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                                          >
                                            <span className="sr-only">
                                              Mes anterior
                                            </span>
                                            <ChevronLeftIcon className="size-5" />
                                          </button>
                                          <div className="flex-auto text-sm font-semibold">
                                            {
                                              MONTHS_SPANISH[
                                                displayedMonth.getMonth()
                                              ]
                                            }{" "}
                                            {displayedMonth.getFullYear()}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newMonth = new Date(
                                                displayedMonth,
                                              );
                                              newMonth.setMonth(
                                                newMonth.getMonth() + 1,
                                              );
                                              setDisplayedMonth(newMonth);
                                            }}
                                            className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                                          >
                                            <span className="sr-only">
                                              Mes siguiente
                                            </span>
                                            <ChevronRightIcon className="size-5" />
                                          </button>
                                        </div>

                                        {/* Day headers */}
                                        <div className="mt-4 grid grid-cols-7 text-xs/6 text-gray-500">
                                          {DAYS_SPANISH_SHORT.map((day, i) => (
                                            <div key={i}>{day}</div>
                                          ))}
                                        </div>

                                        {/* Calendar grid */}
                                        <div className="isolate mt-2 grid grid-cols-7 gap-px rounded-lg bg-gray-200 text-sm shadow-sm ring-1 ring-gray-200">
                                          {(() => {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);

                                            const year =
                                              displayedMonth.getFullYear();
                                            const month =
                                              displayedMonth.getMonth();

                                            // First day of the month
                                            const firstDay = new Date(
                                              year,
                                              month,
                                              1,
                                            );
                                            // Last day of the month
                                            const lastDay = new Date(
                                              year,
                                              month + 1,
                                              0,
                                            );

                                            // Start from Monday (1) - adjust if first day is Sunday (0)
                                            let startDay = firstDay.getDay();
                                            // Convert Sunday=0 to 7 for Monday-first calendar
                                            startDay =
                                              startDay === 0 ? 7 : startDay;
                                            // Days to show from previous month
                                            const daysFromPrevMonth =
                                              startDay - 1;

                                            // End on Sunday - adjust if last day is not Sunday
                                            let endDay = lastDay.getDay();
                                            endDay = endDay === 0 ? 7 : endDay;
                                            const daysFromNextMonth =
                                              7 - endDay;

                                            const calendarDays: {
                                              date: Date;
                                              isCurrentMonth: boolean;
                                            }[] = [];

                                            // Previous month days
                                            for (
                                              let i = daysFromPrevMonth;
                                              i > 0;
                                              i--
                                            ) {
                                              const date = new Date(
                                                year,
                                                month,
                                                1 - i,
                                              );
                                              calendarDays.push({
                                                date,
                                                isCurrentMonth: false,
                                              });
                                            }

                                            // Current month days
                                            for (
                                              let i = 1;
                                              i <= lastDay.getDate();
                                              i++
                                            ) {
                                              const date = new Date(
                                                year,
                                                month,
                                                i,
                                              );
                                              calendarDays.push({
                                                date,
                                                isCurrentMonth: true,
                                              });
                                            }

                                            // Next month days
                                            for (
                                              let i = 1;
                                              i <= daysFromNextMonth;
                                              i++
                                            ) {
                                              const date = new Date(
                                                year,
                                                month + 1,
                                                i,
                                              );
                                              calendarDays.push({
                                                date,
                                                isCurrentMonth: false,
                                              });
                                            }

                                            return calendarDays.map(
                                              (
                                                { date, isCurrentMonth },
                                                index,
                                              ) => {
                                                const dateOnly = new Date(date);
                                                dateOnly.setHours(0, 0, 0, 0);

                                                const isToday =
                                                  dateOnly.getTime() ===
                                                  today.getTime();
                                                const isSelected =
                                                  dateOnly.getTime() ===
                                                  new Date(
                                                    selectedDate.setHours(
                                                      0,
                                                      0,
                                                      0,
                                                      0,
                                                    ),
                                                  ).getTime();
                                                const isPast = dateOnly < today;
                                                const isDisabled =
                                                  isPast || !isCurrentMonth;

                                                // Corner rounding classes
                                                const isFirstCell = index === 0;
                                                const isLastCell =
                                                  index ===
                                                  calendarDays.length - 1;
                                                const isTopRight = index === 6;
                                                const isBottomLeft =
                                                  index ===
                                                  calendarDays.length - 7;

                                                return (
                                                  <button
                                                    key={date.toISOString()}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    onClick={() => {
                                                      if (!isDisabled) {
                                                        setSelectedDate(date);
                                                        setSelectedHour(null);
                                                      }
                                                    }}
                                                    className={`py-1.5 focus:z-10 ${
                                                      isCurrentMonth
                                                        ? "bg-white hover:bg-gray-100"
                                                        : "bg-gray-50"
                                                    } ${
                                                      !isSelected &&
                                                      !isCurrentMonth &&
                                                      !isToday
                                                        ? "text-gray-400"
                                                        : ""
                                                    } ${
                                                      !isSelected &&
                                                      isCurrentMonth &&
                                                      !isToday
                                                        ? "text-gray-900"
                                                        : ""
                                                    } ${
                                                      isSelected
                                                        ? "font-semibold text-white"
                                                        : ""
                                                    } ${
                                                      isToday && !isSelected
                                                        ? "font-semibold text-primary"
                                                        : ""
                                                    } ${
                                                      isFirstCell
                                                        ? "rounded-tl-lg"
                                                        : ""
                                                    } ${
                                                      isTopRight
                                                        ? "rounded-tr-lg"
                                                        : ""
                                                    } ${
                                                      isBottomLeft
                                                        ? "rounded-bl-lg"
                                                        : ""
                                                    } ${
                                                      isLastCell
                                                        ? "rounded-br-lg"
                                                        : ""
                                                    } ${
                                                      isDisabled
                                                        ? "cursor-not-allowed opacity-50"
                                                        : ""
                                                    }`}
                                                  >
                                                    <time
                                                      dateTime={
                                                        date
                                                          .toISOString()
                                                          .split("T")[0]
                                                      }
                                                      className={`mx-auto flex size-7 items-center justify-center rounded-full ${
                                                        isSelected && !isToday
                                                          ? "bg-gray-900"
                                                          : ""
                                                      } ${
                                                        isSelected && isToday
                                                          ? "bg-primary"
                                                          : ""
                                                      }`}
                                                    >
                                                      {date.getDate()}
                                                    </time>
                                                  </button>
                                                );
                                              },
                                            );
                                          })()}
                                        </div>
                                      </div>
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
                                        {loadingReservas && (
                                          <span className="text-gray-500 text-xs ml-2">
                                            (cargando...)
                                          </span>
                                        )}
                                      </h3>
                                      <div className="grid grid-cols-4 gap-2">
                                        {availableHours.map((hour) => {
                                          const isReserved =
                                            reservedHours.includes(hour);
                                          const isSelected =
                                            selectedHour === hour;
                                          return (
                                            <button
                                              key={hour}
                                              type="button"
                                              onClick={() =>
                                                !isReserved &&
                                                setSelectedHour(hour)
                                              }
                                              disabled={isReserved}
                                              className={`py-3 text-base tracking-tight rounded-lg border transition-all font-medium ${
                                                isReserved
                                                  ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed line-through"
                                                  : isSelected
                                                    ? "bg-primary border-primary text-white"
                                                    : "bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10"
                                              }`}
                                            >
                                              {formatHourAmPm(hour)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {availableHours.every((h) =>
                                        reservedHours.includes(h),
                                      ) && (
                                        <p className="text-gray-500 text-sm text-center mt-4">
                                          No hay horarios disponibles para esta
                                          fecha
                                        </p>
                                      )}
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
                                    {selectedHour && (
                                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-600 text-sm">
                                            Precio total
                                          </span>
                                          <span className="text-gray-900 font-bold text-lg">
                                            ₡ {getPrice().toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </>
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
                                        <div className="flex items-center gap-2">
                                          <FaRegCalendarCheck className="text-primary" />
                                          <span className="text-gray-600 text-sm">
                                            Fecha y hora
                                          </span>
                                        </div>
                                        <span className="text-gray-900 font-medium">
                                          {selectedDate.getDate()} de{" "}
                                          {
                                            [
                                              "Ene",
                                              "Feb",
                                              "Mar",
                                              "Abr",
                                              "May",
                                              "Jun",
                                              "Jul",
                                              "Ago",
                                              "Sep",
                                              "Oct",
                                              "Nov",
                                              "Dic",
                                            ][selectedDate.getMonth()]
                                          }{" "}
                                          -{" "}
                                          {selectedHour !== null
                                            ? formatHourAmPm(selectedHour)
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

                                      {/* Celular (Optional) */}
                                      <div>
                                        <label
                                          htmlFor="celular-create"
                                          className="block text-sm/6 font-medium text-gray-900"
                                        >
                                          Celular
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

                                      {/* Correo (Optional) */}
                                      <div>
                                        <label
                                          htmlFor="correo-create"
                                          className="block text-sm/6 font-medium text-gray-900"
                                        >
                                          Correo electrónico
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
                            {submitting ? "Creando..." : "Crear Reservación"}
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
    </>
  );
}
