import { useState, useEffect } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import UbicacionDrawer from "../../../components/admin/tienda/UbicacionDrawer";
import { supabase } from "../../../lib/supabase";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";

interface Ubicacion {
  id: number;
  created_at: string;
  nombre: string;
  activo: boolean;
  creado_por: string | null;
}

interface StockCount {
  [ubicacionId: number]: number;
}

export default function Ubicaciones() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [stockCounts, setStockCounts] = useState<StockCount>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUbicacion, setSelectedUbicacion] = useState<Ubicacion | null>(
    null,
  );

  useEffect(() => {
    fetchUbicaciones();
  }, []);

  const fetchUbicaciones = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ubicaciones")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;
      setUbicaciones(data || []);

      await fetchStockCounts(data || []);
    } catch (error) {
      console.error("Error fetching ubicaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockCounts = async (ubicacionesList: Ubicacion[]) => {
    try {
      const counts: StockCount = {};

      const { data: inventario, error: invError } = await supabase
        .from("producto_inventario")
        .select("ubicacion_id, cantidad");

      if (invError) throw invError;

      const { data: ventas, error: ventasError } = await supabase
        .from("producto_ventas")
        .select("ubicacion_id, cantidad");

      if (ventasError) throw ventasError;

      for (const ub of ubicacionesList) {
        counts[ub.id] = 0;
      }

      (inventario || []).forEach((item: any) => {
        if (item.ubicacion_id && counts[item.ubicacion_id] !== undefined) {
          counts[item.ubicacion_id] += item.cantidad || 0;
        }
      });

      (ventas || []).forEach((item: any) => {
        if (item.ubicacion_id && counts[item.ubicacion_id] !== undefined) {
          counts[item.ubicacion_id] -= item.cantidad || 0;
        }
      });

      setStockCounts(counts);
    } catch (error) {
      console.error("Error fetching stock counts:", error);
      alert("No se pudo calcular el stock por ubicación.");
    }
  };

  const handleOpenCreate = () => {
    setSelectedUbicacion(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (ubicacion: Ubicacion) => {
    setSelectedUbicacion(ubicacion);
    setDrawerOpen(true);
  };

  const handleSaved = async () => {
    await fetchUbicaciones();
  };

  const filteredUbicaciones = ubicaciones.filter((u) =>
    u.nombre.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <AdminLayout title="Ubicaciones">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Ubicaciones">
      <div className="space-y-6 min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ubicación..."
              className="block w-full rounded-md bg-white border border-gray-300 pl-9 pr-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            />
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            Nueva Ubicación
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de creación
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUbicaciones.map((ubicacion) => (
                <tr
                  key={ubicacion.id}
                  onClick={() => handleOpenEdit(ubicacion)}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    ubicacion.nombre === "Bodega"
                      ? "bg-amber-50/50 border-l-4 border-l-amber-400"
                      : ""
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {ubicacion.nombre}
                      </span>
                      {ubicacion.nombre === "Bodega" && (
                        <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Principal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {ubicacion.activo ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {stockCounts[ubicacion.id] ?? 0} unidades
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(ubicacion.created_at).toLocaleDateString(
                      "es-CR",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      },
                    )}
                  </td>
                </tr>
              ))}
              {filteredUbicaciones.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No se encontraron ubicaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UbicacionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ubicacion={selectedUbicacion}
        onSaved={handleSaved}
      />
    </AdminLayout>
  );
}
