import { useState, useEffect, useMemo } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import InventarioDrawer from "../../../components/admin/tienda/InventarioDrawer";
import { supabase } from "../../../lib/supabase";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface Producto {
  id: number;
  nombre: string;
  foto_url: string | null;
  precio_sugerido: number | null;
  activo: boolean;
}

interface Ubicacion {
  id: number;
  nombre: string;
  activo: boolean;
}

interface InventarioEntry {
  id: number;
  created_at: string;
  producto_id: number;
  ubicacion_id: number;
  cantidad: number;
  precio_venta: number;
  costo_unitario: number;
  creado_por: string | null;
  nota: string | null;
  lote_id: string;
}

interface VentaEntry {
  producto_id: number;
  ubicacion_id: number;
  cantidad: number;
}

interface StockByLocation {
  [ubicacionId: number]: number;
}

interface ProductStock {
  producto: Producto;
  stockByLocation: StockByLocation;
  total: number;
}

interface LoteGroup {
  lote_id: string;
  producto: Producto | undefined;
  entries: InventarioEntry[];
  totalCantidad: number;
  created_at: string;
  creado_por: string | null;
}

type ViewMode = "stock" | "lotes";

export default function Inventario() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [inventario, setInventario] = useState<InventarioEntry[]>([]);
  const [ventas, setVentas] = useState<VentaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUbicacion, setFilterUbicacion] = useState<number | "">("");
  const [viewMode, setViewMode] = useState<ViewMode>("stock");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedLotes, setExpandedLotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, ubRes, invRes, ventasRes] = await Promise.all([
        supabase
          .from("productos")
          .select("*")
          .eq("activo", true)
          .order("nombre"),
        supabase.from("ubicaciones").select("*").eq("activo", true).order("id"),
        supabase
          .from("producto_inventario")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("producto_ventas")
          .select("producto_id, ubicacion_id, cantidad"),
      ]);

      if (prodRes.error) throw prodRes.error;
      if (ubRes.error) throw ubRes.error;
      if (invRes.error) throw invRes.error;
      if (ventasRes.error) throw ventasRes.error;

      setProductos(prodRes.data || []);
      setUbicaciones(ubRes.data || []);
      setInventario(invRes.data || []);
      setVentas(ventasRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const productStocks: ProductStock[] = useMemo(() => {
    return productos.map((producto) => {
      const stockByLocation: StockByLocation = {};

      ubicaciones.forEach((u) => {
        stockByLocation[u.id] = 0;
      });

      inventario
        .filter((i) => i.producto_id === producto.id)
        .forEach((i) => {
          if (stockByLocation[i.ubicacion_id] !== undefined) {
            stockByLocation[i.ubicacion_id] += i.cantidad;
          }
        });

      ventas
        .filter((v) => v.producto_id === producto.id)
        .forEach((v) => {
          if (stockByLocation[v.ubicacion_id] !== undefined) {
            stockByLocation[v.ubicacion_id] -= v.cantidad;
          }
        });

      const total = Object.values(stockByLocation).reduce(
        (sum, val) => sum + val,
        0,
      );

      return { producto, stockByLocation, total };
    });
  }, [productos, ubicaciones, inventario, ventas]);

  const loteGroups: LoteGroup[] = useMemo(() => {
    const groups: { [loteId: string]: InventarioEntry[] } = {};
    inventario.forEach((entry) => {
      if (!groups[entry.lote_id]) groups[entry.lote_id] = [];
      groups[entry.lote_id].push(entry);
    });

    return Object.entries(groups)
      .map(([lote_id, entries]) => {
        const first = entries[0];
        return {
          lote_id,
          producto: productos.find((p) => p.id === first.producto_id),
          entries,
          totalCantidad: entries.reduce((sum, e) => sum + e.cantidad, 0),
          created_at: first.created_at,
          creado_por: first.creado_por,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [inventario, productos]);

  const filteredStocks = useMemo(() => {
    let result = productStocks;

    if (searchQuery) {
      result = result.filter((ps) =>
        ps.producto.nombre.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (filterUbicacion !== "") {
      result = result.filter(
        (ps) => (ps.stockByLocation[filterUbicacion] || 0) > 0,
      );
    }

    return result;
  }, [productStocks, searchQuery, filterUbicacion]);

  const filteredLotes = useMemo(() => {
    let result = loteGroups;

    if (searchQuery) {
      result = result.filter((lg) =>
        lg.producto?.nombre.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (filterUbicacion !== "") {
      result = result.filter((lg) =>
        lg.entries.some((e) => e.ubicacion_id === filterUbicacion),
      );
    }

    return result;
  }, [loteGroups, searchQuery, filterUbicacion]);

  const toggleLote = (loteId: string) => {
    setExpandedLotes((prev) => {
      const next = new Set(prev);
      if (next.has(loteId)) next.delete(loteId);
      else next.add(loteId);
      return next;
    });
  };

  const getUbicacionName = (id: number) =>
    ubicaciones.find((u) => u.id === id)?.nombre || "Desconocida";

  const LOCATION_COLORS = [
    "bg-blue-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-teal-500",
  ];

  if (loading) {
    return (
      <AdminLayout title="Inventario">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Inventario">
      <div className="space-y-6 min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar producto..."
                className="block w-full rounded-md bg-white border border-gray-300 pl-9 pr-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              />
            </div>
            <select
              value={filterUbicacion}
              onChange={(e) =>
                setFilterUbicacion(
                  e.target.value ? parseInt(e.target.value) : "",
                )
              }
              className="rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">Todas las ubicaciones</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            Registrar Inventario
          </button>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setViewMode("stock")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "stock"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Stock por Producto
          </button>
          <button
            type="button"
            onClick={() => setViewMode("lotes")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "lotes"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Historial de Lotes
          </button>
        </div>

        {viewMode === "stock" && (
          <div className="space-y-4">
            {filteredStocks.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                No se encontraron productos
              </div>
            ) : (
              filteredStocks.map((ps) => (
                <div
                  key={ps.producto.id}
                  className={`bg-white rounded-lg shadow p-4 ${
                    ps.total === 0 ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {ps.producto.foto_url && (
                        <img
                          src={ps.producto.foto_url}
                          alt={ps.producto.nombre}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                      )}
                      <h3 className="text-sm font-semibold text-gray-900">
                        {ps.producto.nombre}
                      </h3>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {ps.total}
                    </span>
                  </div>

                  {ps.total > 0 && (
                    <>
                      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                        {ubicaciones.map((u, idx) => {
                          const stock = ps.stockByLocation[u.id] || 0;
                          if (stock <= 0) return null;
                          const pct = (stock / ps.total) * 100;
                          return (
                            <div
                              key={u.id}
                              className={`${LOCATION_COLORS[idx % LOCATION_COLORS.length]} transition-all`}
                              style={{ width: `${pct}%` }}
                              title={`${u.nombre}: ${stock}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {ubicaciones.map((u, idx) => {
                          const stock = ps.stockByLocation[u.id] || 0;
                          if (stock <= 0) return null;
                          return (
                            <div
                              key={u.id}
                              className="flex items-center gap-1.5 text-xs text-gray-600"
                            >
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${LOCATION_COLORS[idx % LOCATION_COLORS.length]}`}
                              />
                              {u.nombre}: {stock}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {ps.total === 0 && (
                    <p className="text-xs text-gray-400">Sin stock</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {viewMode === "lotes" && (
          <div className="space-y-3">
            {filteredLotes.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                No se encontraron lotes
              </div>
            ) : (
              filteredLotes.map((lote) => {
                const isExpanded = expandedLotes.has(lote.lote_id);
                return (
                  <div
                    key={lote.lote_id}
                    className="bg-white rounded-lg shadow overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleLote(lote.lote_id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 text-left">
                        {isExpanded ? (
                          <ChevronDownIcon className="size-4 text-gray-500 shrink-0" />
                        ) : (
                          <ChevronRightIcon className="size-4 text-gray-500 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {lote.producto?.nombre || "Producto eliminado"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(lote.created_at).toLocaleDateString(
                              "es-CR",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                            {lote.creado_por &&
                              ` · ${lote.creado_por.split("-")[0]}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {lote.totalCantidad} unidades
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                        <div className="space-y-2">
                          {lote.entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-700">
                                {getUbicacionName(entry.ubicacion_id)}
                              </span>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-600">
                                  {entry.cantidad} uds
                                </span>
                                <span className="text-gray-500 text-xs">
                                  ₡{entry.precio_venta.toLocaleString()} venta ·
                                  ₡{entry.costo_unitario.toLocaleString()} costo
                                </span>
                              </div>
                            </div>
                          ))}
                          {lote.entries[0]?.nota && (
                            <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                              Nota: {lote.entries[0].nota}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <InventarioDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        productos={productos}
        ubicaciones={ubicaciones}
        onSaved={fetchData}
      />
    </AdminLayout>
  );
}
