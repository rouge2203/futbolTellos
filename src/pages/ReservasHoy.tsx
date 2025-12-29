import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FaEye } from "react-icons/fa";
import { MdLocationOn } from "react-icons/md";
import { TiLocationArrowOutline } from "react-icons/ti";
import { TiLocationArrow } from "react-icons/ti";

interface Reserva {
  id: number;
  hora_inicio: string;
  nombre_reserva: string;
  cancha: {
    id: number;
    nombre: string;
    local: number;
  };
}

function ReservasHoy() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [locationFilter, setLocationFilter] = useState<number | null>(null); // null = all, 1 = Sabana, 2 = Guadalupe

  // Get date string in Costa Rica timezone (UTC-6)
  const getDateStr = (daysOffset: number = 0): string => {
    const now = new Date();
    const crTime = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
    );
    crTime.setDate(crTime.getDate() + daysOffset);
    const year = crTime.getFullYear();
    const month = String(crTime.getMonth() + 1).padStart(2, "0");
    const day = String(crTime.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchReservas = async () => {
      setLoading(true);
      setError(null);

      try {
        const dateStr = getDateStr(showTomorrow ? 1 : 0);
        const startOfDay = `${dateStr} 00:00:00`;
        const endOfDay = `${dateStr} 23:59:59`;

        const { data, error: fetchError } = await supabase
          .from("reservas")
          .select(
            `
            id,
            hora_inicio,
            nombre_reserva,
            cancha:cancha_id (
              id,
              nombre,
              local
            )
          `
          )
          .gte("hora_inicio", startOfDay)
          .lte("hora_inicio", endOfDay)
          .order("hora_inicio", { ascending: true });

        if (fetchError) throw fetchError;

        // Transform data - cancha comes as array from Supabase join, take first element
        const transformedData = (data || []).map((reserva: any) => ({
          ...reserva,
          cancha: Array.isArray(reserva.cancha)
            ? reserva.cancha[0]
            : reserva.cancha,
        }));

        // Filter by location if filter is set
        let filteredData = transformedData;
        if (locationFilter !== null) {
          filteredData = filteredData.filter(
            (reserva) => reserva.cancha?.local === locationFilter
          );
        }

        setReservas(filteredData);
      } catch (err) {
        console.error("Error fetching reservas:", err);
        setError(
          err instanceof Error
            ? err.message
            : `Error al cargar las reservas de ${
                showTomorrow ? "mañana" : "hoy"
              }`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReservas();
  }, [showTomorrow, locationFilter]);

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `Local ${local}`;
  };

  // Parse hour from timestamp string
  const parseHourFromTimestamp = (timestamp: string): string => {
    const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[1]}:${timeMatch[2]}`;
    }
    // Fallback
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  return (
    <div className="min-h-screen bg-bg px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">
            Reservas de {showTomorrow ? "Mañana" : "Hoy"}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTomorrow(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !showTomorrow
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setShowTomorrow(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showTomorrow
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              Mañana
            </button>
          </div>
        </div>

        {/* Location Filter */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setLocationFilter(locationFilter === 1 ? null : 1)}
            className={`px-3 py-3 rounded-md tracking-tight text-white text-xl font-bold transition-colors flex items-center justify-center gap-0.5 flex-1 border-primary border border-dashed ${
              locationFilter === 1 ? "bg-primary" : "bg-transparent"
            }`}
          >
            {locationFilter === 1 ? (
              <TiLocationArrow className="text-2xl shrink-0" />
            ) : (
              <TiLocationArrowOutline className="text-xl shrink-0" />
            )}
            <span className="truncate">SABANA</span>
          </button>
          <button
            onClick={() => setLocationFilter(locationFilter === 2 ? null : 2)}
            className={`px-3 py-3 rounded-md tracking-tight text-white text-xl font-bold transition-colors flex items-center justify-center gap-0.5 flex-1 border-primary border border-dashed ${
              locationFilter === 2 ? "bg-primary" : "bg-transparent"
            }`}
          >
            {locationFilter === 2 ? (
              <TiLocationArrow className="text-2xl shrink-0" />
            ) : (
              <TiLocationArrowOutline className="text-xl shrink-0" />
            )}
            <span className="truncate">GUADALUPE</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <div className="text-red-400 text-lg mb-4">{error}</div>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Volver al inicio
          </button>
        </div>
      ) : reservas.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-8 text-center">
          <p className="text-white/80 text-lg">
            No hay reservas para {showTomorrow ? "mañana" : "hoy"}
            {locationFilter !== null &&
              ` en ${locationFilter === 1 ? "Sabana" : "Guadalupe"}`}
          </p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Nombre Reserva
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/5 divide-y divide-white/10">
                {reservas.map((reserva) => (
                  <tr
                    key={reserva.id}
                    className="hover:bg-white/10 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {reserva.nombre_reserva}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MdLocationOn className="text-secondary text-sm" />
                        <span className="text-sm text-white/80">
                          {getLocalName(reserva.cancha?.local || 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {parseHourFromTimestamp(reserva.hora_inicio)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/reserva/${reserva.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <FaEye />
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReservasHoy;
