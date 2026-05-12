import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { CubeIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import ConfirmDialog from "./ConfirmDialog";
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

interface StockInfo {
  producto_id: number;
  ubicacion_id: number;
  stock: number;
  precio_venta: number;
  costo_unitario: number;
}

interface VentaEditableLine {
  producto_id: number;
  ubicacion_id: number;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
}

export interface VentaTransaccionEditable {
  id: string;
  fecha_venta: string;
  metodo_pago: string;
  nota: string | null;
  comprobante_url: string | null;
  lines: VentaEditableLine[];
}

interface VentaDrawerProps {
  open: boolean;
  onClose: () => void;
  productos: Producto[];
  ubicaciones: Ubicacion[];
  stockData: StockInfo[];
  onSaved: () => Promise<void>;
  ventaTransaccion?: VentaTransaccionEditable | null;
}

interface CartLine {
  key: string;
  productoId: number;
  cantidad: string;
  precio: string;
}

type MetodoPago = "efectivo" | "sinpe" | "transferencia";

const TIENDA_BUCKET = "tienda";
const CR_TIMEZONE_OFFSET = "-06:00";

const METODO_PAGO_OPTIONS: {
  value: MetodoPago;
  label: string;
  icon: typeof LiaMoneyBillWaveSolid;
}[] = [
  { value: "efectivo", label: "Efectivo", icon: LiaMoneyBillWaveSolid },
  { value: "sinpe", label: "SINPE", icon: HiOutlineBanknotes },
  { value: "transferencia", label: "Transferencia", icon: RiBankLine },
];

const toDatetimeLocalValue = (value?: string): string => {
  const source = value ? new Date(value) : new Date();
  const utcMs = source.getTime() + source.getTimezoneOffset() * 60000;
  const crDate = new Date(utcMs - 6 * 60 * 60 * 1000);
  const year = crDate.getFullYear();
  const month = String(crDate.getMonth() + 1).padStart(2, "0");
  const day = String(crDate.getDate()).padStart(2, "0");
  const hour = String(crDate.getHours()).padStart(2, "0");
  const minute = String(crDate.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const toIsoFromDatetimeLocal = (value: string): string => {
  if (!value) return `${toDatetimeLocalValue()}:00${CR_TIMEZONE_OFFSET}`;
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}${CR_TIMEZONE_OFFSET}`;
};

const getStoragePathFromUrl = (
  url: string | null | undefined,
): string | null => {
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

export default function VentaDrawer({
  open,
  onClose,
  productos,
  ubicaciones,
  stockData,
  onSaved,
  ventaTransaccion = null,
}: VentaDrawerProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ubicacionId, setUbicacionId] = useState<number | "">("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [nota, setNota] = useState("");
  const [fechaVenta, setFechaVenta] = useState(toDatetimeLocalValue());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingComprobanteUrl, setExistingComprobanteUrl] = useState<
    string | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const isEdit = ventaTransaccion !== null;

  const activeUbicaciones = useMemo(
    () => ubicaciones.filter((u) => u.activo),
    [ubicaciones],
  );

  const originalLineQtyByProduct = useMemo(() => {
    const map = new Map<number, number>();
    if (!isEdit || !ventaTransaccion) return map;
    for (const row of ventaTransaccion.lines) {
      map.set(row.producto_id, (map.get(row.producto_id) ?? 0) + row.cantidad);
    }
    return map;
  }, [isEdit, ventaTransaccion]);

  useEffect(() => {
    if (!open) {
      setUbicacionId("");
      setLines([]);
      setMetodoPago("efectivo");
      setNota("");
      setFechaVenta(toDatetimeLocalValue());
      setSelectedFile(null);
      setExistingComprobanteUrl(null);
      return;
    }

    if (ventaTransaccion) {
      const first = ventaTransaccion.lines[0];
      const baseUbicacionId = first?.ubicacion_id ?? "";
      setUbicacionId(baseUbicacionId);
      setLines(
        ventaTransaccion.lines.map((line) => ({
          key: crypto.randomUUID(),
          productoId: line.producto_id,
          cantidad: String(line.cantidad),
          precio: String(line.precio_unitario),
        })),
      );
      const method = ventaTransaccion.metodo_pago.toLowerCase();
      if (method === "sinpe" || method === "transferencia") {
        setMetodoPago(method);
      } else {
        setMetodoPago("efectivo");
      }
      setNota(ventaTransaccion.nota ?? "");
      setFechaVenta(toDatetimeLocalValue(ventaTransaccion.fecha_venta));
      setSelectedFile(null);
      setExistingComprobanteUrl(ventaTransaccion.comprobante_url ?? null);
      return;
    }

    setUbicacionId("");
    setLines([]);
    setMetodoPago("efectivo");
    setNota("");
    setFechaVenta(toDatetimeLocalValue());
    setSelectedFile(null);
    setExistingComprobanteUrl(null);
  }, [open, ventaTransaccion]);

  const getStockInfo = (productoId: number) => {
    if (ubicacionId === "") return null;
    return (
      stockData.find(
        (s) => s.producto_id === productoId && s.ubicacion_id === ubicacionId,
      ) ?? null
    );
  };

  const getEffectiveStock = (productoId: number) => {
    const baseStock = getStockInfo(productoId)?.stock ?? 0;
    const originalQty = originalLineQtyByProduct.get(productoId) ?? 0;
    return baseStock + originalQty;
  };

  const getReservedQty = (productoId: number, excludeKey?: string) =>
    lines.reduce((sum, line) => {
      if (line.productoId !== productoId) return sum;
      if (excludeKey && line.key === excludeKey) return sum;
      return sum + (parseInt(line.cantidad) || 0);
    }, 0);

  const getRemainingStock = (productoId: number, excludeKey?: string) =>
    Math.max(
      0,
      getEffectiveStock(productoId) - getReservedQty(productoId, excludeKey),
    );

  const productosDisponibles = useMemo(() => {
    if (ubicacionId === "") return [];
    return productos
      .filter((p) => p.activo)
      .map((producto) => ({
        producto,
        stock: getEffectiveStock(producto.id),
        remaining: getRemainingStock(producto.id),
      }))
      .filter(({ stock }) => stock > 0);
  }, [productos, ubicacionId, lines, stockData, originalLineQtyByProduct]);

  const hasExceededStock = useMemo(
    () =>
      lines.some((line) => {
        const cantidadNum = parseInt(line.cantidad) || 0;
        const maxForLine = getRemainingStock(line.productoId, line.key);
        return cantidadNum > maxForLine;
      }),
    [lines, stockData, originalLineQtyByProduct],
  );

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const cantidadNum = parseInt(line.cantidad) || 0;
        const precioNum = parseInt(line.precio) || 0;
        return sum + cantidadNum * precioNum;
      }, 0),
    [lines],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Seleccione un comprobante válido (JPEG, PNG, GIF, WEBP o PDF).");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("El archivo es muy grande. El tamaño máximo es 20MB.");
      return;
    }

    setSelectedFile(file);
  };

  const uploadComprobante = async (
    file: File,
  ): Promise<{ publicUrl: string; path: string }> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `venta_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(TIENDA_BUCKET)
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(TIENDA_BUCKET)
      .getPublicUrl(fileName);

    return { publicUrl: urlData.publicUrl, path: fileName };
  };

  const removeStoragePath = async (path: string | null) => {
    if (!path) return;
    const { error } = await supabase.storage.from(TIENDA_BUCKET).remove([path]);
    if (error) {
      console.error("Error deleting file from storage:", error);
    }
  };

  const addProductToCart = (productoId: number) => {
    if (ubicacionId === "") {
      alert("Seleccione una ubicación primero.");
      return;
    }

    setLines((prev) => {
      const getReservedWithPrev = (
        targetProductoId: number,
        excludeKey?: string,
      ) =>
        prev.reduce((sum, line) => {
          if (line.productoId !== targetProductoId) return sum;
          if (excludeKey && line.key === excludeKey) return sum;
          return sum + (parseInt(line.cantidad) || 0);
        }, 0);

      const getRemainingWithPrev = (
        targetProductoId: number,
        excludeKey?: string,
      ) =>
        Math.max(
          0,
          getEffectiveStock(targetProductoId) -
            getReservedWithPrev(targetProductoId, excludeKey),
        );

      const existing = prev.find((line) => line.productoId === productoId);
      if (existing) {
        const maxForLine = getRemainingWithPrev(productoId, existing.key);
        const currentQty = parseInt(existing.cantidad) || 0;
        if (currentQty >= maxForLine) return prev;
        return prev.map((line) =>
          line.key === existing.key
            ? { ...line, cantidad: String(currentQty + 1) }
            : line,
        );
      }

      const remaining = getRemainingWithPrev(productoId);
      if (remaining <= 0) return prev;
      const stock = getStockInfo(productoId);
      const fallbackPrice =
        stock?.precio_venta ??
        productos.find((p) => p.id === productoId)?.precio_sugerido ??
        0;
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          productoId,
          cantidad: "1",
          precio: String(fallbackPrice),
        },
      ];
    });
  };

  const updateLine = (
    lineKey: string,
    field: "cantidad" | "precio",
    value: string,
  ) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === lineKey ? { ...line, [field]: value } : line,
      ),
    );
  };

  const removeLine = (lineKey: string) => {
    setLines((prev) => prev.filter((line) => line.key !== lineKey));
  };

  const buildNormalizedLines = () => {
    if (ubicacionId === "") {
      throw new Error("Seleccione una ubicación.");
    }
    return lines.map((line, index) => {
      const cantidadNum = parseInt(line.cantidad) || 0;
      const precioNum = parseInt(line.precio) || 0;
      const maxForLine = getRemainingStock(line.productoId, line.key);
      if (cantidadNum <= 0 || cantidadNum > maxForLine) {
        throw new Error(
          `Cantidad inválida en la línea ${index + 1}. Máximo permitido: ${maxForLine}.`,
        );
      }
      if (precioNum <= 0) {
        throw new Error(
          `El precio unitario debe ser mayor que 0 en la línea ${index + 1}.`,
        );
      }
      const stock = getStockInfo(line.productoId);
      return {
        producto_id: line.productoId,
        ubicacion_id: ubicacionId as number,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
        costo_unitario: stock?.costo_unitario ?? 0,
      };
    });
  };

  const handleSave = () => {
    if (!user) {
      alert("No se pudo identificar al usuario.");
      return;
    }
    if (ubicacionId === "") {
      alert("Seleccione una ubicación.");
      return;
    }
    if (lines.length === 0) {
      alert("Agregue al menos un producto al carrito.");
      return;
    }

    try {
      buildNormalizedLines();
    } catch (error: any) {
      alert(error.message || "Datos inválidos.");
      return;
    }

    if (metodoPago !== "efectivo" && !selectedFile && !existingComprobanteUrl) {
      alert("Debe adjuntar un comprobante para SINPE o transferencia.");
      return;
    }

    setConfirmSaveOpen(true);
  };

  const performSave = async () => {
    if (!user) return;
    let normalizedLines: ReturnType<typeof buildNormalizedLines>;
    try {
      normalizedLines = buildNormalizedLines();
    } catch (error: any) {
      alert(error.message || "Datos inválidos.");
      setConfirmSaveOpen(false);
      return;
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    let deletedPreviousRows = false;

    try {
      let comprobanteUrl = existingComprobanteUrl;
      if (selectedFile) {
        setUploading(true);
        const uploaded = await uploadComprobante(selectedFile);
        comprobanteUrl = uploaded.publicUrl;
        uploadedPath = uploaded.path;
      }

      const transaccionId = ventaTransaccion?.id ?? crypto.randomUUID();
      const fechaVentaIso = toIsoFromDatetimeLocal(fechaVenta);

      if (ventaTransaccion) {
        const { error: deleteError } = await supabase
          .from("producto_ventas")
          .delete()
          .eq("transaccion_id", transaccionId);
        if (deleteError) throw deleteError;
        deletedPreviousRows = true;
      }

      const rows = normalizedLines.map((line) => ({
        ...line,
        metodo_pago: metodoPago.toLowerCase(),
        comprobante_url: comprobanteUrl,
        nota: nota.trim() || null,
        vendido_por: user.id,
        vendido_por_email: user.email ?? null,
        transaccion_id: transaccionId,
        fecha_venta: fechaVentaIso,
      }));

      const { error: insertError } = await supabase
        .from("producto_ventas")
        .insert(rows);
      if (insertError) throw insertError;

      if (
        existingComprobanteUrl &&
        selectedFile &&
        comprobanteUrl !== existingComprobanteUrl
      ) {
        await removeStoragePath(getStoragePathFromUrl(existingComprobanteUrl));
      }

      setConfirmSaveOpen(false);
      await onSaved();
      onClose();
    } catch (error: any) {
      if (uploadedPath) {
        await removeStoragePath(uploadedPath);
      }
      console.error("Error registrando venta:", error);
      if (deletedPreviousRows) {
        alert(
          "La edición falló después de borrar la venta anterior. Recargue e intente nuevamente.",
        );
      } else {
        alert(error.message || "Error al registrar la venta.");
      }
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const canSave =
    ubicacionId !== "" &&
    lines.length > 0 &&
    lines.every((line) => (parseInt(line.cantidad) || 0) > 0) &&
    lines.every((line) => (parseInt(line.precio) || 0) > 0) &&
    !hasExceededStock;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />

      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <DialogPanel
              transition
              className="pointer-events-auto w-screen max-w-4xl transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
            >
              <div className="relative flex h-full flex-col divide-y divide-gray-200 bg-white shadow-xl">
                <div className="h-0 flex-1 overflow-y-auto">
                  <div className="bg-primary px-4 py-6 sm:px-6">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-base font-semibold text-white">
                        {isEdit ? "Editar Venta" : "Registrar Venta"}
                      </DialogTitle>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          onClick={onClose}
                          className="relative rounded-md text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                          <span className="absolute -inset-2.5" />
                          <span className="sr-only">Cerrar panel</span>
                          <XMarkIcon aria-hidden="true" className="size-6" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200 px-4 sm:px-6">
                    <div className="space-y-5 pt-6 pb-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Ubicación
                          </label>
                          <select
                            value={ubicacionId}
                            onChange={(e) => {
                              const nextValue = e.target.value
                                ? parseInt(e.target.value)
                                : "";
                              setUbicacionId(nextValue);
                              if (!isEdit) {
                                setLines([]);
                              }
                            }}
                            disabled={isEdit}
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">Seleccionar ubicación...</option>
                            {activeUbicaciones.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Fecha de venta
                          </label>
                          <input
                            type="datetime-local"
                            value={fechaVenta}
                            onChange={(e) => setFechaVenta(e.target.value)}
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>
                      </div>

                      {ubicacionId === "" ? (
                        <p className="text-sm text-gray-500">
                          Seleccione una ubicación para agregar productos.
                        </p>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                              Productos disponibles
                            </label>
                            {productosDisponibles.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">
                                No hay productos con stock disponible.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {productosDisponibles.map(
                                  ({ producto, stock, remaining }) => (
                                    <button
                                      key={producto.id}
                                      type="button"
                                      onClick={() =>
                                        addProductToCart(producto.id)
                                      }
                                      disabled={remaining <= 0}
                                      className={`rounded-lg border p-2 text-left transition-colors ${
                                        remaining <= 0
                                          ? "bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed"
                                          : "bg-white hover:border-primary/60 hover:bg-primary/5"
                                      }`}
                                    >
                                      {producto.foto_url ? (
                                        <img
                                          src={producto.foto_url}
                                          alt={producto.nombre}
                                          className="aspect-square w-full object-cover rounded-md bg-gray-100"
                                        />
                                      ) : (
                                        <div className="aspect-square w-full rounded-md bg-gray-100 flex items-center justify-center">
                                          <CubeIcon className="size-10 text-gray-400" />
                                        </div>
                                      )}
                                      <p className="mt-2 text-xs font-medium text-gray-900 line-clamp-2">
                                        {producto.nombre}
                                      </p>
                                      <p className="mt-0.5 text-xs text-gray-600">
                                        Stock: {stock}
                                      </p>
                                      <p className="text-xs text-primary">
                                        Disponible para agregar: {remaining}
                                      </p>
                                    </button>
                                  ),
                                )}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-gray-900">
                                Carrito
                              </h3>
                              <span className="text-xs text-gray-500">
                                {lines.length} producto(s)
                              </span>
                            </div>
                            {lines.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">
                                Agregue productos al carrito clickeando en las
                                imágenes.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {lines.map((line, index) => {
                                  const producto = productos.find(
                                    (p) => p.id === line.productoId,
                                  );
                                  const maxForLine = getRemainingStock(
                                    line.productoId,
                                    line.key,
                                  );
                                  const cantidadNum =
                                    parseInt(line.cantidad) || 0;
                                  const precioNum = parseInt(line.precio) || 0;
                                  const lineTotal = cantidadNum * precioNum;
                                  return (
                                    <div
                                      key={line.key}
                                      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                                    >
                                      <div className="flex gap-3 items-center">
                                        {producto?.foto_url ? (
                                          <img
                                            src={producto.foto_url}
                                            alt={producto.nombre}
                                            className="size-12 rounded-md object-cover bg-gray-100 shrink-0"
                                          />
                                        ) : (
                                          <div className="size-12 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                                            <CubeIcon className="size-7 text-gray-400" />
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium text-gray-900">
                                            {index + 1}.{" "}
                                            {producto?.nombre ?? "Producto"}
                                          </p>
                                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <label className="text-xs text-gray-600">
                                              Cantidad
                                              <input
                                                type="number"
                                                min="1"
                                                max={maxForLine}
                                                value={line.cantidad}
                                                onChange={(e) =>
                                                  updateLine(
                                                    line.key,
                                                    "cantidad",
                                                    e.target.value,
                                                  )
                                                }
                                                className="mt-1 block w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-base text-gray-900 sm:text-sm"
                                              />
                                            </label>
                                            <label className="text-xs text-gray-600">
                                              Precio unitario (₡)
                                              <input
                                                type="number"
                                                min="1"
                                                value={line.precio}
                                                onChange={(e) =>
                                                  updateLine(
                                                    line.key,
                                                    "precio",
                                                    e.target.value,
                                                  )
                                                }
                                                className="mt-1 block w-full rounded-md bg-white border border-gray-300 px-2 py-1 text-base text-gray-900 sm:text-sm"
                                              />
                                            </label>
                                          </div>
                                          {cantidadNum > maxForLine && (
                                            <p className="mt-1 text-xs text-red-600">
                                              Máximo permitido: {maxForLine}
                                            </p>
                                          )}
                                          <p className="mt-1 text-xs text-gray-600">
                                            Total línea: ₡{" "}
                                            {lineTotal.toLocaleString("es-CR")}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeLine(line.key)}
                                          className="rounded-md p-1 text-red-600 hover:bg-red-50"
                                        >
                                          <TrashIcon className="size-5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Método de pago
                        </label>
                        <div className="flex gap-2">
                          {METODO_PAGO_OPTIONS.map(
                            ({ value, label, icon: Icon }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setMetodoPago(value)}
                                className={`flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                  metodoPago === value
                                    ? "bg-primary text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                              >
                                <Icon className="size-4" />
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Comprobante{" "}
                          {metodoPago !== "efectivo"
                            ? "(requerido)"
                            : "(opcional)"}
                        </label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileSelect}
                          className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                        {selectedFile && (
                          <p className="mt-1 text-xs text-green-600">
                            Archivo seleccionado: {selectedFile.name}
                          </p>
                        )}
                        {!selectedFile && existingComprobanteUrl && (
                          <a
                            href={existingComprobanteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs text-primary hover:underline"
                          >
                            Ver comprobante actual
                          </a>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Nota (opcional)
                        </label>
                        <textarea
                          value={nota}
                          onChange={(e) => setNota(e.target.value)}
                          rows={2}
                          placeholder="Notas adicionales..."
                          className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                        />
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                          Resumen
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Productos</span>
                            <span className="font-medium text-gray-900">
                              {lines.length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Monto total</span>
                            <span className="font-semibold text-gray-900">
                              ₡ {total.toLocaleString("es-CR")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 justify-end gap-3 px-4 py-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !canSave}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {saving
                      ? "Guardando..."
                      : isEdit
                        ? "Guardar cambios"
                        : "Registrar Venta"}
                  </button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="fixed inset-0 z-100 bg-black/80 flex flex-col items-center justify-center">
          <img
            src="/tellos-square.svg"
            alt="Futbol Tello"
            className="w-16 h-16 animate-spin"
          />
          <p className="mt-4 text-white text-lg font-semibold">Futbol Tello</p>
          <p className="mt-2 text-white/70 text-sm">Subiendo comprobante...</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmSaveOpen}
        title={isEdit ? "Confirmar cambios de venta" : "Confirmar venta"}
        description={
          isEdit
            ? "¿Desea guardar los cambios de esta venta? La venta anterior será reemplazada."
            : "¿Desea registrar esta venta? Verifique los detalles antes de confirmar."
        }
        details={
          <div className="space-y-1">
            <div>
              <strong>Líneas:</strong> {lines.length}
            </div>
            <div>
              <strong>Total:</strong> ₡ {total.toLocaleString("es-CR")}
            </div>
            <div>
              <strong>Método de pago:</strong> {metodoPago}
            </div>
            {metodoPago !== "efectivo" &&
              (selectedFile || existingComprobanteUrl) && (
                <div className="text-xs text-gray-500">
                  Se asociará un comprobante a esta venta.
                </div>
              )}
          </div>
        }
        confirmLabel={
          saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar"
        }
        tone="primary"
        loading={saving}
        onConfirm={performSave}
        onCancel={() => {
          if (!saving) setConfirmSaveOpen(false);
        }}
      />
    </Dialog>
  );
}
