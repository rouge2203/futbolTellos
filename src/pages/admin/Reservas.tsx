import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";
import { FaCheck, FaTimes, FaEye } from "react-icons/fa";

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  precio: number;
  arbitro: boolean;
  sinpe_reserva: string | null;
  confirmada: boolean | null;
  created_at: string;
  cancha: {
    id: number;
    nombre: string;
    local: number;
  };
}

export default function Reservas() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed">("all");

  const fetchReservas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("reservas")
        .select(
          `
          *,
          cancha:cancha_id (
            id,
            nombre,
            local
          )
        `
        )
        .order("hora_inicio", { ascending: false });

      if (filter === "pending") {
        query = query.not("sinpe_reserva", "is", null).is("confirmada", null);
      } else if (filter === "confirmed") {
        query = query.eq("confirmada", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReservas(data || []);
    } catch (error) {
      console.error("Error fetching reservas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservas();
  }, [filter]);

  const handleConfirm = async (id: number) => {
    try {
      await supabase.from("reservas").update({ confirmada: true }).eq("id", id);
      fetchReservas();
    } catch (error) {
      console.error("Error confirming reserva:", error);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("¿Está seguro de rechazar esta reserva?")) return;
    try {
      await supabase.from("reservas").delete().eq("id", id);
      fetchReservas();
    } catch (error) {
      console.error("Error rejecting reserva:", error);
    }
  };

  const formatDate = (dateStr: string): string => {
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
    }
    return dateStr;
  };

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `Local ${local}`;
  };

  const getStatusBadge = (reserva: Reserva) => {
    if (reserva.confirmada === true) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
          <FaCheck className="text-xs" /> Confirmada
        </span>
      );
    }
    if (reserva.sinpe_reserva) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
          Por confirmar
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
        Pendiente SINPE
      </span>
    );
  };

  return (
    <AdminLayout title="Reservas">
      {/* Filters */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "pending"
              ? "bg-yellow-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Por Confirmar
        </button>
        <button
          onClick={() => setFilter("confirmed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "confirmed"
              ? "bg-green-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Confirmadas
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reserva
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cancha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reservas.map((reserva) => (
                <tr key={reserva.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {reserva.nombre_reserva}
                    </div>
                    <div className="text-sm text-gray-500">
                      {reserva.celular_reserva}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {reserva.cancha?.nombre}
                    </div>
                    <div className="text-sm text-gray-500">
                      {getLocalName(reserva.cancha?.local)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(reserva.hora_inicio)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₡{reserva.precio.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(reserva)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {reserva.sinpe_reserva && (
                        <a
                          href={reserva.sinpe_reserva}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver comprobante"
                        >
                          <FaEye />
                        </a>
                      )}
                      {reserva.sinpe_reserva && !reserva.confirmada && (
                        <>
                          <button
                            onClick={() => handleConfirm(reserva.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Confirmar"
                          >
                            <FaCheck />
                          </button>
                          <button
                            onClick={() => handleReject(reserva.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Rechazar"
                          >
                            <FaTimes />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {reservas.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No hay reservas para mostrar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

