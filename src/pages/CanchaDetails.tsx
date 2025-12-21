import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { MdLocationOn } from "react-icons/md";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { FaRegCalendarCheck } from "react-icons/fa";
import { IoArrowBack } from "react-icons/io5";
import { FaUsers } from "react-icons/fa6";
import { FaRegClock } from "react-icons/fa";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio?: string; // varchar like "23.000" (period as thousands separator)
}

interface Configuracion {
  apertura_guada: string; // "07:00:00"
  apertura_sabana: string;
  cierre_sabana: string;
  cierre_guada: string; // "23:00:00"
}

const DAYS_SPANISH = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function CanchaDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<number | null>(null);
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);

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
        // Fetch cancha
        const { data: canchaData, error: canchaError } = await supabase
          .from("canchas")
          .select("*")
          .eq("id", id)
          .single();

        if (canchaError) throw canchaError;
        setCancha(canchaData);

        // Set default player count for special cancha
        if (canchaData.cantidad === "7-8-9") {
          setSelectedPlayers(7);
        }

        // Fetch configuracion
        const { data: configData, error: configError } = await supabase
          .from("configuracion")
          .select("*")
          .limit(1)
          .single();

        if (configError) throw configError;
        setConfiguracion(configData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch cancha details"
        );
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  // Fetch reservations when date or cancha changes
  useEffect(() => {
    const fetchReservas = async () => {
      if (!cancha) return;

      setLoadingReservas(true);
      try {
        // Build date range for the selected date
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        // For canchas 1, 3, 5 - also check cancha 6
        const canchaIds = LINKED_CANCHAS.includes(cancha.id)
          ? [cancha.id, 6]
          : [cancha.id];

        const { data: reservasData, error: reservasError } = await supabase
          .from("reservas")
          .select("hora_inicio")
          .in("cancha_id", canchaIds)
          .gte("hora_inicio", startOfDay.toISOString())
          .lt("hora_inicio", endOfDay.toISOString());

        if (reservasError) throw reservasError;

        // Extract hours from timestamps
        const hours = (reservasData || []).map((r) => {
          const date = new Date(r.hora_inicio);
          return date.getHours();
        });

        setReservedHours(hours);
      } catch (err) {
        console.error("Error fetching reservas:", err);
      } finally {
        setLoadingReservas(false);
      }
    };

    fetchReservas();
  }, [selectedDate, cancha]);

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `unknown (${local})`;
  };

  // Parse time string "HH:MM:SS" to hour number
  const parseTimeToHour = (timeStr: string): number => {
    return parseInt(timeStr.split(":")[0], 10);
  };

  // Get available hours based on location
  const getAvailableHours = (): number[] => {
    if (!configuracion || !cancha) return [];

    const aperturaStr =
      cancha.local === 1
        ? configuracion.apertura_sabana
        : configuracion.apertura_guada;
    const cierreStr =
      cancha.local === 1
        ? configuracion.cierre_sabana
        : configuracion.cierre_guada;

    const apertura = parseTimeToHour(aperturaStr);
    let cierre = parseTimeToHour(cierreStr);

    // If cierre is <= apertura, it means closing is after midnight (next day)
    // e.g., apertura=7, cierre=0 (midnight) -> cierre becomes 24
    // e.g., apertura=7, cierre=1 (1am) -> cierre becomes 25
    if (cierre <= apertura) {
      cierre = cierre + 24;
    }

    const hours: number[] = [];
    for (let h = apertura; h < cierre; h++) {
      // For display, hours >= 24 should show as 0, 1, 2, etc.
      hours.push(h < 24 ? h : h - 24);
    }
    return hours;
  };

  // Check if this is a special cancha with variable players
  const isSpecialCancha = cancha?.cantidad === "7-8-9";

  // Parse precio string "23.000" -> 23000 (period is thousands separator)
  const parsePrecio = (precioStr: string | undefined): number => {
    if (!precioStr) return 0;
    // Remove periods (thousands separator) and convert to number
    return parseInt(precioStr.replace(/\./g, ""), 10) || 0;
  };

  // Get price based on player selection for special cancha
  const getPrice = (): number => {
    if (!cancha) return 0;

    if (isSpecialCancha && selectedPlayers) {
      if (selectedPlayers === 7) return 40000;
      if (selectedPlayers === 8) return 45000;
      if (selectedPlayers === 9) return 50000;
    }

    return parsePrecio(cancha.precio);
  };

  // Get number of players per team
  const getPlayerCount = (): number => {
    if (!cancha) return 0;
    if (isSpecialCancha && selectedPlayers) {
      return selectedPlayers;
    }
    // Parse cantidad (e.g., "5" -> 5, "7" -> 7)
    return parseInt(cancha.cantidad?.toString() || "0", 10);
  };

  // Get price per person (total players = playerCount * 2 teams)
  const getPricePerPerson = (): number => {
    const price = getPrice();
    const playerCount = getPlayerCount();
    if (playerCount > 0) {
      return Math.ceil(price / (playerCount * 2));
    }
    return 0;
  };

  // Format selected date and time
  const getFormattedDateTime = (): string => {
    if (!selectedHour) return "Selecciona fecha y hora";
    const day = selectedDate.getDate();
    const month = selectedDate.toLocaleDateString("es-CR", { month: "short" });
    return `${day} ${month} - ${selectedHour}:00`;
  };

  const handleReservar = () => {
    if (!cancha || !selectedHour) return;

    navigate(`/confirmar/${cancha.id}`, {
      state: {
        cancha,
        selectedDate: selectedDate.toISOString(),
        selectedHour,
        selectedPlayers,
        precio: getPrice(),
        precioPorPersona: getPricePerPerson(),
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-white text-lg">Cargando...</div>
      </div>
    );
  }

  if (error || !cancha) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-lg">
          {error || "Cancha no encontrada"}
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Volver
        </button>
      </div>
    );
  }

  const availableHours = getAvailableHours();

  return (
    <div className="min-h-screen  border-white bg-bg pb-32 px-0 py-0 sm:px-6 lg:px-8">
      {/* Header with back button */}
      <div className="  top-0 z-10 bg-bg/95 backdrop-blur-sm px-2 pb-2 flex items-center gap-3  border-gray-800">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <IoArrowBack className="text-xl text-white" />
        </button>
        <h1 className="text-lg tracking-tight font-medium text-white truncate">
          {cancha.nombre}
        </h1>
      </div>

      {/* Image with badge */}
      <div className="relative w-full h-64 px-4 py-4">
        <img
          src={cancha.img}
          alt={cancha.nombre}
          className="w-full h-full object-cover rounded-2xl"
        />
        {/* Jugadores badge */}
        <div className="absolute top-6 left-6 px-3 py-1.5 bg-bg/90 backdrop-blur-sm rounded-full flex items-center gap-2">
          <FaUsers className="text-white" />
          <span className="text-white text-sm font-medium">
            {isSpecialCancha
              ? `${selectedPlayers || 7} jugadores`
              : `${parseInt(cancha.cantidad.toString(), 10) * 2} jugadores`}
          </span>
        </div>
        {/* Location badge */}
        <div className="absolute top-6 right-6 px-3 py-1.5 bg-bg/90 backdrop-blur-sm rounded-full flex items-center gap-1">
          <MdLocationOn className="text-secondary text-sm" />
          <span className="text-white text-sm">
            {getLocalName(cancha.local)}
          </span>
        </div>
      </div>

      {/* Special cancha player selector */}
      {isSpecialCancha && (
        <div className="px-4 mb-6">
          <h3 className="text-white font-medium mb-3 flex items-center gap-0.5">
            <TbRun className="text-secondary" />
            <TbPlayFootball className="text-secondary -ml-1" />
            Seleccione cantidad de jugadores
          </h3>
          <div className="flex gap-2">
            {[7, 8, 9].map((players) => (
              <button
                key={players}
                onClick={() => setSelectedPlayers(players)}
                className={`flex-1 py-3 rounded-lg border transition-all font-bold ${
                  selectedPlayers === players
                    ? "bg-primary border-primary text-white"
                    : "bg-transparent border-primary border-dashed text-white"
                }`}
              >
                FUT {players}
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
                  setSelectedHour(null); // Reset hour on date change
                }}
                className={`flex-shrink-0 w-16 py-3 rounded-xl border transition-all flex flex-col items-center ${
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
        <h3 className="text-white font-medium mb-3 flex gap-1 items-center">
          <FaRegClock className="text-secondary" />
          Seleccione una hora
          {loadingReservas && (
            <span className="text-white/50 text-sm ml-2">(cargando...)</span>
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

      {/* Note */}
      <div className="px-4 mb-6">
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          <p className="text-white/80 text-sm text-center">
            ⚽ Las reservas son únicamente por <strong>1 hora</strong>
          </p>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur-sm border-t border-gray-800 px-4 py-4 z-20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/60 text-xs">Precio total</p>
            <p className="text-white text-xl font-bold">
              ₡ {getPrice().toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-xs">Precio por persona (aprox)</p>
            <p className="text-white text-lg font-medium">
              ₡ {getPricePerPerson().toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-white/80 text-sm">
            📅 {getFormattedDateTime()}
          </div>
          <button
            onClick={handleReservar}
            disabled={!selectedHour}
            className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              selectedHour
                ? "bg-primary text-white"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            <FaRegCalendarCheck className="text-lg" />
            Reservar
          </button>
        </div>
      </div>
    </div>
  );
}

export default CanchaDetails;
