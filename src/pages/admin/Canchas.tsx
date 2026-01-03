import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import EditCanchaDrawer from "../../components/admin/EditCanchaDrawer";
import SuccessNotification from "../../components/admin/SuccessNotification";
import { supabase } from "../../lib/supabase";
import { FaEdit } from "react-icons/fa";
import { MdLocationOn } from "react-icons/md";
import { FaRegCalendarCheck } from "react-icons/fa";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio: string;
}

interface CanchaWithStats extends Cancha {
  reservationCount?: number;
}

export default function Canchas() {
  const [canchas, setCanchas] = useState<CanchaWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCancha, setSelectedCancha] = useState<Cancha | null>(null);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Fetch reservation count for a cancha (last 7 days)
  const fetchReservationCount = async (canchaId: number): Promise<number> => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split("T")[0];
      const startOfDay = `${dateStr} 00:00:00`;

      const { count, error } = await supabase
        .from("reservas")
        .select("*", { count: "exact", head: true })
        .eq("cancha_id", canchaId)
        .gte("hora_inicio", startOfDay);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("Error fetching reservation count:", error);
      return 0;
    }
  };

  useEffect(() => {
    const fetchCanchas = async () => {
      try {
        const { data, error } = await supabase
          .from("canchas")
          .select("*")
          .order("id");

        if (error) throw error;

        // Fetch reservation counts for all canchas
        const canchasWithStats = await Promise.all(
          (data || []).map(async (cancha) => {
            const count = await fetchReservationCount(cancha.id);
            return { ...cancha, reservationCount: count };
          })
        );

        // Sort canchas: Sabana first, then Guadalupe, then by id ascending
        const sortedCanchas = canchasWithStats.sort((a, b) => {
          if (a.local !== b.local) {
            return a.local - b.local;
          }
          return a.id - b.id;
        });

        setCanchas(sortedCanchas);
      } catch (error) {
        console.error("Error fetching canchas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCanchas();
  }, []);

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `Local ${local}`;
  };

  const handleEditCancha = (cancha: Cancha) => {
    setSelectedCancha(cancha);
    setDrawerOpen(true);
  };

  const handleCanchaUpdated = async () => {
    setShowSuccessNotification(true);
    // Refresh canchas list
    try {
      const { data, error } = await supabase
        .from("canchas")
        .select("*")
        .order("id");

      if (error) throw error;

      const canchasWithStats = await Promise.all(
        (data || []).map(async (cancha) => {
          const count = await fetchReservationCount(cancha.id);
          return { ...cancha, reservationCount: count };
        })
      );

      setCanchas(canchasWithStats);
    } catch (error) {
      console.error("Error refreshing canchas:", error);
    }
  };

  return (
    <AdminLayout title="Canchas">
      {loading ? (
        <div className="flex h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {canchas.map((cancha) => (
            <div
              key={cancha.id}
              className="bg-white rounded-lg shadow overflow-hidden"
            >
              <div className="relative h-48">
                <img
                  src={cancha.img}
                  alt={cancha.nombre}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => handleEditCancha(cancha)}
                    className="p-2 bg-white rounded-full shadow hover:bg-gray-100 transition-colors"
                    title="Editar cancha"
                  >
                    <FaEdit className="text-gray-600" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {cancha.nombre}
                </h3>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <MdLocationOn className="text-primary" />
                    {getLocalName(cancha.local)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Capacidad:</span> FUT{" "}
                    {cancha.cantidad}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Precio:</span> ₡
                    {cancha.precio}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <FaRegCalendarCheck className="text-primary" />
                    <span>
                      <span className="font-medium">
                        {cancha.reservationCount !== undefined
                          ? cancha.reservationCount
                          : "-"}
                      </span>{" "}
                      reservas (7 días)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Cancha Drawer */}
      <EditCanchaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cancha={selectedCancha}
        onSuccess={handleCanchaUpdated}
      />

      {/* Success Notification */}
      <SuccessNotification
        show={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
        message="Cancha actualizada"
        description="La cancha se ha actualizado exitosamente."
      />
    </AdminLayout>
  );
}
