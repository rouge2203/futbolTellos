import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";
import { FaCalendarCheck, FaClock, FaCheckCircle } from "react-icons/fa";
import { TbSoccerField } from "react-icons/tb";

interface Stats {
  reservasHoy: number;
  porConfirmar: number;
  confirmadas: number;
  totalCanchas: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    reservasHoy: 0,
    porConfirmar: 0,
    confirmadas: 0,
    totalCanchas: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const dateStr = today.toISOString().split("T")[0];

        // Fetch reservas for today
        const { data: reservasHoy } = await supabase
          .from("reservas")
          .select("id")
          .gte("hora_inicio", `${dateStr} 00:00:00`)
          .lte("hora_inicio", `${dateStr} 23:59:59`);

        // Fetch pending confirmations (sinpe uploaded but not confirmed)
        const { data: porConfirmar } = await supabase
          .from("reservas")
          .select("id")
          .not("sinpe_reserva", "is", null)
          .is("confirmada", null);

        // Fetch confirmed reservations
        const { data: confirmadas } = await supabase
          .from("reservas")
          .select("id")
          .eq("confirmada", true);

        // Fetch total canchas
        const { data: canchas } = await supabase.from("canchas").select("id");

        setStats({
          reservasHoy: reservasHoy?.length || 0,
          porConfirmar: porConfirmar?.length || 0,
          confirmadas: confirmadas?.length || 0,
          totalCanchas: canchas?.length || 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      name: "Reservas Hoy",
      value: stats.reservasHoy,
      icon: FaCalendarCheck,
      color: "bg-blue-500",
    },
    {
      name: "Por Confirmar",
      value: stats.porConfirmar,
      icon: FaClock,
      color: "bg-yellow-500",
    },
    {
      name: "Confirmadas",
      value: stats.confirmadas,
      icon: FaCheckCircle,
      color: "bg-green-500",
    },
    {
      name: "Total Canchas",
      value: stats.totalCanchas,
      icon: TbSoccerField,
      color: "bg-primary",
    },
  ];

  return (
    <AdminLayout title="Dashboard">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <div
                key={stat.name}
                className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6 sm:py-6"
              >
                <dt>
                  <div className={`absolute rounded-md ${stat.color} p-3`}>
                    <stat.icon className="size-6 text-white" aria-hidden="true" />
                  </div>
                  <p className="ml-16 truncate text-sm font-medium text-gray-500">
                    {stat.name}
                  </p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                  <p className="text-2xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </dd>
              </div>
            ))}
          </div>

          {/* Welcome Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Bienvenido al Panel Administrativo
            </h2>
            <p className="text-gray-600">
              Desde aquí puedes gestionar las reservas, canchas y configuración
              del sistema.
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

