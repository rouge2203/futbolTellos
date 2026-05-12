import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../../components/admin/AdminLayout";
import VentaDrawer from "../../../components/admin/tienda/VentaDrawer";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { generateReporteVentas } from "./utils/generateReporteVentas";
import {
  generateCierreTienda,
  type VentaCierreTienda,
} from "./utils/generateCierreTienda";
import {
  ArrowLongLeftIcon,
  ArrowLongRightIcon,
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  PlusIcon,
  CubeIcon,
  ShoppingCartIcon,
} from "@heroicons/react/20/solid";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { LiaMoneyBillWaveSolid } from "react-icons/lia";
import { RiBankLine } from "react-icons/ri";
import { HiOutlineBanknotes } from "react-icons/hi2";

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

interface Venta {
  id: number;
  created_at: string;
  producto_id: number;
  ubicacion_id: number;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  metodo_pago: string;
  comprobante_url: string | null;
  nota: string | null;
  vendido_por: string;
}

interface StockInfo {
  producto_id: number;
  ubicacion_id: number;
  stock: number;
  precio_venta: number;
  costo_unitario: number;
}

type DateFilter = "hoy" | "ayer" | "semana" | "mes" | "custom";

const ITEMS_PER_PAGE = 15;

const formatCurrency = (value: number): string => `₡ ${value.toLocaleString()}`;

const PAYMENT_BREAKDOWN_ALLOWED_EMAILS = new Set([
  "agendakathia1974@gmail.com",
  "joseruizsuarez@hotmail.com",
]);

const getTimezoneOffset = (): string => {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
};

const getStartOfDay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00${getTimezoneOffset()}`;
};

const getEndOfDay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T23:59:59${getTimezoneOffset()}`;
};

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const formatDateES = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (date: Date): string => {
  return date.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
};

const normalizeMetodoPago = (metodo: string): string => metodo.toLowerCase();

const formatMetodoPago = (metodo: string): string => {
  switch (normalizeMetodoPago(metodo)) {
    case "efectivo":
      return "Efectivo";
    case "sinpe":
      return "SINPE";
    case "transferencia":
      return "Transferencia";
    default:
      return metodo;
  }
};

const isInDateRange = (dateStr: string, start: string, end: string): boolean => {
  const time = new Date(dateStr).getTime();
  return time >= new Date(start).getTime() && time <= new Date(end).getTime();
};

export default function TiendaDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [stockData, setStockData] = useState<StockInfo[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [cierreDialogOpen, setCierreDialogOpen] = useState(false);
  const [cierreNota, setCierreNota] = useState("");
  const [cierreFaltante, setCierreFaltante] = useState("");
  const [generatingCierre, setGeneratingCierre] = useState(false);

  const [dateFilter, setDateFilter] = useState<DateFilter>("hoy");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedUbicaciones, setSelectedUbicaciones] = useState<number[]>([]);
  const [selectedProductoId, setSelectedProductoId] = useState<number | "">("");
  const [searchNota, setSearchNota] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedVentaId, setExpandedVentaId] = useState<number | null>(null);
  const canSeePaymentBreakdown =
    PAYMENT_BREAKDOWN_ALLOWED_EMAILS.has(user?.email?.toLowerCase() ?? "");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "hoy":
        return { start: getStartOfDay(now), end: getEndOfDay(now) };
      case "ayer": {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: getStartOfDay(yesterday),
          end: getEndOfDay(yesterday),
        };
      }
      case "semana": {
        const weekStart = getStartOfWeek(now);
        return { start: getStartOfDay(weekStart), end: getEndOfDay(now) };
      }
      case "mes": {
        const monthStart = getStartOfMonth(now);
        return { start: getStartOfDay(monthStart), end: getEndOfDay(now) };
      }
      case "custom": {
        const tz = getTimezoneOffset();
        return {
          start: customStart ? `${customStart}T00:00:00${tz}` : getStartOfDay(now),
          end: customEnd ? `${customEnd}T23:59:59${tz}` : getEndOfDay(now),
        };
      }
    }
  }, [dateFilter, customStart, customEnd]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, ubRes, ventasRes, invRes, stockVentasRes] =
        await Promise.all([
        supabase.from("productos").select("*").eq("activo", true),
        supabase.from("ubicaciones").select("*").eq("activo", true),
        supabase
          .from("producto_ventas")
          .select("*")
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end)
          .order("created_at", { ascending: false }),
        supabase
          .from("producto_inventario")
          .select(
            "producto_id, ubicacion_id, cantidad, precio_venta, costo_unitario",
          ),
        supabase
          .from("producto_ventas")
          .select("producto_id, ubicacion_id, cantidad"),
      ]);

      setProductos(prodRes.data ?? []);
      setUbicaciones(ubRes.data ?? []);
      setVentas(ventasRes.data ?? []);

      const invRows = invRes.data ?? [];
      const stockMap = new Map<string, StockInfo>();
      for (const row of invRows) {
        const key = `${row.producto_id}-${row.ubicacion_id}`;
        const existing = stockMap.get(key);
        if (existing) {
          existing.stock += row.cantidad;
          existing.precio_venta = row.precio_venta;
          existing.costo_unitario = row.costo_unitario;
        } else {
          stockMap.set(key, {
            producto_id: row.producto_id,
            ubicacion_id: row.ubicacion_id,
            stock: row.cantidad,
            precio_venta: row.precio_venta,
            costo_unitario: row.costo_unitario,
          });
        }
      }

      for (const row of stockVentasRes.data ?? []) {
        const key = `${row.producto_id}-${row.ubicacion_id}`;
        const existing = stockMap.get(key);
        if (existing) {
          existing.stock -= row.cantidad;
        }
      }

      setStockData(Array.from(stockMap.values()));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, selectedUbicaciones, selectedProductoId, searchNota]);

  const filteredVentas = useMemo(() => {
    let result = ventas;

    if (selectedUbicaciones.length > 0) {
      result = result.filter((v) =>
        selectedUbicaciones.includes(v.ubicacion_id),
      );
    }

    if (selectedProductoId !== "") {
      result = result.filter((v) => v.producto_id === selectedProductoId);
    }

    if (searchNota.trim()) {
      const term = searchNota.toLowerCase();
      result = result.filter((v) => v.nota?.toLowerCase().includes(term));
    }

    return result;
  }, [ventas, selectedUbicaciones, selectedProductoId, searchNota]);

  const totalPages = Math.ceil(filteredVentas.length / ITEMS_PER_PAGE);
  const paginatedVentas = filteredVentas.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const todayStart = getStartOfDay(new Date());
  const todayEnd = getEndOfDay(new Date());
  const todayVentas = ventas.filter(
    (v) => isInDateRange(v.created_at, todayStart, todayEnd),
  );

  const stats = useMemo(() => {
    const ventasHoy = todayVentas.length;
    const ingresosHoy = todayVentas.reduce(
      (sum, v) => sum + v.precio_unitario * v.cantidad,
      0,
    );
    const productosVendidosHoy = new Set(
      todayVentas.map((venta) => venta.producto_id),
    ).size;
    const unidadesEnStock = stockData.reduce(
      (sum, item) => sum + Math.max(0, item.stock),
      0,
    );
    return { ventasHoy, ingresosHoy, productosVendidosHoy, unidadesEnStock };
  }, [todayVentas, stockData]);

  const topProducts = useMemo(() => {
    const map = new Map<number, { unidades: number; ingresos: number }>();
    for (const v of filteredVentas) {
      const current = map.get(v.producto_id) ?? { unidades: 0, ingresos: 0 };
      current.unidades += v.cantidad;
      current.ingresos += v.precio_unitario * v.cantidad;
      map.set(v.producto_id, current);
    }

    return Array.from(map.entries())
      .map(([productoId, data]) => ({
        productoId,
        nombre:
          productos.find((p) => p.id === productoId)?.nombre ?? "Producto",
        fotoUrl: productos.find((p) => p.id === productoId)?.foto_url ?? null,
        ...data,
      }))
      .sort((a, b) => b.unidades - a.unidades || b.ingresos - a.ingresos);
  }, [filteredVentas, productos]);

  const salesByLocation = useMemo(() => {
    const map = new Map<number, number>();
    for (const v of filteredVentas) {
      const revenue = v.precio_unitario * v.cantidad;
      map.set(v.ubicacion_id, (map.get(v.ubicacion_id) ?? 0) + revenue);
    }
    return Array.from(map.entries())
      .map(([ubicacionId, revenue]) => ({
        ubicacionId,
        nombre:
          ubicaciones.find((u) => u.id === ubicacionId)?.nombre ??
          "Desconocida",
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredVentas, ubicaciones]);

  const maxProductUnits = Math.max(...topProducts.map((p) => p.unidades), 1);
  const maxLocationRevenue = Math.max(
    ...salesByLocation.map((p) => p.revenue),
    1,
  );

  const dailyTrend = useMemo(() => {
    const days: { date: Date; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = getStartOfDay(d);
      const dayEnd = getEndOfDay(d);
      const dayVentas = ventas.filter(
        (v) => isInDateRange(v.created_at, dayStart, dayEnd),
      );
      const revenue = dayVentas.reduce(
        (sum, v) => sum + v.precio_unitario * v.cantidad,
        0,
      );
      days.push({ date: d, revenue });
    }
    return days;
  }, [ventas]);

  const maxRevenue = Math.max(...dailyTrend.map((d) => d.revenue), 1);

  const paymentBreakdown = useMemo(() => {
    const efectivo = filteredVentas
      .filter((v) => normalizeMetodoPago(v.metodo_pago) === "efectivo")
      .reduce((sum, v) => sum + v.precio_unitario * v.cantidad, 0);
    const sinpe = filteredVentas
      .filter((v) => normalizeMetodoPago(v.metodo_pago) === "sinpe")
      .reduce((sum, v) => sum + v.precio_unitario * v.cantidad, 0);
    const transferencia = filteredVentas
      .filter((v) => normalizeMetodoPago(v.metodo_pago) === "transferencia")
      .reduce((sum, v) => sum + v.precio_unitario * v.cantidad, 0);
    return { efectivo, sinpe, transferencia };
  }, [filteredVentas]);

  const cierreResumen = useMemo(() => {
    const totalIngresos = filteredVentas.reduce(
      (sum, v) => sum + v.precio_unitario * v.cantidad,
      0,
    );
    const totalUnidades = filteredVentas.reduce(
      (sum, v) => sum + v.cantidad,
      0,
    );
    return {
      totalRegistros: filteredVentas.length,
      totalUnidades,
      totalIngresos,
    };
  }, [filteredVentas]);

  const getProductoName = (id: number) =>
    productos.find((p) => p.id === id)?.nombre ?? "—";

  const getProductoFoto = (id: number) =>
    productos.find((p) => p.id === id)?.foto_url ?? null;

  const getUbicacionName = (id: number) =>
    ubicaciones.find((u) => u.id === id)?.nombre ?? "—";

  const getDateRangeValues = () => ({
    startDate: dateRange.start.split("T")[0],
    endDate: dateRange.end.split("T")[0],
  });

  const formatDateRangeLabel = (): string => {
    const { startDate, endDate } = getDateRangeValues();
    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  };

  const getUbicacionFiltroName = (): string | undefined =>
    selectedUbicaciones.length === 1
      ? getUbicacionName(selectedUbicaciones[0])
      : undefined;

  const buildVentaReporteData = (): VentaCierreTienda[] =>
    filteredVentas.map((v) => ({
      id: v.id,
      created_at: v.created_at,
      producto_nombre: getProductoName(v.producto_id),
      ubicacion_nombre: getUbicacionName(v.ubicacion_id),
      cantidad: v.cantidad,
      precio_unitario: v.precio_unitario,
      costo_unitario: v.costo_unitario,
      metodo_pago: v.metodo_pago,
      nota: v.nota,
      vendido_por_email: user?.email ?? null,
    }));

  const toggleUbicacion = (id: number) => {
    setSelectedUbicaciones((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const getMetodoIcon = (metodo: string) => {
    switch (normalizeMetodoPago(metodo)) {
      case "efectivo":
        return <LiaMoneyBillWaveSolid className="size-4 text-green-600" />;
      case "sinpe":
        return <HiOutlineBanknotes className="size-4 text-blue-600" />;
      case "transferencia":
        return <RiBankLine className="size-4 text-purple-600" />;
      default:
        return null;
    }
  };

  const resetCierreDialog = () => {
    setCierreDialogOpen(false);
    setCierreNota("");
    setCierreFaltante("");
  };

  const handleOpenCierreDialog = () => {
    if (filteredVentas.length === 0) {
      alert("No hay ventas en el periodo seleccionado para registrar cierre.");
      return;
    }
    setCierreDialogOpen(true);
  };

  const handleExportPdf = async () => {
    if (!user) return;
    setGeneratingPdf(true);
    try {
      const reporteVentas = buildVentaReporteData();
      const { startDate, endDate } = getDateRangeValues();

      const url = await generateReporteVentas({
        ventas: reporteVentas,
        fechaInicio: startDate,
        fechaFin: endDate,
        ubicacionFiltro: getUbicacionFiltroName(),
      });

      window.open(url, "_blank");
    } catch (error) {
      console.error("Error generando reporte:", error);
      alert("Error al generar el reporte. Por favor intente de nuevo.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleRegistrarCierre = async () => {
    if (!user || filteredVentas.length === 0) return;

    const faltante = Number(cierreFaltante || 0);
    if (Number.isNaN(faltante) || faltante < 0) {
      alert("Ingrese un faltante válido.");
      return;
    }

    setGeneratingCierre(true);
    setCierreDialogOpen(false);

    const { startDate, endDate } = getDateRangeValues();
    const result = await generateCierreTienda({
      userId: user.id,
      userEmail: user.email || "Usuario",
      ventas: buildVentaReporteData(),
      fechaInicio: startDate,
      fechaFin: endDate,
      faltante,
      nota: cierreNota,
      ubicacionFiltro: getUbicacionFiltroName(),
    });

    if (result.success) {
      setCierreNota("");
      setCierreFaltante("");
      navigate("/admin/cierres", { state: { cierreCreated: true } });
    } else {
      alert(result.error || "Error al registrar el cierre de tienda.");
    }

    setGeneratingCierre(false);
  };

  const STAT_CARDS = [
    {
      label: "Ventas Hoy",
      value: stats.ventasHoy,
      format: (v: number) => v.toString(),
      color: "text-gray-900",
    },
    {
      label: "Ingresos Hoy",
      value: stats.ingresosHoy,
      format: formatCurrency,
      color: "text-gray-900",
    },
    {
      label: "Productos Vendidos Hoy",
      value: stats.productosVendidosHoy,
      format: (v: number) => v.toString(),
      color: "text-gray-900",
    },
    {
      label: "Unidades en Stock",
      value: stats.unidadesEnStock,
      format: (v: number) => v.toString(),
      color: "text-gray-900",
    },
  ];

  return (
    <AdminLayout title="Tienda">
      <div className="space-y-6 min-h-screen">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Panel de Ventas
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={generatingPdf || filteredVentas.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentArrowDownIcon className="size-4" />
              {generatingPdf ? "Generando..." : "Exportar PDF"}
            </button>
            <button
              type="button"
              onClick={handleOpenCierreDialog}
              disabled={generatingCierre || filteredVentas.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentTextIcon className="size-4" />
              Registrar Cierre
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
            >
              <PlusIcon className="size-4" />
              Registrar Venta
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((card) => (
            <div
              key={card.label}
              className="bg-white border rounded-lg shadow-sm p-4"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {card.label}
              </p>
              <p className={`mt-1 text-xl font-bold ${card.color}`}>
                {card.format(card.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "hoy", label: "Hoy" },
                { key: "ayer", label: "Ayer" },
                { key: "semana", label: "Esta Semana" },
                { key: "mes", label: "Este Mes" },
                { key: "custom", label: "Personalizado" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDateFilter(key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  dateFilter === key
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                />
              </div>
            </div>
          )}

          {/* Location pills */}
          <div className="flex flex-wrap gap-2">
            {ubicaciones.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleUbicacion(u.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedUbicaciones.includes(u.id)
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {u.nombre}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 max-w-xs">
              <select
                value={selectedProductoId}
                onChange={(e) =>
                  setSelectedProductoId(
                    e.target.value ? parseInt(e.target.value) : "",
                  )
                }
                className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              >
                <option value="">Todos los productos</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                type="text"
                value={searchNota}
                onChange={(e) => setSearchNota(e.target.value)}
                placeholder="Buscar por nota..."
                className="block w-full rounded-md bg-white border border-gray-300 pl-9 pr-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              />
            </div>
          </div>
        </div>

        {/* Sales List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        ) : filteredVentas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCartIcon className="mx-auto size-12 text-gray-300" />
            <p className="mt-2 text-sm">No se encontraron ventas</p>
          </div>
        ) : (
          <>
            <ol className="divide-y divide-gray-200 bg-white rounded-lg shadow-sm border">
              {paginatedVentas.map((venta) => {
                const productoNombre = getProductoName(venta.producto_id);
                const productoFoto = getProductoFoto(venta.producto_id);
                const ubicacionNombre = getUbicacionName(venta.ubicacion_id);
                const total = venta.precio_unitario * venta.cantidad;
                const inventoryStock = stockData.find(
                  (s) =>
                    s.producto_id === venta.producto_id &&
                    s.ubicacion_id === venta.ubicacion_id,
                );
                const isDiscounted =
                  inventoryStock != null &&
                  venta.precio_unitario < inventoryStock.precio_venta;
                const isExpanded = expandedVentaId === venta.id;

                return (
                  <li
                    key={venta.id}
                    className="px-4 py-5 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedVentaId(isExpanded ? null : venta.id)
                    }
                  >
                    <div className="flex items-center gap-4">
                      {productoFoto ? (
                        <img
                          src={productoFoto}
                          alt={productoNombre}
                          className="size-16 rounded-xl object-cover bg-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="size-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                          <CubeIcon className="size-7 text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-semibold text-gray-900 truncate">
                            {productoNombre}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {ubicacionNombre}
                          </span>
                          {isDiscounted && (
                            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                              Descuento
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span>
                            {venta.cantidad} ×{" "}
                            {formatCurrency(venta.precio_unitario)} ={" "}
                            <span className="font-medium text-gray-900">
                              {formatCurrency(total)}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            {getMetodoIcon(venta.metodo_pago)}
                            {formatMetodoPago(venta.metodo_pago)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(total)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDateES(venta.created_at)}
                        </p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pl-13 text-xs text-gray-600 space-y-1 border-t border-gray-100 pt-3">
                        <p>
                          <span className="font-medium">Vendido por:</span>{" "}
                          {venta.vendido_por || "—"}
                        </p>
                        {venta.nota && (
                          <p>
                            <span className="font-medium">Nota:</span>{" "}
                            {venta.nota}
                          </p>
                        )}
                        {venta.comprobante_url && (
                          <a
                            href={venta.comprobante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver comprobante
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="flex items-center justify-between border-t border-gray-200 px-4 sm:px-0">
                <div className="-mt-px flex w-0 flex-1">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className={`inline-flex items-center border-t-2 border-transparent pr-1 pt-4 text-sm font-medium ${
                      currentPage === 1
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    <ArrowLongLeftIcon
                      aria-hidden="true"
                      className={`mr-3 size-5 ${currentPage === 1 ? "text-gray-300" : "text-gray-400"}`}
                    />
                    Anterior
                  </button>
                </div>
                <div className="hidden md:-mt-px md:flex">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => {
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 &&
                          pageNum <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            aria-current={
                              pageNum === currentPage ? "page" : undefined
                            }
                            className={`inline-flex items-center border-t-2 px-4 pt-4 text-sm font-medium ${
                              pageNum === currentPage
                                ? "border-primary text-primary"
                                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 2 ||
                        pageNum === currentPage + 2
                      ) {
                        return (
                          <span
                            key={pageNum}
                            className="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-gray-500"
                          >
                            ...
                          </span>
                        );
                      }
                      return null;
                    },
                  )}
                </div>
                <div className="-mt-px flex w-0 flex-1 justify-end">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage >= totalPages}
                    className={`inline-flex items-center border-t-2 border-transparent pl-1 pt-4 text-sm font-medium ${
                      currentPage >= totalPages
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    Siguiente
                    <ArrowLongRightIcon
                      aria-hidden="true"
                      className={`ml-3 size-5 ${
                        currentPage >= totalPages
                          ? "text-gray-300"
                          : "text-gray-400"
                      }`}
                    />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}

        {/* Analytics Section */}
        {!loading && filteredVentas.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Best-selling products */}
            <div className="bg-white border rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Productos Más Vendidos
              </h3>
              <div className="space-y-3">
                {topProducts.slice(0, 6).map((producto, index) => (
                  <div key={producto.productoId} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      {producto.fotoUrl ? (
                        <img
                          src={producto.fotoUrl}
                          alt={producto.nombre}
                          className="size-10 rounded-lg object-cover bg-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="size-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <CubeIcon className="size-5 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-gray-900 truncate">
                            {index + 1}. {producto.nombre}
                          </span>
                          <span className="text-gray-700 shrink-0">
                            {producto.unidades} unidades
                          </span>
                        </div>
                        <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{
                              width: `${(producto.unidades / maxProductUnits) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="ml-[52px] text-xs text-gray-500">
                      Ingresos: {formatCurrency(producto.ingresos)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales by location */}
            <div className="bg-white border rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Ventas por Ubicación
              </h3>
              <div className="space-y-3">
                {salesByLocation.map(({ ubicacionId, nombre, revenue }) => (
                  <div key={ubicacionId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{nombre}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(revenue)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{
                          width: `${(revenue / maxLocationRevenue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Trend */}
            <div className="bg-white border rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Tendencia Últimos 7 Días
              </h3>
              <div className="space-y-3">
                {dailyTrend.map(({ date, revenue }) => (
                  <div key={date.toISOString()} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">
                        {formatShortDate(date)}
                      </span>
                      <span className="text-gray-900 font-medium">
                        {formatCurrency(revenue)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{
                          width: `${(revenue / maxRevenue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method Breakdown */}
            {canSeePaymentBreakdown && (
              <div className="bg-white border rounded-lg shadow-sm p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Desglose por Método de Pago
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 bg-green-50 rounded-lg p-3">
                    <LiaMoneyBillWaveSolid className="size-6 text-green-600 shrink-0" />
                    <div>
                      <p className="text-xs text-green-700 font-medium">
                        Efectivo
                      </p>
                      <p className="text-lg font-bold text-green-800">
                        {formatCurrency(paymentBreakdown.efectivo)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3">
                    <HiOutlineBanknotes className="size-6 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-xs text-blue-700 font-medium">SINPE</p>
                      <p className="text-lg font-bold text-blue-800">
                        {formatCurrency(paymentBreakdown.sinpe)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-purple-50 rounded-lg p-3">
                    <RiBankLine className="size-6 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-xs text-purple-700 font-medium">
                        Transferencia
                      </p>
                      <p className="text-lg font-bold text-purple-800">
                        {formatCurrency(paymentBreakdown.transferencia)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <VentaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        productos={productos}
        ubicaciones={ubicaciones}
        stockData={stockData}
        onSaved={fetchAll}
      />

      <Dialog
        open={cierreDialogOpen}
        onClose={() => setCierreDialogOpen(false)}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:opacity-0 data-closed:scale-95 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in max-w-md w-full"
            >
              <div className="bg-primary px-4 py-3 flex items-center gap-2">
                <DocumentTextIcon className="size-5 text-white" />
                <DialogTitle className="text-base font-semibold text-white">
                  Registrar Cierre de Tienda
                </DialogTitle>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Periodo:</span>
                    <span className="font-medium text-gray-900">
                      {formatDateRangeLabel()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Registros de venta:</span>
                    <span className="font-medium text-gray-900">
                      {cierreResumen.totalRegistros}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Unidades vendidas:</span>
                    <span className="font-medium text-gray-900">
                      {cierreResumen.totalUnidades}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                    <span className="font-semibold text-gray-900">
                      Total ingresos:
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(cierreResumen.totalIngresos)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="rounded-md bg-green-50 p-2">
                      <p className="font-medium text-green-700">Efectivo</p>
                      <p className="font-semibold text-green-800">
                        {formatCurrency(paymentBreakdown.efectivo)}
                      </p>
                    </div>
                    <div className="rounded-md bg-blue-50 p-2">
                      <p className="font-medium text-blue-700">SINPE</p>
                      <p className="font-semibold text-blue-800">
                        {formatCurrency(paymentBreakdown.sinpe)}
                      </p>
                    </div>
                    <div className="rounded-md bg-purple-50 p-2">
                      <p className="font-medium text-purple-700">
                        Transferencia
                      </p>
                      <p className="font-semibold text-purple-800">
                        {formatCurrency(paymentBreakdown.transferencia)}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Faltante reportado
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cierreFaltante}
                    onChange={(e) => setCierreFaltante(e.target.value)}
                    placeholder="0"
                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Ingrese cuánto falta en banco o caja para este cierre.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Nota (opcional)
                  </label>
                  <textarea
                    value={cierreNota}
                    onChange={(e) => setCierreNota(e.target.value)}
                    placeholder="Ej: falta comprobante, venta reportada después, dinero pendiente..."
                    rows={3}
                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-700 font-medium">
                    Se generará un PDF con las ventas filtradas, el faltante
                    reportado y la nota del cierre.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetCierreDialog}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRegistrarCierre}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                >
                  Registrar Cierre
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {generatingPdf && (
        <div className="fixed inset-0 z-100 bg-black/80 flex flex-col items-center justify-center">
          <img
            src="/tellos-square.svg"
            alt="Futbol Tello"
            className="w-16 h-16 animate-spin"
          />
          <p className="mt-4 text-white text-lg font-semibold">Futbol Tello</p>
          <p className="mt-2 text-white/70 text-sm">Generando reporte...</p>
        </div>
      )}

      {generatingCierre && (
        <div className="fixed inset-0 z-100 bg-black/80 flex flex-col items-center justify-center">
          <img
            src="/tellos-square.svg"
            alt="Futbol Tello"
            className="w-16 h-16 animate-spin"
          />
          <p className="mt-4 text-white text-lg font-semibold">Futbol Tello</p>
          <p className="mt-2 text-white/70 text-sm">Generando cierre...</p>
        </div>
      )}
    </AdminLayout>
  );
}
