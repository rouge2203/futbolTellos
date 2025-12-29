import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";
import { FaEdit } from "react-icons/fa";
import { MdLocationOn } from "react-icons/md";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio: string;
}

export default function Canchas() {
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCanchas = async () => {
      try {
        const { data, error } = await supabase
          .from("canchas")
          .select("*")
          .order("id");

        if (error) throw error;
        setCanchas(data || []);
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder for future functionality */}
      <div className="mt-6  bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Gestión de Canchas
        </h3>
        <p className="text-gray-600 text-sm">
          Próximamente podrás agregar, editar y eliminar canchas desde esta
          sección.
        </p>
      </div>
    </AdminLayout>
  );
}
