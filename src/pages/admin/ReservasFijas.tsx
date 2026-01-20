import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import CreateReservaFijaDrawer from "../../components/admin/CreateReservaFijaDrawer";
import ReservaFijaDrawer from "../../components/admin/ReservaFijaDrawer";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { MdLocationOn } from "react-icons/md";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { GiWhistle } from "react-icons/gi";
import { FaRegClock } from "react-icons/fa";

interface Cancha {
  id: number;
  nombre: string;
  img?: string;
  precio?: string;
  local: number;
  cantidad?: string;
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
  cancha_id: number;
  dia: number;
  cancha?: Cancha;
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

const formatHourAmPm = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const getLocalName = (local: number): string => {
  if (local === 1) return "Sabana";
  if (local === 2) return "Guadalupe";
  return `Local ${local}`;
};

export default function ReservasFijas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reservasFijas, setReservasFijas] = useState<ReservaFija[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // Drawer state
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [selectedReservaFija, setSelectedReservaFija] =
    useState<ReservaFija | null>(null);

  useEffect(() => {
    fetchReservasFijas();
  }, []);

  const fetchReservasFijas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reservas_fijas")
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
        .order("dia", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (error) throw error;

      setReservasFijas(data || []);
    } catch (err) {
      console.error("Error fetching reservas fijas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerReservaFija = (reservaFija: ReservaFija) => {
    // Ensure cancha is properly set as a single object
    const reservaWithCancha = {
      ...reservaFija,
      cancha: Array.isArray(reservaFija.cancha)
        ? reservaFija.cancha[0]
        : reservaFija.cancha,
    };
    setSelectedReservaFija(reservaWithCancha);
    setViewDrawerOpen(true);
  };

  const handleCreateSuccess = async () => {
    await fetchReservasFijas();
    setCreateDrawerOpen(false);
  };

  const handleUpdateSuccess = async () => {
    await fetchReservasFijas();
  };

  const handleDeleteSuccess = async () => {
    await fetchReservasFijas();
    setViewDrawerOpen(false);
    setSelectedReservaFija(null);
  };

  const handleCloseViewDrawer = () => {
    setViewDrawerOpen(false);
    setSelectedReservaFija(null);
  };

  const currentDayReservas = reservasFijas.filter((r) => r.dia === selectedDay);

  if (loading) {
    return (
      <AdminLayout title="Reservaciones Fijas">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Reservaciones Fijas">
      <div className="min-h-screen w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Reservaciones Fijas
            </h3>
            <button
              onClick={() => setCreateDrawerOpen(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Crear Reservación Fija
            </button>
          </div>

          {/* Day Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
              {DAYS_OF_WEEK.map((day) => {
                const count = reservasFijas.filter(
                  (r) => r.dia === day.value
                ).length;
                return (
                  <button
                    key={day.value}
                    onClick={() => setSelectedDay(day.value)}
                    className={`${
                      selectedDay === day.value
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors`}
                  >
                    {day.label} ({count})
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Nombre
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
                    Hora
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
                    Árbitro
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Precio
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
                {currentDayReservas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                    >
                      No hay reservaciones fijas para{" "}
                      {DAYS_OF_WEEK.find((d) => d.value === selectedDay)?.label}
                    </td>
                  </tr>
                ) : (
                  currentDayReservas.map((reservaFija) => {
                    return (
                      <tr key={reservaFija.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {reservaFija.nombre_reserva_fija}
                            </div>
                            <div className="text-sm text-gray-500">
                              {reservaFija.celular_reserva_fija}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {reservaFija.cancha?.nombre || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <FaRegClock className="text-primary" />
                            {formatHourAmPm(reservaFija.hora_inicio)} -{" "}
                            {formatHourAmPm(reservaFija.hora_fin)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <MdLocationOn className="text-primary" />
                            {reservaFija.cancha
                              ? getLocalName(reservaFija.cancha.local)
                              : "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {reservaFija.cancha?.local === 2 &&
                          reservaFija.arbitro ? (
                            <div className="flex items-center gap-1">
                              <GiWhistle className="text-primary" />
                              Sí
                            </div>
                          ) : (
                            <span>No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₡ {reservaFija.precio.toLocaleString()}
                        </td>
                        <td className="pr-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleVerReservaFija(reservaFija)}
                            className="text-white bg-primary hover:bg-primary/80 rounded-lg px-4 py-2"
                          >
                            Ver Reservación
                          </button>
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

      {/* Create Drawer */}
      <CreateReservaFijaDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        onSuccess={handleCreateSuccess}
        user={user}
      />

      {/* View/Edit Drawer */}
      <ReservaFijaDrawer
        open={viewDrawerOpen}
        onClose={handleCloseViewDrawer}
        reservaFija={selectedReservaFija}
        onUpdate={handleUpdateSuccess}
        onDelete={handleDeleteSuccess}
        user={user}
      />
    </AdminLayout>
  );
}
