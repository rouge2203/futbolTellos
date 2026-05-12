import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

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

interface InventarioDrawerProps {
  open: boolean;
  onClose: () => void;
  productos: Producto[];
  ubicaciones: Ubicacion[];
  onSaved: () => Promise<void>;
}

interface Distribucion {
  [ubicacionId: number]: number;
}

export default function InventarioDrawer({
  open,
  onClose,
  productos,
  ubicaciones,
  onSaved,
}: InventarioDrawerProps) {
  const { user } = useAuth();
  const [productoId, setProductoId] = useState<number | "">("");
  const [precioVenta, setPrecioVenta] = useState<string>("");
  const [cantidad, setCantidad] = useState<string>("");
  const [costoUnitario, setCostoUnitario] = useState<string>("");
  const [costoTotal, setCostoTotal] = useState<string>("");
  const [distribucion, setDistribucion] = useState<Distribucion>({});
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setProductoId("");
      setPrecioVenta("");
      setCantidad("");
      setCostoUnitario("");
      setCostoTotal("");
      setDistribucion({});
      setNota("");
    }
  }, [open]);

  useEffect(() => {
    if (productoId !== "") {
      const producto = productos.find((p) => p.id === productoId);
      if (producto?.precio_sugerido) {
        setPrecioVenta(String(producto.precio_sugerido));
      } else {
        setPrecioVenta("");
      }
    }
  }, [productoId, productos]);

  useEffect(() => {
    const total = parseInt(cantidad) || 0;
    const distributed = Object.entries(distribucion).reduce((sum, [key, val]) => {
      const ubId = parseInt(key);
      const bodega = ubicaciones.find((u) => u.nombre === "Bodega");
      if (bodega && ubId === bodega.id) return sum;
      return sum + (val || 0);
    }, 0);

    const bodega = ubicaciones.find((u) => u.nombre === "Bodega");
    if (bodega) {
      const remaining = Math.max(0, total - distributed);
      setDistribucion((prev) => ({ ...prev, [bodega.id]: remaining }));
    }
  }, [cantidad, ubicaciones]);

  const handleCostoTotalChange = (value: string) => {
    setCostoTotal(value);
    const total = parseFloat(value) || 0;
    const qty = parseInt(cantidad) || 0;
    if (qty > 0 && total > 0) {
      setCostoUnitario(String(Math.round(total / qty)));
    } else {
      setCostoUnitario("");
    }
  };

  const handleCostoUnitarioChange = (value: string) => {
    setCostoUnitario(value);
    const unitCost = parseFloat(value) || 0;
    const qty = parseInt(cantidad) || 0;
    if (qty > 0 && unitCost > 0) {
      setCostoTotal(String(Math.round(unitCost * qty)));
    } else {
      setCostoTotal("");
    }
  };

  const handleCantidadChange = (value: string) => {
    setCantidad(value);
    const qty = parseInt(value) || 0;
    const totalCost = parseFloat(costoTotal) || 0;
    if (qty > 0 && totalCost > 0) {
      setCostoUnitario(String(Math.round(totalCost / qty)));
    }
  };

  const activeUbicaciones = ubicaciones.filter((u) => u.activo);

  const totalDistribuido = Object.values(distribucion).reduce(
    (sum, val) => sum + (val || 0),
    0,
  );

  const totalCantidad = parseInt(cantidad) || 0;
  const restante = totalCantidad - totalDistribuido;

  const handleDistribucionChange = (ubicacionId: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const bodega = ubicaciones.find((u) => u.nombre === "Bodega");

    setDistribucion((prev) => {
      const next = { ...prev, [ubicacionId]: numValue };

      if (bodega) {
        const otherSum = Object.entries(next).reduce((sum, [key, val]) => {
          if (parseInt(key) === bodega.id) return sum;
          return sum + (val || 0);
        }, 0);
        next[bodega.id] = Math.max(0, totalCantidad - otherSum);
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (!productoId || !cantidad || !precioVenta || !costoUnitario) {
      alert("Por favor complete todos los campos requeridos.");
      return;
    }

    if (totalDistribuido !== totalCantidad) {
      alert(
        `La distribución (${totalDistribuido}) no coincide con la cantidad total (${totalCantidad}).`,
      );
      return;
    }

    if (!user) {
      alert("No se pudo identificar al usuario.");
      return;
    }

    setSaving(true);
    try {
      const loteId = crypto.randomUUID();
      const rows = Object.entries(distribucion)
        .filter(([, val]) => val > 0)
        .map(([ubicacionId, cantidadUb]) => ({
          producto_id: productoId,
          ubicacion_id: parseInt(ubicacionId),
          cantidad: cantidadUb,
          precio_venta: parseInt(precioVenta),
          costo_unitario: parseInt(costoUnitario),
          creado_por: user.id,
          nota: nota.trim() || null,
          lote_id: loteId,
        }));

      const { error } = await supabase.from("producto_inventario").insert(rows);

      if (error) throw error;

      await onSaved();
      onClose();
    } catch (error) {
      console.error("Error registrando inventario:", error);
      alert("Error al registrar el inventario. Por favor intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

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
                        Registrar Inventario
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
                            Producto
                          </label>
                          <select
                            value={productoId}
                            onChange={(e) =>
                              setProductoId(
                                e.target.value ? parseInt(e.target.value) : "",
                              )
                            }
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          >
                            <option value="">Seleccionar producto...</option>
                            {productos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        {productoId !== "" && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                  Cantidad total
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={cantidad}
                                  onChange={(e) => handleCantidadChange(e.target.value)}
                                  placeholder="0"
                                  className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                  Precio de venta c/u (₡)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={precioVenta}
                                  onChange={(e) => setPrecioVenta(e.target.value)}
                                  placeholder="0"
                                  className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                  Costo total de compra (₡)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={costoTotal}
                                  onChange={(e) => handleCostoTotalChange(e.target.value)}
                                  placeholder="Ej: 20000"
                                  className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                  Costo por unidad (₡)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={costoUnitario}
                                  onChange={(e) => handleCostoUnitarioChange(e.target.value)}
                                  placeholder="Se calcula automáticamente"
                                  className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                />
                              </div>
                            </div>

                            {totalCantidad > 0 && parseInt(precioVenta) > 0 && parseInt(costoUnitario) > 0 && (
                              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Resumen</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <span className="text-gray-600">Inversión total:</span>
                                  <span className="text-right font-medium text-gray-900">
                                    ₡ {(parseInt(costoUnitario) * totalCantidad).toLocaleString()}
                                  </span>
                                  <span className="text-gray-600">Ingreso esperado:</span>
                                  <span className="text-right font-medium text-gray-900">
                                    ₡ {(parseInt(precioVenta) * totalCantidad).toLocaleString()}
                                  </span>
                                  <span className="text-gray-600 font-semibold border-t border-gray-200 pt-1">Ganancia esperada:</span>
                                  <span className="text-right font-bold text-green-600 border-t border-gray-200 pt-1">
                                    ₡ {((parseInt(precioVenta) - parseInt(costoUnitario)) * totalCantidad).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            )}

                            {totalCantidad > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <label className="block text-sm font-medium text-gray-900">
                                    Distribución por ubicación
                                  </label>
                                  <span
                                    className={`text-sm font-medium ${
                                      restante === 0
                                        ? "text-green-600"
                                        : restante < 0
                                          ? "text-red-600"
                                          : "text-yellow-600"
                                    }`}
                                  >
                                    Restante: {restante}
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {activeUbicaciones.map((ubicacion) => {
                                    const isBodega =
                                      ubicacion.nombre === "Bodega";
                                    return (
                                      <div
                                        key={ubicacion.id}
                                        className="flex items-center gap-3"
                                      >
                                        <span
                                          className={`text-sm w-32 shrink-0 ${isBodega ? "font-semibold text-amber-700" : "text-gray-700"}`}
                                        >
                                          {ubicacion.nombre}
                                          {isBodega && " (auto)"}
                                        </span>
                                        <input
                                          type="number"
                                          min="0"
                                          max={totalCantidad}
                                          value={
                                            distribucion[ubicacion.id] || 0
                                          }
                                          onChange={(e) =>
                                            handleDistribucionChange(
                                              ubicacion.id,
                                              e.target.value,
                                            )
                                          }
                                          disabled={isBodega}
                                          className={`block w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${isBodega ? "bg-amber-50" : "bg-white"}`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

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
                    disabled={saving || productoId === "" || totalCantidad === 0}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {saving ? "Guardando..." : "Registrar"}
                  </button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
