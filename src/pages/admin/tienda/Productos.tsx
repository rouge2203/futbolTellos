import { useState, useEffect, useMemo } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import ProductoDrawer from "../../../components/admin/tienda/ProductoDrawer";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
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
  const { isSuperuser } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventasUltimos30Dias, setVentasUltimos30Dias] = useState<
    Record<number, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"nombre" | "reciente" | "vendidos">(
    "nombre",
  );
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    fetchProductos();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, showInactive, sortBy]);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateBoundary = thirtyDaysAgo.toISOString();

      const [productosRes, ventasRes] = await Promise.all([
        supabase.from("productos").select("*"),
        supabase
          .from("producto_ventas")
          .select("producto_id, cantidad, created_at")
          .gte("created_at", dateBoundary),
      ]);

      const { data, error } = productosRes;
      if (error) throw error;
      if (ventasRes.error) throw ventasRes.error;

      const salesMap: Record<number, number> = {};
      for (const row of ventasRes.data ?? []) {
        const productoId = row.producto_id;
        salesMap[productoId] = (salesMap[productoId] ?? 0) + (row.cantidad ?? 0);
      }

      setProductos(data || []);
      setVentasUltimos30Dias(salesMap);
    } catch (error) {
      console.error("Error fetching productos:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProductos = useMemo(() => {
    let result = productos.filter((p) => {
      const matchesSearch = p.nombre.toLowerCase().includes(debouncedSearch);
      const matchesActive = showInactive || p.activo;
      return matchesSearch && matchesActive;
    });

    switch (sortBy) {
      case "reciente":
        result = [...result].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case "vendidos":
        result = [...result].sort((a, b) => {
          const soldB = ventasUltimos30Dias[b.id] ?? 0;
          const soldA = ventasUltimos30Dias[a.id] ?? 0;
          if (soldB !== soldA) return soldB - soldA;
          return a.nombre.localeCompare(b.nombre, "es");
        });
        break;
      default:
        result = [...result].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es"),
        );
    }
    return result;
  }, [productos, debouncedSearch, showInactive, sortBy, ventasUltimos30Dias]);

  const totalPages = Math.max(1, Math.ceil(filteredProductos.length / ITEMS_PER_PAGE));
  const paginatedProductos = filteredProductos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

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
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "nombre" | "reciente" | "vendidos")
              }
              className="rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="nombre">Nombre</option>
              <option value="reciente">Más nuevo</option>
              <option value="vendidos">Más vendido (30 días)</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Mostrar inactivos
            </label>
            {isSuperuser && (
            <button
              type="button"
              onClick={handleNewProducto}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
            >
              Nuevo Producto
            </button>
            )}
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedProductos.map((producto) => (
                <div
                  key={producto.id}
                  onClick={() => handleCardClick(producto)}
                  className={`bg-white border rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                    !producto.activo ? "opacity-60 grayscale" : ""
                  }`}
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
                        ? `₡ ${producto.precio_sugerido.toLocaleString("es-CR")}`
                        : "Sin precio"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Vendido (30d): {ventasUltimos30Dias[producto.id] ?? 0}
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <p className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
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
