import { useState, useEffect } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import ProductoDrawer from "../../../components/admin/tienda/ProductoDrawer";
import { supabase } from "../../../lib/supabase";
import { CubeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface Producto {
  id: number;
  created_at: string;
  nombre: string;
  foto_url: string | null;
  precio_sugerido: number | null;
  creado_por: string | null;
  activo: boolean;
}

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .order("nombre");

      if (error) throw error;

      setProductos(data || []);
    } catch (error) {
      console.error("Error fetching productos:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProductos = productos.filter((p) => {
    const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
    const matchesActive = showInactive || p.activo;
    return matchesSearch && matchesActive;
  });

  const handleCardClick = (producto: Producto) => {
    setSelectedProducto(producto);
    setDrawerOpen(true);
  };

  const handleNewProducto = () => {
    setSelectedProducto(null);
    setDrawerOpen(true);
  };

  return (
    <AdminLayout title="Productos">
      <div className="space-y-4 min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="block w-full rounded-md bg-white border border-gray-300 pl-9 pr-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Mostrar inactivos
            </label>
            <button
              type="button"
              onClick={handleNewProducto}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
            >
              Nuevo Producto
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredProductos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CubeIcon className="mx-auto size-12 text-gray-300" />
            <p className="mt-2 text-sm">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProductos.map((producto) => (
              <div
                key={producto.id}
                onClick={() => handleCardClick(producto)}
                className="bg-white border rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              >
                {producto.foto_url ? (
                  <img
                    src={producto.foto_url}
                    alt={producto.nombre}
                    className="aspect-square w-full object-cover bg-gray-100"
                  />
                ) : (
                  <div className="aspect-square w-full bg-gray-100 flex items-center justify-center">
                    <CubeIcon className="size-12 text-gray-300" />
                  </div>
                )}
                <div className="p-3">
                  <p className="font-semibold text-gray-900 truncate">
                    {producto.nombre}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {producto.precio_sugerido != null
                      ? `₡ ${producto.precio_sugerido.toLocaleString()}`
                      : "Sin precio"}
                  </p>
                  <div className="mt-2">
                    {producto.activo ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        producto={selectedProducto}
        onSaved={fetchProductos}
      />
    </AdminLayout>
  );
}
