import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import RetoDrawer from "../../components/admin/RetoDrawer";
import SuccessNotification from "../../components/admin/SuccessNotification";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { MdLocationOn } from "react-icons/md";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { GiWhistle } from "react-icons/gi";
import { TbTrash } from "react-icons/tb";

interface Cancha {
  id: number;
  nombre: string;
  img?: string;
  precio?: string;
  local: number;
  cantidad?: string;
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
  equipo1_correo: string | null;
  equipo2_nombre: string | null;
  equipo2_encargado: string | null;
  equipo2_celular: string | null;
  cancha_id: number;
  reserva_id: number | null;
  cancha?: Cancha;
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

// Parse precio string "23.000" -> 23000
const parsePrecio = (precioStr: string | undefined): number => {
  if (!precioStr) return 0;
  return parseInt(precioStr.replace(/\./g, ""), 10) || 0;
};

// Calculate price per team
const calculatePricePerTeam = (
  canchaPrecio: number,
  arbitro: boolean,
  local: string
): number => {
  const basePrice = canchaPrecio / 2;
  // Arbitro cost only for Guadalupe (local == "Guadalupe")
  const arbitroCost = local === "Guadalupe" && arbitro ? 2500 : 0;
  return basePrice + arbitroCost;
};

// Format date and time
const formatDateTime = (timestamp: string): { date: string; time: string } => {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = MONTHS_SPANISH[date.getMonth()];
  const dayName = DAYS_SPANISH[date.getDay()];
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return {
    date: `${dayName} ${day} ${month}`,
    time: `${hour12}:${minutes} ${ampm}`,
  };
};

const getLocalName = (local: string): string => {
  return local === "Sabana" || local === "Guadalupe" ? local : "Desconocido";
};

export default function Retos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openRetos, setOpenRetos] = useState<Reto[]>([]);
  const [closedRetos, setClosedRetos] = useState<Reto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"assign" | "view">("assign");
  const [selectedReto, setSelectedReto] = useState<Reto | null>(null);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  useEffect(() => {
    fetchRetos();
  }, []);

  const fetchRetos = async () => {
    setLoading(true);
    try {
      // Fetch open retos (reserva_id IS NULL)
      const { data: openData, error: openError } = await supabase
        .from("retos")
        .select(
          `
          *,
          cancha:cancha_id (
            id,
            nombre,
            img,
            precio,
            local,
            cantidad
          )
        `
        )
        .is("reserva_id", null)
        .order("hora_inicio", { ascending: false });

      if (openError) throw openError;

      // Fetch closed retos (reserva_id IS NOT NULL)
      const { data: closedData, error: closedError } = await supabase
        .from("retos")
        .select(
          `
          *,
          cancha:cancha_id (
            id,
            nombre,
            img,
            precio,
            local,
            cantidad
          )
        `
        )
        .not("reserva_id", "is", null)
        .order("hora_inicio", { ascending: false });

      if (closedError) throw closedError;

      setOpenRetos(openData || []);
      setClosedRetos(closedData || []);
    } catch (err) {
      console.error("Error fetching retos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAsignarRival = (reto: Reto) => {
    setSelectedReto(reto);
    setDrawerMode("assign");
    setDrawerOpen(true);
  };

  const handleVerReto = (reto: Reto) => {
    setSelectedReto(reto);
    setDrawerMode("view");
    setDrawerOpen(true);
  };

  const handleReservaCreated = async () => {
    await fetchRetos();
    setShowSuccessNotification(true);
    setDrawerOpen(false);
  };

  const handleDeleteReto = async (retoId: number) => {
    try {
      const { error } = await supabase.from("retos").delete().eq("id", retoId);

      if (error) throw error;

      await fetchRetos();
    } catch (error) {
      console.error("Error deleting reto:", error);
      throw error;
    }
  };

  // Check if reto is expired (hora_inicio has passed)
  const isRetoExpired = (reto: Reto): boolean => {
    const retoDate = new Date(reto.hora_inicio);
    const now = new Date();
    return retoDate < now;
  };

  const currentRetos = activeTab === "open" ? openRetos : closedRetos;

  if (loading) {
    return (
      <AdminLayout title="Retos">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Retos">
      <div className="min-h-screen w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Lista de Retos
            </h3>
            <div className="flex items-center gap-4">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab("open")}
                  className={`${
                    activeTab === "open"
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                >
                  Retos Abiertos ({openRetos.length})
                </button>
                <button
                  onClick={() => setActiveTab("closed")}
                  className={`${
                    activeTab === "closed"
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
                >
                  Retos Cerrados ({closedRetos.length})
                </button>
              </nav>
              <button
                onClick={() => navigate("/retos")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Crear Reto
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg  border border-gray-200 shadow-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Equipo 1
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Cancha
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Fecha/Hora
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Local
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    FUT
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Árbitro
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Precio por equipo
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRetos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                    >
                      No hay retos{" "}
                      {activeTab === "open" ? "abiertos" : "cerrados"}
                    </td>
                  </tr>
                ) : (
                  currentRetos.map((reto) => {
                    const { date, time } = formatDateTime(reto.hora_inicio);
                    const canchaPrecio = reto.cancha
                      ? parsePrecio(reto.cancha.precio)
                      : 0;
                    const pricePerTeam =
                      canchaPrecio > 0
                        ? calculatePricePerTeam(
                            canchaPrecio,
                            reto.arbitro,
                            reto.local
                          )
                        : reto.local === "Guadalupe" && reto.arbitro
                        ? 2500
                        : 0;

                    const expired = activeTab === "open" && isRetoExpired(reto);

                    return (
                      <tr key={reto.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {reto.equipo1_nombre || "Sin nombre"}
                              </div>
                              <div className="text-sm text-gray-500">
                                {reto.equipo1_encargado}
                              </div>
                            </div>
                            {expired && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                Expirado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reto.cancha?.nombre || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{date}</div>
                          <div className="text-sm text-gray-500">{time}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <MdLocationOn className="text-primary" />
                            {getLocalName(reto.local)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <TbRun className="text-primary" />
                            <TbPlayFootball className="text-primary -ml-0.5" />
                            {reto.fut}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {reto.local === "Guadalupe" && reto.arbitro ? (
                            <div className="flex items-center gap-1">
                              <GiWhistle className="text-primary" />
                              Sí
                            </div>
                          ) : (
                            <span>No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₡ {pricePerTeam.toLocaleString()}
                        </td>
                        <td className="pr-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {activeTab === "open" ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAsignarRival(reto)}
                                className="text-white bg-primary hover:bg-primary/80 rounded-lg px-4 py-2"
                              >
                                Asignar rival
                              </button>
                              <button
                                onClick={() => handleAsignarRival(reto)}
                                className="text-primary bg-gray-100 hover:bg-gray-200 rounded-lg p-2"
                              >
                                <TbTrash className="size-5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleVerReto(reto)}
                              className="text-white bg-primary hover:bg-primary/80 rounded-lg px-4 py-2"
                            >
                              Ver reto
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reto Drawer */}
      <RetoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        reto={selectedReto}
        mode={drawerMode}
        onReservaCreated={handleReservaCreated}
        onRefresh={fetchRetos}
        onDelete={handleDeleteReto}
        user={user}
      />

      {/* Success Notification */}
      <SuccessNotification
        show={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
        message="Reserva creada"
        description="La reservación se ha creado exitosamente y el reto ha sido cerrado."
      />
    </AdminLayout>
  );
}
