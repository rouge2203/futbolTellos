import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../../components/admin/AdminLayout";
import VentaDrawer, {
  type VentaTransaccionEditable,
} from "../../../components/admin/tienda/VentaDrawer";
import ConfirmDialog from "../../../components/admin/tienda/ConfirmDialog";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import {
  generateCierreTienda,
  type VentaCierreTienda,
} from "./utils/generateCierreTienda";
import {
  ArrowLongLeftIcon,
  ArrowLongRightIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  PlusIcon,
  CubeIcon,
  ShoppingCartIcon,
} from "@heroicons/react/20/solid";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
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
  fecha_venta: string | null;
  transaccion_id: string | null;
  producto_id: number;
  ubicacion_id: number;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  metodo_pago: string;
  comprobante_url: string | null;
  nota: string | null;
  vendido_por: string | null;
  vendido_por_email: string | null;
}

interface StockInfo {
  producto_id: number;
  ubicacion_id: number;
  stock: number;
  precio_venta: number;
  costo_unitario: number;
}

interface VentaGroup {
  id: string;
  fecha: string;
  metodo_pago: string;
  comprobante_url: string | null;
  nota: string | null;
  vendido_por: string | null;
  vendido_por_email: string | null;
  ubicacion_id: number | null;
  total: number;
  lineas: Venta[];
}

type DateFilter = "hoy" | "ayer" | "semana" | "mes" | "custom";

const ITEMS_PER_PAGE = 15;

const formatCurrency = (value: number): string => `₡ ${value.toLocaleString()}`;

const PAYMENT_BREAKDOWN_ALLOWED_EMAILS = new Set([
  "agendakathia1974@gmail.com",
  "joseruizsuarez@hotmail.com",
]);

const CR_TIMEZONE_OFFSET = "-06:00";
const TIENDA_BUCKET = "tienda";

const getStoragePathFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/${TIENDA_BUCKET}/`;
    const markerIdx = parsed.pathname.indexOf(marker);
    if (markerIdx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIdx + marker.length));
  } catch {
    return null;
  }
};

const getStartOfDay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00${CR_TIMEZONE_OFFSET}`;
};

const getEndOfDay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T23:59:59${CR_TIMEZONE_OFFSET}`;
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

const getVentaDate = (venta: Venta): string => venta.fecha_venta ?? venta.created_at;
const getTransaccionId = (venta: Venta): string =>
  venta.transaccion_id ?? `legacy-${venta.id}`;

export default function TiendaDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [trendVentas, setTrendVentas] = useState<Venta[]>([]);
  const [stockData, setStockData] = useState<StockInfo[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTransaccion, setEditingTransaccion] =
    useState<VentaTransaccionEditable | null>(null);
  const [deletingTransaccionId, setDeletingTransaccionId] = useState<
    string | null
  >(null);
  const [ventaPendingDelete, setVentaPendingDelete] =
    useState<VentaGroup | null>(null);
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
  const [expandedTransaccionId, setExpandedTransaccionId] = useState<
    string | null
  >(null);
  const canSeePaymentBreakdown =
    PAYMENT_BREAKDOWN_ALLOWED_EMAILS.has(user?.email?.toLowerCase() ?? "");
  const customRangeInvalid =
    dateFilter === "custom" &&
    customStart.trim() !== "" &&
    customEnd.trim() !== "" &&
    customStart > customEnd;

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
        return {
          start: customStart
            ? `${customStart}T00:00:00${CR_TIMEZONE_OFFSET}`
            : getStartOfDay(now),
          end: customEnd
            ? `${customEnd}T23:59:59${CR_TIMEZONE_OFFSET}`
            : getEndOfDay(now),
        };
      }
    }
  }, [dateFilter, customStart, customEnd]);

  const fetchAll = useCallback(async () => {
    if (customRangeInvalid) {
      setVentas([]);
      setTrendVentas([]);
      setStockData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const trendStartDate = new Date();
      trendStartDate.setDate(trendStartDate.getDate() - 6);
      const trendStart = getStartOfDay(trendStartDate);
      const trendEnd = getEndOfDay(new Date());

      const [prodRes, ubRes, ventasRes, invRes, stockVentasRes, trendVentasRes] =
        await Promise.all([
          supabase.from("productos").select("*").eq("activo", true),
          supabase.from("ubicaciones").select("*").eq("activo", true),
          supabase
            .from("producto_ventas")
            .select("*")
            .gte("fecha_venta", dateRange.start)
            .lte("fecha_venta", dateRange.end)
            .order("fecha_venta", { ascending: false }),
          supabase
            .from("producto_inventario")
            .select(
              "producto_id, ubicacion_id, cantidad, precio_venta, costo_unitario, created_at",
            )
            .order("created_at", { ascending: false }),
          supabase.from("producto_ventas").select("producto_id, ubicacion_id, cantidad"),
          supabase
            .from("producto_ventas")
            .select("*")
            .gte("fecha_venta", trendStart)
            .lte("fecha_venta", trendEnd)
            .order("fecha_venta", { ascending: false }),
        ]);

      if (prodRes.error) throw prodRes.error;
      if (ubRes.error) throw ubRes.error;
      if (ventasRes.error) throw ventasRes.error;
      if (invRes.error) throw invRes.error;
      if (stockVentasRes.error) throw stockVentasRes.error;
      if (trendVentasRes.error) throw trendVentasRes.error;

      const activeProductos = (prodRes.data ?? []) as Producto[];
      const activeUbicaciones = (ubRes.data ?? []) as Ubicacion[];
      const activeProductoIds = new Set(activeProductos.map((p) => p.id));
      const activeUbicacionIds = new Set(activeUbicaciones.map((u) => u.id));

      setProductos(activeProductos);
      setUbicaciones(activeUbicaciones);
      setVentas((ventasRes.data ?? []) as Venta[]);
      setTrendVentas((trendVentasRes.data ?? []) as Venta[]);

      const invRows = invRes.data ?? [];
      const stockMap = new Map<string, StockInfo>();
      for (const row of invRows) {
        if (
          !activeProductoIds.has(row.producto_id) ||
          !activeUbicacionIds.has(row.ubicacion_id)
        ) {
          continue;
        }
        const key = `${row.producto_id}-${row.ubicacion_id}`;
        const existing = stockMap.get(key);
        if (existing) {
          existing.stock += row.cantidad;
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
        if (
          !activeProductoIds.has(row.producto_id) ||
          !activeUbicacionIds.has(row.ubicacion_id)
        ) {
          continue;
        }
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
  }, [dateRange, customRangeInvalid]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (dateFilter !== "custom" && (customStart || customEnd)) {
      setCustomStart("");
      setCustomEnd("");
    }
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, selectedUbicaciones, selectedProductoId, searchNota]);

  const filteredVentaRows = useMemo(() => {
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

  const groupedVentas = useMemo(() => {
    const groups = new Map<string, VentaGroup>();
    for (const venta of filteredVentaRows) {
      const transaccionId = getTransaccionId(venta);
      const fecha = getVentaDate(venta);
      const existing = groups.get(transaccionId);
      if (existing) {
        existing.total += venta.precio_unitario * venta.cantidad;
        existing.lineas.push(venta);
      } else {
        groups.set(transaccionId, {
          id: transaccionId,
          fecha,
          metodo_pago: venta.metodo_pago,
          comprobante_url: venta.comprobante_url,
          nota: venta.nota,
          vendido_por: venta.vendido_por,
          vendido_por_email: venta.vendido_por_email,
          ubicacion_id: venta.ubicacion_id,
          total: venta.precio_unitario * venta.cantidad,
          lineas: [venta],
        });
      }
    }
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );
  }, [filteredVentaRows]);

  const totalPages = Math.ceil(groupedVentas.length / ITEMS_PER_PAGE);
  const paginatedVentas = groupedVentas.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const todayStart = getStartOfDay(new Date());
  const todayEnd = getEndOfDay(new Date());
  const todayVentas = ventas.filter(
    (v) => isInDateRange(getVentaDate(v), todayStart, todayEnd),
  );

  const stats = useMemo(() => {
    const ventasHoy = new Set(todayVentas.map((v) => getTransaccionId(v))).size;
    const ingresosHoy = todayVentas.reduce(
      (sum, v) => sum + v.precio_unitario * v.cantidad,
      0,
    );
    const productosDistintosHoy = new Set(
      todayVentas.map((venta) => venta.producto_id),
    ).size;
    const unidadesEnStock = stockData.reduce(
      (sum, item) => sum + Math.max(0, item.stock),
      0,
    );
    return { ventasHoy, ingresosHoy, productosDistintosHoy, unidadesEnStock };
  }, [todayVentas, stockData]);

  const topProducts = useMemo(() => {
    const map = new Map<number, { unidades: number; ingresos: number }>();
    for (const v of filteredVentaRows) {
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
  }, [filteredVentaRows, productos]);

  const salesByLocation = useMemo(() => {
    const map = new Map<number, number>(ubicaciones.map((u) => [u.id, 0]));
    for (const v of filteredVentaRows) {
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
  }, [filteredVentaRows, ubicaciones]);

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
      const dayVentas = trendVentas.filter(
        (v) => isInDateRange(getVentaDate(v), dayStart, dayEnd),
      );
      const revenue = dayVentas.reduce(
        (sum, v) => sum + v.precio_unitario * v.cantidad,
        0,
      );
      days.push({ date: d, revenue });
    }
    return days;
  }, [trendVentas]);

  const maxRevenue = Math.max(...dailyTrend.map((d) => d.revenue), 1);

  const paymentBreakdown = useMemo(() => {
    const efectivo = filteredVentaRows
      .filter((v) => normalizeMetodoPago(v.metodo_pago) === "efectivo")
      .reduce((sum, v) => sum + v.precio_unitario * v.cantidad, 0);
    const sinpe = filteredVentaRows
      .filter((v) => normalizeMetodoPago(v.metodo_pago) === "sinpe")
      .reduce((sum, v) => sum + v.precio_unitario * v.cantidad, 0);
    const transferencia = filteredVentaRows
      .filter((v) => normalizeMetodoPago(v.metodo_pago) === "transferencia")
      .reduce((sum, v) => sum + v.precio_unitario * v.cantidad, 0);
    return { efectivo, sinpe, transferencia };
  }, [filteredVentaRows]);

  const cierreResumen = useMemo(() => {
    const totalIngresos = filteredVentaRows.reduce(
      (sum, v) => sum + v.precio_unitario * v.cantidad,
      0,
    );
    const totalUnidades = filteredVentaRows.reduce(
      (sum, v) => sum + v.cantidad,
      0,
    );
    return {
      totalRegistros: groupedVentas.length,
      totalUnidades,
      totalIngresos,
    };
  }, [filteredVentaRows, groupedVentas.length]);

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
    filteredVentaRows.map((v) => ({
      id: v.id,
      created_at: getVentaDate(v),
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
    if (customRangeInvalid) {
      alert("El rango personalizado no es válido.");
      return;
    }
    if (filteredVentaRows.length === 0) {
      alert("No hay ventas en el periodo seleccionado para registrar cierre.");
      return;
    }
    setCierreDialogOpen(true);
  };

  const handleRegistrarCierre = async () => {
    if (!user || filteredVentaRows.length === 0 || customRangeInvalid) return;

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

  const handleOpenNewVenta = () => {
    setEditingTransaccion(null);
    setDrawerOpen(true);
  };

  const handleEditVenta = (ventaGroup: VentaGroup) => {
    if (ventaGroup.id.startsWith("legacy-")) {
      alert(
        "Esta venta no tiene transacción agrupada aún. Ejecute la migración de tienda para habilitar su edición.",
      );
      return;
    }
    setEditingTransaccion({
      id: ventaGroup.id,
      fecha_venta: ventaGroup.fecha,
      metodo_pago: ventaGroup.metodo_pago,
      nota: ventaGroup.nota,
      comprobante_url: ventaGroup.comprobante_url,
      lines: ventaGroup.lineas.map((line) => ({
        producto_id: line.producto_id,
        ubicacion_id: line.ubicacion_id,
        cantidad: line.cantidad,
        precio_unitario: line.precio_unitario,
        costo_unitario: line.costo_unitario,
      })),
    });
    setDrawerOpen(true);
  };

  const handleDeleteVenta = (ventaGroup: VentaGroup) => {
    setVentaPendingDelete(ventaGroup);
  };

  const performDeleteVenta = async () => {
    const ventaGroup = ventaPendingDelete;
    if (!ventaGroup) return;
    setDeletingTransaccionId(ventaGroup.id);
    try {
      const isLegacy = ventaGroup.id.startsWith("legacy-");
      const comprobantes = Array.from(
        new Set(
          ventaGroup.lineas
            .map((line) => getStoragePathFromUrl(line.comprobante_url))
            .filter((path): path is string => Boolean(path)),
        ),
      );

      const deleteQuery = supabase.from("producto_ventas").delete();
      const { error } = isLegacy
        ? await deleteQuery.in(
            "id",
            ventaGroup.lineas.map((line) => line.id),
          )
        : await deleteQuery.eq("transaccion_id", ventaGroup.id);
      if (error) throw error;

      if (comprobantes.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(TIENDA_BUCKET)
          .remove(comprobantes);
        if (storageError) {
          console.error("Error deleting comprobantes:", storageError);
        }
      }

      if (expandedTransaccionId === ventaGroup.id) {
        setExpandedTransaccionId(null);
      }
      setVentaPendingDelete(null);
      await fetchAll();
    } catch (error: any) {
      console.error("Error deleting venta:", error);
      alert(error.message || "Error al eliminar la venta.");
    } finally {
      setDeletingTransaccionId(null);
    }
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
      label: "Productos Distintos Hoy",
      value: stats.productosDistintosHoy,
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
              onClick={handleOpenCierreDialog}
              disabled={
                generatingCierre ||
                filteredVentaRows.length === 0 ||
                customRangeInvalid
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentTextIcon className="size-4" />
              Registrar Cierre
            </button>
            <button
              type="button"
              onClick={handleOpenNewVenta}
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
            <div className="space-y-2">
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
              {customRangeInvalid && (
                <p className="text-xs text-red-600">
                  El rango personalizado no es válido: "Desde" debe ser menor o
                  igual que "Hasta".
                </p>
              )}
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
        ) : groupedVentas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCartIcon className="mx-auto size-12 text-gray-300" />
            <p className="mt-2 text-sm">No se encontraron ventas</p>
          </div>
        ) : (
          <>
            <ol className="divide-y divide-gray-200 bg-white rounded-lg shadow-sm border">
              {paginatedVentas.map((ventaGroup) => {
                const firstLine = ventaGroup.lineas[0];
                const productoNombre = firstLine
                  ? getProductoName(firstLine.producto_id)
                  : "Venta";
                const productoFoto = firstLine
                  ? getProductoFoto(firstLine.producto_id)
                  : null;
                const ubicacionNombre =
                  ventaGroup.ubicacion_id != null
                    ? getUbicacionName(ventaGroup.ubicacion_id)
                    : "Múltiples";
                const hasDiscount = ventaGroup.lineas.some((line) => {
                  const sugerido = productos.find(
                    (p) => p.id === line.producto_id,
                  )?.precio_sugerido;
                  return sugerido != null && line.precio_unitario < sugerido;
                });
                const isExpanded = expandedTransaccionId === ventaGroup.id;
                const isDeleting = deletingTransaccionId === ventaGroup.id;

                return (
                  <li
                    key={ventaGroup.id}
                    className="px-4 py-5 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedTransaccionId(isExpanded ? null : ventaGroup.id)
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
                            {ventaGroup.lineas.length > 1 &&
                              ` +${ventaGroup.lineas.length - 1} producto(s)`}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {ubicacionNombre}
                          </span>
                          {hasDiscount && (
                            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                              Descuento
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span>{ventaGroup.lineas.length} línea(s)</span>
                          <span className="flex items-center gap-1">
                            {getMetodoIcon(ventaGroup.metodo_pago)}
                            {formatMetodoPago(ventaGroup.metodo_pago)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(ventaGroup.total)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDateES(ventaGroup.fecha)}
                        </p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        className="mt-3 text-xs text-gray-600 space-y-2 border-t border-gray-100 pt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-1">
                          {ventaGroup.lineas.map((line) => {
                            const lineTotal = line.precio_unitario * line.cantidad;
                            return (
                              <p key={line.id}>
                                <span className="font-medium">
                                  {getProductoName(line.producto_id)}:
                                </span>{" "}
                                {line.cantidad} × {formatCurrency(line.precio_unitario)} ={" "}
                                <span className="font-semibold text-gray-900">
                                  {formatCurrency(lineTotal)}
                                </span>
                              </p>
                            );
                          })}
                        </div>
                        <p>
                          <span className="font-medium">Vendido por:</span>{" "}
                          {ventaGroup.vendido_por_email ||
                            ventaGroup.vendido_por ||
                            "—"}
                        </p>
                        {ventaGroup.nota && (
                          <p>
                            <span className="font-medium">Nota:</span>{" "}
                            {ventaGroup.nota}
                          </p>
                        )}
                        {ventaGroup.comprobante_url && (
                          <a
                            href={ventaGroup.comprobante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-block"
                          >
                            Ver comprobante
                          </a>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleEditVenta(ventaGroup)}
                            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                          >
                            <PencilSquareIcon className="size-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVenta(ventaGroup)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100 disabled:opacity-60"
                          >
                            <TrashIcon className="size-3.5" />
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
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
        {!loading && filteredVentaRows.length > 0 && (
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
        onClose={() => {
          setDrawerOpen(false);
          setEditingTransaccion(null);
        }}
        productos={productos}
        ubicaciones={ubicaciones}
        stockData={stockData}
        ventaTransaccion={editingTransaccion}
        onSaved={async () => {
          await fetchAll();
          setEditingTransaccion(null);
        }}
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
                    placeholder="0 (ningún faltante)"
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

      <ConfirmDialog
        open={ventaPendingDelete !== null}
        title="Eliminar venta"
        description="¿Desea eliminar esta venta? Esta acción no se puede deshacer."
        details={
          ventaPendingDelete ? (
            <div className="space-y-1">
              <div>
                <strong>Líneas:</strong> {ventaPendingDelete.lineas.length}
              </div>
              <div>
                <strong>Total:</strong> {formatCurrency(ventaPendingDelete.total)}
              </div>
              <div>
                <strong>Método de pago:</strong> {ventaPendingDelete.metodo_pago}
              </div>
              {ventaPendingDelete.comprobante_url && (
                <div className="text-xs text-gray-500">
                  El comprobante asociado también será eliminado del almacenamiento.
                </div>
              )}
            </div>
          ) : null
        }
        confirmLabel={
          deletingTransaccionId !== null ? "Eliminando..." : "Eliminar"
        }
        tone="danger"
        loading={deletingTransaccionId !== null}
        onConfirm={performDeleteVenta}
        onCancel={() => {
          if (deletingTransaccionId === null) setVentaPendingDelete(null);
        }}
      />
    </AdminLayout>
  );
}
