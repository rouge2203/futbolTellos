import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
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

interface VentaDrawerProps {
  open: boolean;
  onClose: () => void;
  productos: Producto[];
  ubicaciones: Ubicacion[];
  stockData: StockInfo[];
  onSaved: () => Promise<void>;
}

type MetodoPago = "efectivo" | "sinpe" | "transferencia";

const METODO_PAGO_OPTIONS: { value: MetodoPago; label: string; icon: typeof LiaMoneyBillWaveSolid }[] = [
  { value: "efectivo", label: "Efectivo", icon: LiaMoneyBillWaveSolid },
  { value: "sinpe", label: "SINPE", icon: HiOutlineBanknotes },
  { value: "transferencia", label: "Transferencia", icon: RiBankLine },
];

export default function VentaDrawer({
  open,
  onClose,
  productos,
  ubicaciones,
  stockData,
  onSaved,
}: VentaDrawerProps) {
  const { user } = useAuth();
  const [ubicacionId, setUbicacionId] = useState<number | "">("");
  const [productoId, setProductoId] = useState<number | "">("");
  const [cantidad, setCantidad] = useState<string>("");
  const [precioUnitario, setPrecioUnitario] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [nota, setNota] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setUbicacionId("");
      setProductoId("");
      setCantidad("");
      setPrecioUnitario("");
      setMetodoPago("efectivo");
      setNota("");
      setSelectedFile(null);
    }
  }, [open]);

  const activeUbicaciones = ubicaciones.filter((u) => u.activo);

  const productsAtLocation = ubicacionId !== ""
    ? productos.filter((p) => {
        const info = stockData.find(
          (s) => s.producto_id === p.id && s.ubicacion_id === ubicacionId
        );
        return info && info.stock > 0;
      })
    : [];

  const selectedStock =
    productoId !== "" && ubicacionId !== ""
      ? stockData.find(
          (s) => s.producto_id === productoId && s.ubicacion_id === ubicacionId
        )
      : null;

  useEffect(() => {
    if (selectedStock) {
      setPrecioUnitario(String(selectedStock.precio_venta));
    } else {
      setPrecioUnitario("");
    }
  }, [productoId, ubicacionId, selectedStock]);

  useEffect(() => {
    setProductoId("");
    setCantidad("");
    setPrecioUnitario("");
  }, [ubicacionId]);

  const cantidadNum = parseInt(cantidad) || 0;
  const precioNum = parseInt(precioUnitario) || 0;
  const costoNum = selectedStock?.costo_unitario ?? 0;
  const total = precioNum * cantidadNum;
  const maxStock = selectedStock?.stock ?? 0;
  const isDiscounted =
    selectedStock != null && precioNum !== selectedStock.precio_venta && precioNum > 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Por favor seleccione una imagen válida (JPEG, PNG, GIF, WEBP)");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("El archivo es muy grande. El tamaño máximo es 20MB.");
      return;
    }

    setSelectedFile(file);
  };

  const uploadComprobante = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `venta_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("tienda")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("tienda")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!ubicacionId || !productoId || !cantidad || !precioUnitario) {
      alert("Por favor complete todos los campos requeridos.");
      return;
    }

    if (cantidadNum <= 0 || cantidadNum > maxStock) {
      alert(`La cantidad debe ser entre 1 y ${maxStock}.`);
      return;
    }

    if (!user) {
      alert("No se pudo identificar al usuario.");
      return;
    }

    setSaving(true);
    if (selectedFile) setUploading(true);

    try {
      let comprobanteUrl: string | null = null;

      if (selectedFile) {
        comprobanteUrl = await uploadComprobante(selectedFile);
      }

      const { error } = await supabase.from("producto_ventas").insert({
        producto_id: productoId,
        ubicacion_id: ubicacionId,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
        costo_unitario: costoNum,
        metodo_pago: metodoPago,
        comprobante_url: comprobanteUrl,
        nota: nota.trim() || null,
        vendido_por: user.id,
      });

      if (error) throw error;

      await onSaved();
      onClose();
    } catch (error) {
      console.error("Error registrando venta:", error);
      alert("Error al registrar la venta. Por favor intente de nuevo.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const canSave =
    ubicacionId !== "" &&
    productoId !== "" &&
    cantidadNum > 0 &&
    cantidadNum <= maxStock &&
    precioNum > 0;

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
              className="pointer-events-auto w-screen max-w-2xl transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
            >
              <div className="relative flex h-full flex-col divide-y divide-gray-200 bg-white shadow-xl">
                <div className="h-0 flex-1 overflow-y-auto">
                  <div className="bg-primary px-4 py-6 sm:px-6">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-base font-semibold text-white">
                        Registrar Venta
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

                  <div className="flex flex-1 flex-col justify-between">
                    <div className="divide-y divide-gray-200 px-4 sm:px-6">
                      <div className="space-y-5 pt-6 pb-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Ubicación
                          </label>
                          <select
                            value={ubicacionId}
                            onChange={(e) =>
                              setUbicacionId(
                                e.target.value ? parseInt(e.target.value) : ""
                              )
                            }
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          >
                            <option value="">Seleccionar ubicación...</option>
                            {activeUbicaciones.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        {ubicacionId !== "" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-900 mb-1">
                                Producto
                              </label>
                              {productsAtLocation.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">
                                  No hay productos con stock en esta ubicación.
                                </p>
                              ) : (
                                <select
                                  value={productoId}
                                  onChange={(e) =>
                                    setProductoId(
                                      e.target.value
                                        ? parseInt(e.target.value)
                                        : ""
                                    )
                                  }
                                  className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                >
                                  <option value="">
                                    Seleccionar producto...
                                  </option>
                                  {productsAtLocation.map((p) => {
                                    const info = stockData.find(
                                      (s) =>
                                        s.producto_id === p.id &&
                                        s.ubicacion_id === ubicacionId
                                    );
                                    return (
                                      <option key={p.id} value={p.id}>
                                        {p.nombre} ({info?.stock ?? 0} disponibles)
                                      </option>
                                    );
                                  })}
                                </select>
                              )}
                            </div>

                            {productoId !== "" && selectedStock && (
                              <>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                  <p className="text-sm text-blue-800">
                                    Stock disponible:{" "}
                                    <span className="font-semibold">
                                      {selectedStock.stock} unidades
                                    </span>
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                      Cantidad
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={maxStock}
                                      value={cantidad}
                                      onChange={(e) =>
                                        setCantidad(e.target.value)
                                      }
                                      placeholder="0"
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                    />
                                    {cantidadNum > maxStock && (
                                      <p className="mt-1 text-xs text-red-600">
                                        Máximo disponible: {maxStock}
                                      </p>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                      Precio unitario (₡)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={precioUnitario}
                                      onChange={(e) =>
                                        setPrecioUnitario(e.target.value)
                                      }
                                      placeholder="0"
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                    />
                                  </div>
                                </div>

                                {isDiscounted && (
                                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                                    <p className="text-sm text-yellow-800">
                                      Descuento aplicado — Precio original: ₡{" "}
                                      {selectedStock.precio_venta.toLocaleString()}
                                    </p>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-sm font-medium text-gray-900 mb-2">
                                    Método de pago
                                  </label>
                                  <div className="flex gap-2">
                                    {METODO_PAGO_OPTIONS.map(({ value, label, icon: Icon }) => (
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
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Comprobante (opcional)
                                  </label>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                  />
                                  {selectedFile && (
                                    <p className="mt-1 text-xs text-green-600">
                                      Archivo seleccionado: {selectedFile.name}
                                    </p>
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
                                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                  />
                                </div>

                                {cantidadNum > 0 && precioNum > 0 && (
                                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                      Resumen
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">
                                          {cantidadNum} × ₡{" "}
                                          {precioNum.toLocaleString()}
                                        </span>
                                        <span className="font-semibold text-gray-900">
                                          ₡ {total.toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
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
                    {saving ? "Guardando..." : "Registrar Venta"}
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
    </Dialog>
  );
}
