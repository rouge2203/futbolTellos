import { useState, useEffect, useMemo } from "react";
import AdminLayout from "../../../components/admin/AdminLayout";
import InventarioDrawer, {
  type LoteEditable,
} from "../../../components/admin/tienda/InventarioDrawer";
import MoverStockDrawer from "../../../components/admin/tienda/MoverStockDrawer";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
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
  es_principal?: boolean;
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
  tipo: "ingreso" | "ajuste";
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
  const { isSuperuser } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosLookup, setProductosLookup] = useState<Producto[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [inventario, setInventario] = useState<InventarioEntry[]>([]);
  const [ventas, setVentas] = useState<VentaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUbicacion, setFilterUbicacion] = useState<number | "">("");
  const [viewMode, setViewMode] = useState<ViewMode>("stock");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"ingreso" | "ajuste">("ingreso");
  const [selectedLote, setSelectedLote] = useState<LoteEditable | null>(null);
  const [expandedLotes, setExpandedLotes] = useState<Set<string>>(new Set());
  const [moverOpen, setMoverOpen] = useState(false);
  const [moverProducto, setMoverProducto] = useState<Producto | null>(null);
  const [moverStockByLocation, setMoverStockByLocation] =
    useState<StockByLocation>({});
  const [moverInitialTab, setMoverInitialTab] = useState<
    "transferir" | "corregir"
  >("transferir");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, allProdRes, ubRes, invRes, ventasRes] = await Promise.all([
        supabase
          .from("productos")
          .select("*")
          .eq("activo", true)
          .order("nombre"),
        supabase.from("productos").select("*").order("nombre"),
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
      if (allProdRes.error) throw allProdRes.error;
      if (ubRes.error) throw ubRes.error;
      if (invRes.error) throw invRes.error;
      if (ventasRes.error) throw ventasRes.error;

      setProductos(prodRes.data || []);
      setProductosLookup(allProdRes.data || []);
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
        const orderedEntries = [...entries].sort((a, b) => a.id - b.id);
        const first = orderedEntries[0];
        return {
          lote_id,
          producto: productosLookup.find((p) => p.id === first.producto_id),
          entries: orderedEntries,
          totalCantidad: orderedEntries.reduce((sum, e) => sum + e.cantidad, 0),
          created_at: first.created_at,
          creado_por: first.creado_por,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [inventario, productosLookup]);

  const filteredStocks = useMemo(() => {
    let result = productStocks;

    if (searchQuery) {
      result = result.filter((ps) =>
        ps.producto.nombre.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (filterUbicacion !== "") {
      result = result.filter(
        (ps) => (ps.stockByLocation[filterUbicacion] || 0) !== 0,
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

  const getLocationColor = (ubicacionId: number): string =>
    LOCATION_COLORS[Math.abs(ubicacionId) % LOCATION_COLORS.length];

  const handleOpenIngreso = () => {
    setDrawerMode("ingreso");
    setSelectedLote(null);
    setDrawerOpen(true);
  };

  const handleOpenAjuste = () => {
    setDrawerMode("ajuste");
    setSelectedLote(null);
    setDrawerOpen(true);
  };

  const openMover = (
    ps: ProductStock,
    initialTab: "transferir" | "corregir" = "transferir",
  ) => {
    if (!isSuperuser) return;
    setMoverProducto(ps.producto);
    setMoverStockByLocation(ps.stockByLocation);
    setMoverInitialTab(initialTab);
    setMoverOpen(true);
  };

  const handleOpenLoteEdit = (lote: LoteGroup) => {
    if (!lote.producto) {
      alert("No se puede editar: el producto del lote ya no existe.");
      return;
    }
    setDrawerMode(lote.entries[0]?.tipo ?? "ingreso");
    setSelectedLote({
      lote_id: lote.lote_id,
      producto_id: lote.producto.id,
      created_at: lote.created_at,
      nota: lote.entries[0]?.nota ?? null,
      entries: lote.entries.map((entry) => ({
        id: entry.id,
        producto_id: entry.producto_id,
        ubicacion_id: entry.ubicacion_id,
        cantidad: entry.cantidad,
        precio_venta: entry.precio_venta,
        costo_unitario: entry.costo_unitario,
        created_at: entry.created_at,
        tipo: entry.tipo,
      })),
    });
    setDrawerOpen(true);
  };

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
          {isSuperuser && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenIngreso}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
            >
              Registrar Inventario
            </button>
            <button
              type="button"
              onClick={handleOpenAjuste}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500"
            >
              Ajuste masivo
            </button>
          </div>
          )}
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
          {isSuperuser && (
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
          )}
        </div>

        {viewMode === "stock" && (
          <div className="space-y-4">
            {filteredStocks.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                No se encontraron productos
              </div>
            ) : (
              filteredStocks.map((ps) => (
                (() => {
                  const locationEntries = ubicaciones
                    .map((u) => ({
                      ubicacion: u,
                      stock: ps.stockByLocation[u.id] || 0,
                    }))
                    .filter((entry) => entry.stock !== 0);
                  const absTotal = locationEntries.reduce(
                    (sum, entry) => sum + Math.abs(entry.stock),
                    0,
                  );
                  const hasNegative = locationEntries.some(
                    (entry) => entry.stock < 0,
                  );

                  return (
                    <div
                      key={ps.producto.id}
                      onClick={isSuperuser ? () => openMover(ps) : undefined}
                      role={isSuperuser ? "button" : undefined}
                      tabIndex={isSuperuser ? 0 : undefined}
                      onKeyDown={
                        isSuperuser
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openMover(ps);
                              }
                            }
                          : undefined
                      }
                      className={`bg-white rounded-lg shadow p-4 ${
                        ps.total === 0 ? "opacity-80" : ""
                      } ${hasNegative ? "ring-1 ring-red-200" : ""} ${
                        isSuperuser
                          ? "cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/30 transition-shadow"
                          : ""
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
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {ps.producto.nombre}
                            </h3>
                            {hasNegative && (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                Stock negativo
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-lg font-bold text-gray-900">
                          {ps.total}
                        </span>
                      </div>

                      {absTotal > 0 ? (
                        <>
                          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                            {locationEntries.map(({ ubicacion, stock }) => (
                              <div
                                key={ubicacion.id}
                                className={`${stock < 0 ? "bg-red-500" : getLocationColor(ubicacion.id)} transition-all`}
                                style={{
                                  width: `${(Math.abs(stock) / absTotal) * 100}%`,
                                }}
                                title={`${ubicacion.nombre}: ${stock}`}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {locationEntries.map(({ ubicacion, stock }) => (
                              <div
                                key={ubicacion.id}
                                className="flex items-center gap-1.5 text-xs text-gray-600"
                              >
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    stock < 0
                                      ? "bg-red-500"
                                      : getLocationColor(ubicacion.id)
                                  }`}
                                />
                                {ubicacion.nombre}: {stock}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">Sin stock</p>
                      )}
                    </div>
                  );
                })()
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
                const visibleEntries =
                  filterUbicacion !== ""
                    ? lote.entries.filter((e) => e.ubicacion_id === filterUbicacion)
                    : lote.entries;
                return (
                  <div
                    key={lote.lote_id}
                    className="bg-white rounded-lg shadow overflow-hidden"
                  >
                    <div className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                      <button
                        type="button"
                        onClick={() => handleOpenLoteEdit(lote)}
                        className="flex items-center gap-3 text-left flex-1"
                      >
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
                      </button>
                      <span className="text-sm font-bold text-gray-900">
                        {lote.totalCantidad} unidades
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleLote(lote.lote_id)}
                        className="rounded-md p-1 hover:bg-gray-100"
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="size-4 text-gray-500 shrink-0" />
                        ) : (
                          <ChevronRightIcon className="size-4 text-gray-500 shrink-0" />
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                        <div className="space-y-2">
                          {visibleEntries.map((entry) => (
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
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLote(null);
        }}
        productos={productos}
        ubicaciones={ubicaciones}
        mode={drawerMode}
        lote={selectedLote}
        onSaved={fetchData}
        onRequestAjuste={(producto) => {
          const ps = productStocks.find((p) => p.producto.id === producto.id);
          if (!ps) return;
          setDrawerOpen(false);
          setSelectedLote(null);
          openMover(ps, "corregir");
        }}
      />

      <MoverStockDrawer
        open={moverOpen}
        onClose={() => {
          setMoverOpen(false);
          setMoverProducto(null);
        }}
        producto={moverProducto}
        ubicaciones={ubicaciones}
        stockByLocation={moverStockByLocation}
        initialTab={moverInitialTab}
        onSaved={fetchData}
      />
    </AdminLayout>
  );
}
