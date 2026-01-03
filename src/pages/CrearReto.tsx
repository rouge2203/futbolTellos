import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { IoArrowBack } from "react-icons/io5";
import { MdLocationOn } from "react-icons/md";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { FaRegCalendarCheck } from "react-icons/fa";
import { FaUsers } from "react-icons/fa6";
import { FaRegClock } from "react-icons/fa";
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

const DAYS_SPANISH = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_SPANISH = [
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
];

// Parse precio string "23.000" -> 23000
const parsePrecio = (precioStr: string | undefined): number => {
  if (!precioStr) return 0;
  return parseInt(precioStr.replace(/\./g, ""), 10) || 0;
};

// Format precio for display - handles ranges like "40.000-50.000"
const formatPrecio = (precioStr: string | undefined): string => {
  if (!precioStr) return "0";

  // Check if it's a range (contains "-")
  if (precioStr.includes("-")) {
    const parts = precioStr.split("-");
    const formattedParts = parts.map((part) => {
      const num = parseInt(part.replace(/\./g, ""), 10) || 0;
      return num.toLocaleString();
    });
    return formattedParts.join(" - ");
  }

  // Single price
  return parsePrecio(precioStr).toLocaleString();
};

function CrearReto() {
  const navigate = useNavigate();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedCancha, setSelectedCancha] = useState<Cancha | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedFut, setSelectedFut] = useState<number | null>(null);
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [arbitro, setArbitro] = useState(false);

  // Form states
  const [equipo1Nombre, setEquipo1Nombre] = useState("");
  const [equipo1Encargado, setEquipo1Encargado] = useState("");
  const [equipo1Celular, setEquipo1Celular] = useState("");
  const [equipo1Correo, setEquipo1Correo] = useState("");

  // Dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Canchas that share availability with cancha 6
  const LINKED_CANCHAS = [1, 3, 5];

  // Generate dates for today + 10 days
  const dates = Array.from({ length: 11 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [canchasResult, configResult] = await Promise.all([
          supabase.from("canchas").select("*").order("id"),
          supabase.from("configuracion").select("*").limit(1).single(),
        ]);

        if (canchasResult.error) throw canchasResult.error;
        if (configResult.error) throw configResult.error;

        // Sort canchas: Sabana first, then Guadalupe, then by id ascending
        const sortedCanchas = (canchasResult.data || []).sort((a, b) => {
          if (a.local !== b.local) {
            return a.local - b.local;
          }
          return a.id - b.id;
        });

        setCanchas(sortedCanchas);
        setConfiguracion(configResult.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Set default FUT when cancha is selected and scroll to top
  useEffect(() => {
    if (selectedCancha) {
      if (selectedCancha.cantidad === "7-8-9") {
        setSelectedFut(7);
      } else {
        const fut = parseInt(selectedCancha.cantidad, 10);
        setSelectedFut(fut);
      }
      // Scroll to top when cancha is selected
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedCancha]);

  // Format date as local timestamp string for queries
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Parse hour from timestamp string
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

        // Determine which canchas to check for reservations
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
          parseHourFromTimestamp(r.hora_inicio)
        );

        setReservedHours(hours);
      } catch (err) {
        console.error("Error fetching reservas:", err);
      } finally {
        setLoadingReservas(false);
      }
    };

    fetchReservas();
  }, [selectedDate, selectedCancha]);

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `unknown (${local})`;
  };

  // Parse time string "HH:MM:SS" to hour number
  const parseTimeToHour = (timeStr: string): number => {
    return parseInt(timeStr.split(":")[0], 10);
  };

  // Get current hour in Costa Rica timezone
  const getCurrentHourCR = (): number => {
    const now = new Date();
    const crTime = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
    );
    return crTime.getHours();
  };

  // Check if selected date is today in Costa Rica
  const isToday = (): boolean => {
    const today = new Date();
    const crToday = new Date(
      today.toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
    );
    const crSelected = new Date(
      selectedDate.toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
    );

    return (
      crToday.getFullYear() === crSelected.getFullYear() &&
      crToday.getMonth() === crSelected.getMonth() &&
      crToday.getDate() === crSelected.getDate()
    );
  };

  // Get available hours based on location
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

  // Check if this is a special cancha with variable players
  const isSpecialCancha = selectedCancha?.cantidad === "7-8-9";

  // Calculate price per team
  const getPricePerTeam = (): number => {
    if (!selectedCancha) return 0;

    let basePrice: number;

    // Special handling for cancha.id == 6 (7-8-9)
    if (selectedCancha.cantidad === "7-8-9" && selectedFut) {
      if (selectedFut === 7) {
        basePrice = 40000;
      } else if (selectedFut === 8) {
        basePrice = 45000;
      } else if (selectedFut === 9) {
        basePrice = 50000;
      } else {
        basePrice = 40000; // default
      }
    } else {
      // For other canchas, use precio from database
      basePrice = parsePrecio(selectedCancha.precio);
    }

    // Price per team is 50% of total
    const pricePerTeam = basePrice / 2;
    // Arbitro cost only for Guadalupe (local == 2)
    const arbitroCost = selectedCancha?.local === 2 && arbitro ? 2500 : 0;
    return pricePerTeam + arbitroCost;
  };

  // Format selected date and time
  const getFormattedDateTime = (): string => {
    if (!selectedHour) return "Selecciona fecha y hora";
    const day = selectedDate.getDate();
    const month = MONTHS_SPANISH[selectedDate.getMonth()];
    return `${day} ${month} - ${selectedHour}:00`;
  };

  // Validation helpers
  const isValidCelular = (cel: string): boolean => {
    const digitsOnly = cel.replace(/\D/g, "");
    return digitsOnly.length >= 8;
  };

  // Check if form is valid
  const isFormValid =
    selectedCancha &&
    selectedHour !== null &&
    selectedFut !== null &&
    equipo1Encargado.trim() &&
    isValidCelular(equipo1Celular);

  // Format date for display
  const formatDateDisplay = (): string => {
    if (!selectedHour) return "";
    const day = selectedDate.getDate();
    const dayName = DAYS_SPANISH[selectedDate.getDay()];
    const month = MONTHS_SPANISH[selectedDate.getMonth()];
    return `${dayName} ${day} de ${month}`;
  };

  const handleConfirmar = () => {
    if (
      !isFormValid ||
      !selectedCancha ||
      selectedHour === null ||
      selectedFut === null
    ) {
      return;
    }

    // Show confirmation dialog
    setConfirmDialogOpen(true);
  };

  const handleCreateReto = async () => {
    if (!selectedCancha || selectedHour === null || selectedFut === null) {
      return;
    }

    setSubmitting(true);
    setConfirmDialogOpen(false);

    try {
      // Build hora_inicio timestamp
      const horaInicio = new Date(selectedDate);
      horaInicio.setHours(selectedHour, 0, 0, 0);

      // Build hora_fin (1 hour later)
      const horaFin = new Date(horaInicio);
      horaFin.setHours(horaFin.getHours() + 1);

      // Format as local timestamp string
      const formatLocalTimestamp = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      // Determine local string
      const localStr = selectedCancha.local === 1 ? "Sabana" : "Guadalupe";

      // Insert into retos table (don't include reserva_id when it's null)
      const insertData: any = {
        hora_inicio: formatLocalTimestamp(horaInicio),
        hora_fin: formatLocalTimestamp(horaFin),
        local: localStr,
        fut: selectedFut,
        arbitro: selectedCancha?.local === 2 ? arbitro : false,
        equipo1_nombre: equipo1Nombre.trim() || null,
        equipo1_encargado: equipo1Encargado.trim(),
        equipo1_celular: equipo1Celular.trim(),
        equipo1_correo: equipo1Correo.trim() || null,
        equipo2_nombre: null,
        equipo2_encargado: null,
        equipo2_celular: null,
        cancha_id: selectedCancha.id,
        // reserva_id is omitted when null - will use column default
      };

      const { error: insertError } = await supabase
        .from("retos")
        .insert(insertData);

      if (insertError) throw insertError;

      // Show success dialog
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error creating reto:", error);
      alert("Error al crear el reto. Por favor intente de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDialogClose = () => {
    setSuccessDialogOpen(false);
    navigate("/retos");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-white text-lg">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-red-400 text-lg text-center">{error}</div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const availableHours = getAvailableHours();

  return (
    <div className="min-h-screen border-white bg-bg pb-32 px-0 py-0 sm:px-6 lg:px-8">
      {/* Header with back button */}
      <div className="top-0 z-10 bg-bg/95 backdrop-blur-sm px-2 pb-2 flex items-center gap-3 border-gray-800">
        <button
          onClick={() => navigate("/retos")}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <IoArrowBack className="text-xl text-white" />
        </button>
        <h1 className="text-lg tracking-tight font-medium text-white truncate">
          Crear Reto
        </h1>
      </div>

      {/* Cancha Selection */}
      {!selectedCancha ? (
        <div className="px-4 py-6">
          <h3 className="text-white font-medium mb-3">Seleccione una cancha</h3>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            {canchas.map((cancha) => (
              <div
                key={cancha.id}
                onClick={() => {
                  setSelectedCancha(cancha);
                  // Reset arbitro if switching to Sabana (local == 1)
                  if (cancha.local === 1) {
                    setArbitro(false);
                  }
                }}
                className="bg-gray-700/10 border-2 border-double border-primary shadow-primary rounded-2xl overflow-hidden shadow-md cursor-pointer hover:opacity-90 transition-opacity"
              >
                {/* Image */}
                {cancha.img && (
                  <div className="relative w-full h-56 px-3 py-4 group">
                    <img
                      src={cancha.img}
                      alt={cancha.nombre}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="px-4 -mt-3 space-y-0.25">
                  {/* Name */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-medium tracking-tight text-white">
                      {cancha.nombre}
                    </h2>
                    {/* Location */}
                    <div className="flex gap-0.5 items-center">
                      <MdLocationOn className="text-xs text-secondary" />
                      <h2 className="text-sm text-white underline underline-offset-2">
                        {getLocalName(cancha.local)}
                      </h2>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center pb-6 justify-between">
                    {/* Fut */}
                    <div className="flex items-center gap-1 text-white/80">
                      <div className="flex items-center">
                        <TbRun className="text-sm text-secondary" />
                        <TbPlayFootball className="text-sm text-secondary -ml-0.5" />
                      </div>
                      <span className="text-sm font-bold">
                        FUT {cancha.cantidad}
                      </span>
                    </div>
                    {/* Price */}
                    {cancha.precio && (
                      <div className="flex items-center gap-2 text-white/80 -mt-1">
                        <span className="text-sm font-bold">
                          ₡ {formatPrecio(cancha.precio)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Cancha Image */}
          <div className="relative w-full h-64 px-4 py-4">
            <img
              src={selectedCancha.img}
              alt={selectedCancha.nombre}
              className="w-full h-full object-cover rounded-2xl"
            />
            <div className="absolute top-6 left-6 px-3 py-1.5 bg-bg/90 backdrop-blur-sm rounded-full flex items-center gap-2">
              <FaUsers className="text-white" />
              <span className="text-white text-sm font-medium">
                {isSpecialCancha
                  ? `${selectedFut || 7} jugadores`
                  : `${
                      parseInt(selectedCancha.cantidad.toString(), 10) * 2
                    } jugadores`}
              </span>
            </div>
            <div className="absolute top-6 right-6 px-3 py-1.5 bg-bg/90 backdrop-blur-sm rounded-full flex items-center gap-1">
              <MdLocationOn className="text-secondary text-sm" />
              <span className="text-white text-sm">
                {getLocalName(selectedCancha.local)}
              </span>
            </div>
          </div>

          {/* Special cancha FUT selector */}
          {isSpecialCancha && (
            <div className="px-4 mb-6">
              <h3 className="text-white font-medium mb-3 flex items-center gap-0.5">
                <TbRun className="text-secondary" />
                <TbPlayFootball className="text-secondary -ml-1" />
                Seleccione cantidad de jugadores
              </h3>
              <div className="flex gap-2">
                {[7, 8, 9].map((fut) => (
                  <button
                    key={fut}
                    onClick={() => setSelectedFut(fut)}
                    className={`flex-1 py-3 rounded-lg border transition-all font-bold ${
                      selectedFut === fut
                        ? "bg-primary border-primary text-white"
                        : "bg-transparent border-primary border-dashed text-white"
                    }`}
                  >
                    FUT {fut}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date selector */}
          <div className="px-4 mb-6">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <FaRegCalendarCheck className="text-secondary" />
              Seleccione una fecha
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {dates.map((date, index) => {
                const isSelected =
                  date.toDateString() === selectedDate.toDateString();
                const isToday = index === 0;
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedHour(null);
                    }}
                    className={`shrink-0 w-16 py-3 rounded-xl border transition-all flex flex-col items-center ${
                      isSelected
                        ? "bg-primary border-primary text-white"
                        : "bg-transparent border-primary border-dashed text-white hover:bg-primary/20"
                    }`}
                  >
                    <span className="text-4xl tracking-tighter font-semibold">
                      {date.getDate()}
                    </span>
                    <span className="text-xs tracking-tight uppercase mt-1.5">
                      {isToday ? "Hoy" : DAYS_SPANISH[date.getDay()]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour selector */}
          <div className="px-4 mb-6">
            <h3 className="text-white font-medium mb-3 flex gap-2 items-center">
              <FaRegClock className="text-secondary" />
              Seleccione una hora
              {loadingReservas && (
                <span className="text-white/50 text-sm ml-2">
                  (cargando...)
                </span>
              )}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {availableHours.map((hour) => {
                const isReserved = reservedHours.includes(hour);
                const isSelected = selectedHour === hour;
                return (
                  <button
                    key={hour}
                    onClick={() => !isReserved && setSelectedHour(hour)}
                    disabled={isReserved}
                    className={`py-3 text-base tracking-tight rounded-lg border transition-all font-medium ${
                      isReserved
                        ? "bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed line-through"
                        : isSelected
                        ? "bg-primary border-primary text-white"
                        : "bg-transparent border-primary border-dashed text-white hover:bg-primary/20"
                    }`}
                  >
                    {hour}:00
                  </button>
                );
              })}
            </div>
            {availableHours.every((h) => reservedHours.includes(h)) && (
              <p className="text-white/60 text-sm text-center mt-4">
                No hay horarios disponibles para esta fecha
              </p>
            )}
          </div>

          {/* Arbitro checkbox - Only for Guadalupe (local == 2) */}
          {selectedCancha?.local === 2 && (
            <div className="px-4 mb-6">
              <div className="flex gap-3">
                <div className="flex h-6 shrink-0 items-center">
                  <div className="group grid size-4 grid-cols-1">
                    <input
                      id="arbitro"
                      name="arbitro"
                      type="checkbox"
                      checked={arbitro}
                      onChange={(e) => setArbitro(e.target.checked)}
                      className="col-start-1 row-start-1 appearance-none rounded-sm border border-white/10 bg-white/5 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10 forced-colors:appearance-auto"
                    />
                    <svg
                      fill="none"
                      viewBox="0 0 14 14"
                      className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25"
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
                    htmlFor="arbitro"
                    className="font-medium text-white flex items-center gap-2"
                  >
                    <GiWhistle className="text-secondary text-lg" />
                    Contratar árbitro
                  </label>
                  <p className="text-gray-400 text-sm">+ ₡2,500 por equipo</p>
                </div>
              </div>
            </div>
          )}

          {/* Price Display */}
          <div className="px-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">Precio por equipo</span>
                <span className="text-white font-bold text-xl">
                  ₡ {getPricePerTeam().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Form: Mi Equipo */}
          <div className="px-4 mb-6">
            <h3 className="text-white font-medium mb-3">Mi Equipo</h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="equipo1-nombre"
                  className="block text-sm/6 font-medium text-white/80"
                >
                  Nombre de mi equipo
                </label>
                <div className="mt-2">
                  <input
                    id="equipo1-nombre"
                    name="equipo1-nombre"
                    type="text"
                    placeholder="Nombre del equipo"
                    value={equipo1Nombre}
                    onChange={(e) => setEquipo1Nombre(e.target.value)}
                    className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="equipo1-encargado"
                  className="block text-sm/6 font-medium text-white"
                >
                  Nombre de encargado *
                </label>
                <div className="mt-2">
                  <input
                    id="equipo1-encargado"
                    name="equipo1-encargado"
                    type="text"
                    placeholder="Nombre del encargado"
                    value={equipo1Encargado}
                    onChange={(e) => setEquipo1Encargado(e.target.value)}
                    required
                    className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="equipo1-celular"
                  className="block text-sm/6 font-medium text-white"
                >
                  Celular (te contactaremos si conseguimos un reto) *
                </label>
                <div className="mt-2">
                  <input
                    id="equipo1-celular"
                    name="equipo1-celular"
                    type="tel"
                    placeholder="8888-8888"
                    value={equipo1Celular}
                    onChange={(e) => setEquipo1Celular(e.target.value)}
                    required
                    className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="equipo1-correo"
                  className="block text-sm/6 font-medium text-white/80"
                >
                  Correo electrónico *
                </label>
                <div className="mt-2">
                  <input
                    id="equipo1-correo"
                    name="equipo1-correo"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={equipo1Correo}
                    onChange={(e) => setEquipo1Correo(e.target.value)}
                    className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fixed bottom bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur-sm border-t border-gray-800 px-4 py-4 z-20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white/60 text-xs">Precio por equipo</p>
                <p className="text-white text-xl font-bold">
                  ₡ {getPricePerTeam().toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-white/80 text-base">
                📅 {getFormattedDateTime()}
              </div>
              <button
                onClick={handleConfirmar}
                disabled={!isFormValid || submitting}
                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  isFormValid && !submitting
                    ? "bg-primary text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                <FaRegCalendarCheck className="text-lg" />
                {submitting ? "Creando..." : "Confirmar Reto"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />

        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform w-full overflow-hidden rounded-lg bg-bg px-4 pt-5 pb-4 text-left shadow-xl outline -outline-offset-1 outline-white/10 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
            >
              <DialogTitle
                as="h3"
                className="text-base font-semibold text-white mb-4"
              >
                Confirmar Reto
              </DialogTitle>

              {selectedCancha && selectedHour !== null && (
                <div className="space-y-4">
                  {/* Details */}
                  <div className="bg-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MdLocationOn className="text-secondary" />
                        <span className="text-white/80 text-sm">Local</span>
                      </div>
                      <span className="text-white font-medium">
                        {getLocalName(selectedCancha.local)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FaRegClock className="text-secondary text-sm" />
                        <span className="text-white/80 text-sm">
                          Fecha y Hora
                        </span>
                      </div>
                      <span className="text-white font-medium text-right">
                        {formatDateDisplay()} - {selectedHour}:00
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <TbRun className="text-secondary text-sm" />
                          <TbPlayFootball className="text-secondary text-sm -ml-0.5" />
                        </div>
                        <span className="text-white/80 text-sm">FUT</span>
                      </div>
                      <span className="text-white font-medium">
                        {selectedFut}
                      </span>
                    </div>
                    {selectedCancha?.local === 2 && arbitro && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GiWhistle className="text-secondary text-sm" />
                          <span className="text-white/80 text-sm">Árbitro</span>
                        </div>
                        <span className="text-white font-medium">Incluido</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-white/80 text-sm">Cancha</span>
                      <span className="text-white font-medium">
                        {selectedCancha.nombre}
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80 text-sm">
                          Precio por equipo
                        </span>
                        <span className="text-white font-bold text-lg">
                          ₡ {getPricePerTeam().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/80 text-sm mb-2">Equipo:</p>
                    <p className="text-white font-medium">
                      {equipo1Nombre.trim() || "Sin nombre"}
                    </p>
                    <p className="text-white/80 text-sm mt-1">
                      Encargado: {equipo1Encargado}
                    </p>
                    <p className="text-white/80 text-sm">
                      Celular: {equipo1Celular}
                    </p>
                    {equipo1Correo.trim() && (
                      <p className="text-white/80 text-sm">
                        Correo: {equipo1Correo}
                      </p>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-4">
                    <p className="text-white/90 text-sm text-center">
                      <strong className="text-primary">Importante:</strong>{" "}
                      Futbol Tello intentará conseguirte un reto. Una vez
                      encontrado un oponente, te contactaremos vía WhatsApp al
                      número proporcionado.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5 sm:mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDialogOpen(false)}
                  className="inline-flex flex-1 justify-center rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateReto}
                  disabled={submitting}
                  className="inline-flex flex-1 justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creando..." : "Confirmar Reto"}
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Success Dialog */}
      <Dialog
        open={successDialogOpen}
        onClose={() => {}}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />

        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform w-full overflow-hidden rounded-lg bg-bg px-4 pt-5 pb-4 text-left shadow-xl outline -outline-offset-1 outline-white/10 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
            >
              <div>
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-500/10">
                  <CheckIcon
                    aria-hidden="true"
                    className="size-6 text-secondary"
                  />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-white"
                  >
                    ¡Reto Creado!
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-gray-400">
                      Futbol tello intentará conseguirte un reto y una vez
                      completado te contactaremos vía WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  onClick={handleSuccessDialogClose}
                  className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Entendido
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default CrearReto;
