import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { FaWhatsapp } from "react-icons/fa";
import { MdLocationOn } from "react-icons/md";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { GiWhistle } from "react-icons/gi";
import { FaRegCalendarCheck } from "react-icons/fa";
import { FaRegClock } from "react-icons/fa";

interface Cancha {
  id: number;
  nombre: string;
  precio?: string;
}

interface Reto {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  local: string; // "Sabana" or "Guadalupe"
  fut: number;
  arbitro: boolean;
  equipo1_nombre: string | null;
  equipo1_encargado: string;
  equipo1_celular: string;
  equipo2_nombre: string | null;
  equipo2_encargado: string;
  equipo2_celular: string;
  cancha_id: number;
  reserva_id: number | null;
  cancha?: Cancha;
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

// Calculate price per team
const calculatePricePerTeam = (
  canchaPrecio: number,
  arbitro: boolean
): number => {
  const basePrice = canchaPrecio / 2;
  const arbitroCost = arbitro ? 2500 : 0;
  return basePrice + arbitroCost;
};

// Format date and time
const formatDateTime = (timestamp: string): { date: string; time: string } => {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = MONTHS_SPANISH[date.getMonth()];
  const dayName = DAYS_SPANISH[date.getDay()];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return {
    date: `${dayName} ${day} ${month}`,
    time: `${hours}:${minutes}`,
  };
};

function Retos() {
  const navigate = useNavigate();
  const [openRetos, setOpenRetos] = useState<Reto[]>([]);
  const [proximosRetos, setProximosRetos] = useState<Reto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReto, setSelectedReto] = useState<Reto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // WhatsApp business number (can be configured)
  const WHATSAPP_NUMBER = "50688888888";

  useEffect(() => {
    fetchRetos();
  }, []);

  const fetchRetos = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get today's date in Costa Rica timezone
      const today = new Date();
      const crToday = new Date(
        today.toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
      );
      const todayStr = crToday.toISOString().split("T")[0];
      const startOfDay = `${todayStr} 00:00:00`;

      // Fetch open retos (reserva_id IS NULL)
      const { data: openData, error: openError } = await supabase
        .from("retos")
        .select(
          `
          *,
          cancha:cancha_id (
            id,
            nombre,
            precio
          )
        `
        )
        .is("reserva_id", null)
        .order("hora_inicio", { ascending: true });

      if (openError) throw openError;

      // Fetch próximos retos (reserva_id IS NOT NULL, future dates)
      const { data: proximosData, error: proximosError } = await supabase
        .from("retos")
        .select(
          `
          *,
          cancha:cancha_id (
            id,
            nombre,
            precio
          )
        `
        )
        .not("reserva_id", "is", null)
        .gte("hora_inicio", startOfDay)
        .order("hora_inicio", { ascending: true });

      if (proximosError) throw proximosError;

      setOpenRetos(openData || []);
      setProximosRetos(proximosData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar retos");
      console.error("Error fetching retos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerReto = (reto: Reto) => {
    setSelectedReto(reto);
    setDialogOpen(true);
  };

  const handleWhatsApp = (reto: Reto) => {
    const { date, time } = formatDateTime(reto.hora_inicio);
    const equipo1 = reto.equipo1_nombre || "Equipo buscando reto";

    // Only show vs if there's a segundo equipo
    const matchText =
      reto.reserva_id && reto.equipo2_nombre
        ? `${equipo1} vs ${reto.equipo2_nombre}`
        : equipo1;

    const message = encodeURIComponent(
      `Hola, me interesa participar en el reto:\n\n${matchText}\nFecha: ${date}\nHora: ${time}\nLocal: ${reto.local}\nFUT ${reto.fut}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
  };

  const getLocalName = (local: string): string => {
    return local === "Sabana" || local === "Guadalupe" ? local : "Desconocido";
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

  return (
    <div className="min-h-screen bg-bg pb-32 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-4">Retos</h1>
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-4 mb-4">
          <p className="text-white/90 text-sm">
            <span>
              Le ayudaremos a encontrar un rival. Revise los retos abiertos, tal
              vez ya tenga un rival esperando. Si no, cree uno en el lugar y
              hora de su preferencia, y nosotros intentaremos conseguirle un
              oponente.
            </span>
            <strong className="text-secondary"> No garantizado.</strong>
          </p>
        </div>
        <button
          onClick={() => navigate("/crear-reto")}
          className="w-full sm:w-auto px-6 py-3 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <FaRegCalendarCheck className="text-lg" />
          Crear Reto
        </button>
      </div>

      {/* Open Retos Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">Retos Abiertos</h2>
        {openRetos.length === 0 ? (
          <div className="bg-white/5 rounded-xl p-6 text-center">
            <p className="text-white/60">No hay retos abiertos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openRetos.map((reto) => {
              const { date, time } = formatDateTime(reto.hora_inicio);
              const canchaPrecio = reto.cancha
                ? parsePrecio(reto.cancha.precio)
                : 0;
              const pricePerTeam =
                canchaPrecio > 0
                  ? calculatePricePerTeam(canchaPrecio, reto.arbitro)
                  : reto.arbitro
                  ? 2500
                  : 0;

              return (
                <div
                  key={reto.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg mb-1">
                        {reto.equipo1_nombre
                          ? `${reto.equipo1_nombre}`
                          : "Equipo busca rival"}
                      </h3>
                      <p className="text-white/60 text-sm">
                        {reto.equipo1_encargado}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <MdLocationOn className="text-secondary" />
                      <span>{getLocalName(reto.local)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <div className="flex items-center">
                        <TbRun className="text-secondary text-sm" />
                        <TbPlayFootball className="text-secondary text-sm -ml-0.5" />
                      </div>
                      <span>FUT {reto.fut}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <FaRegClock className="text-secondary text-sm" />
                      <span>
                        {date} - {time}
                      </span>
                    </div>
                    {reto.arbitro && (
                      <div className="flex items-center gap-2 text-white/80 text-sm">
                        <GiWhistle className="text-secondary text-sm" />
                        <span>Con árbitro</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <span className="text-sm text-white/60">
                        Precio por equipo:
                      </span>
                      <span>₡ {pricePerTeam.toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleVerReto(reto)}
                    className="w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Ver Reto
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Próximos Retos Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">Próximos Retos</h2>
        {proximosRetos.length === 0 ? (
          <div className="bg-white/5 rounded-xl p-6 text-center">
            <p className="text-white/60">No hay próximos retos programados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proximosRetos.map((reto) => {
              const { date, time } = formatDateTime(reto.hora_inicio);
              const equipo1 = reto.equipo1_nombre || "Equipo 1";
              const equipo2 = reto.equipo2_nombre || "Equipo 2";

              return (
                <div
                  key={reto.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <div className="text-center mb-3">
                    <h3 className="text-white font-bold text-xl mb-2">
                      {equipo1} <span className="text-secondary">vs</span>{" "}
                      {equipo2}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {reto.equipo1_encargado} vs {reto.equipo2_encargado}
                    </p>
                  </div>

                  <div className="space-y-2 text-center">
                    <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                      <MdLocationOn className="text-secondary" />
                      <span>{getLocalName(reto.local)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                      <div className="flex items-center">
                        <TbRun className="text-secondary text-sm" />
                        <TbPlayFootball className="text-secondary text-sm -ml-0.5" />
                      </div>
                      <span>FUT {reto.fut}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                      <FaRegClock className="text-secondary text-sm" />
                      <span>
                        {date} - {time}
                      </span>
                    </div>
                    {reto.arbitro && (
                      <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
                        <GiWhistle className="text-secondary text-sm" />
                        <span>Con árbitro</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reto Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
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
              {selectedReto && (
                <>
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-white mb-4"
                  >
                    Detalles del Reto
                  </DialogTitle>

                  <div className="space-y-4">
                    {/* Teams */}
                    <div className="bg-white/5 rounded-xl p-4">
                      <h4 className="text-white font-semibold mb-3 text-center">
                        {selectedReto.equipo1_nombre
                          ? `${selectedReto.equipo1_nombre}`
                          : "Equipo busca rival"}
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-white/60 text-sm">Equipo</p>
                          <p className="text-white font-medium">
                            {`${selectedReto.equipo1_nombre} busca rival` ||
                              "Sin nombre"}
                          </p>
                          <p className="text-white/80 text-sm">
                            Encargado: {selectedReto.equipo1_encargado}
                          </p>
                        </div>
                        {/* Only show equipo2 if reserva_id is not null (it's a confirmed reto) */}
                        {selectedReto.reserva_id && (
                          <div className="border-t border-white/10 pt-2">
                            <p className="text-white/60 text-sm">Equipo 2</p>
                            <p className="text-white font-medium">
                              {selectedReto.equipo2_nombre || "Sin nombre"}
                            </p>
                            <p className="text-white/80 text-sm">
                              Encargado: {selectedReto.equipo2_encargado}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="bg-white/5 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MdLocationOn className="text-secondary" />
                          <span className="text-white/80 text-sm">Local</span>
                        </div>
                        <span className="text-white font-medium">
                          {getLocalName(selectedReto.local)}
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
                          {selectedReto.fut}
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
                          {formatDateTime(selectedReto.hora_inicio).date} -{" "}
                          {formatDateTime(selectedReto.hora_inicio).time}
                        </span>
                      </div>
                      {selectedReto.arbitro && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GiWhistle className="text-secondary text-sm" />
                            <span className="text-white/80 text-sm">
                              Árbitro
                            </span>
                          </div>
                          <span className="text-white font-medium">
                            Incluido
                          </span>
                        </div>
                      )}
                      {selectedReto.cancha && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 text-sm">Cancha</span>
                          <span className="text-white font-medium">
                            {selectedReto.cancha.nombre}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-white/10 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 text-sm">
                            Precio por equipo
                          </span>
                          <span className="text-white font-bold text-lg">
                            ₡{" "}
                            {selectedReto.cancha
                              ? calculatePricePerTeam(
                                  parsePrecio(selectedReto.cancha.precio),
                                  selectedReto.arbitro
                                ).toLocaleString()
                              : selectedReto.arbitro
                              ? "2,500"
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Button */}
                    <button
                      onClick={() => handleWhatsApp(selectedReto)}
                      className="w-full py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                    >
                      <FaWhatsapp className="text-xl" />
                      Contactar por WhatsApp
                    </button>
                  </div>

                  <div className="mt-5 sm:mt-6">
                    <button
                      type="button"
                      onClick={() => setDialogOpen(false)}
                      className="inline-flex w-full justify-center rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default Retos;
