import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

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

interface StockByLocation {
  [ubicacionId: number]: number;
}

type Tab = "transferir" | "corregir";
type SignoAjuste = "restar" | "sumar";

interface MoverStockDrawerProps {
  open: boolean;
  onClose: () => void;
  producto: Producto | null;
  ubicaciones: Ubicacion[];
  stockByLocation: StockByLocation;
  initialTab?: Tab;
  onSaved: () => Promise<void>;
}

export default function MoverStockDrawer({
  open,
  onClose,
  producto,
  ubicaciones,
  stockByLocation,
  initialTab = "transferir",
  onSaved,
}: MoverStockDrawerProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sourceId, setSourceId] = useState<number | "">("");
  const [destId, setDestId] = useState<number | "">("");
  const [cantidad, setCantidad] = useState<string>("");
  const [nota, setNota] = useState("");
  const [signo, setSigno] = useState<SignoAjuste>("restar");
  const [ubicacionId, setUbicacionId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUbicaciones = ubicaciones.filter((u) => u.activo);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setSourceId("");
    setDestId("");
    setUbicacionId("");
    setCantidad("");
    setNota("");
    setSigno("restar");
    setError(null);
  }, [open, initialTab, producto?.id]);

  const stockAt = (ubId: number | "") =>
    ubId === "" ? 0 : stockByLocation[ubId] ?? 0;

  const qtyNum = parseInt(cantidad) || 0;

  const transferCap = stockAt(sourceId);
  const restarCap = stockAt(ubicacionId);

  const fetchUltimoCosto = async (
    productoId: number,
    ubId: number,
  ): Promise<{ precio_venta: number; costo_unitario: number }> => {
    const tryQuery = async (filterByUbicacion: boolean) => {
      let query = supabase
        .from("producto_inventario")
        .select("precio_venta, costo_unitario")
        .eq("producto_id", productoId)
        .eq("tipo", "ingreso")
        .order("created_at", { ascending: false })
        .limit(1);
      if (filterByUbicacion) query = query.eq("ubicacion_id", ubId);
      const { data, error: err } = await query;
      if (err) throw err;
      return data?.[0] ?? null;
    };

    const atUbicacion = await tryQuery(true);
    if (atUbicacion) return atUbicacion;
    const anywhere = await tryQuery(false);
    if (anywhere) return anywhere;
    return {
      precio_venta: producto?.precio_sugerido ?? 0,
      costo_unitario: 0,
    };
  };

  const validate = (): string | null => {
    if (!producto) return "Producto no seleccionado.";
    if (!user) return "No se pudo identificar al usuario.";
    if (qtyNum <= 0) return "Ingresá una cantidad mayor a 0.";
    if (tab === "transferir") {
      if (sourceId === "") return "Seleccioná la ubicación de origen.";
      if (destId === "") return "Seleccioná la ubicación de destino.";
      if (sourceId === destId)
        return "El origen y el destino no pueden ser la misma ubicación.";
      if (qtyNum > transferCap)
        return `Solo hay ${transferCap} unidades disponibles en el origen.`;
    } else {
      if (ubicacionId === "") return "Seleccioná la ubicación a corregir.";
      if (signo === "restar" && qtyNum > restarCap)
        return `Solo hay ${restarCap} unidades en esa ubicación.`;
      if (!nota.trim())
        return "Agregá una nota explicando el motivo de la corrección.";
    }
    return null;
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!producto || !user) return;

    setSaving(true);
    setError(null);
    try {
      const loteId = crypto.randomUUID();

      if (tab === "transferir") {
        const source = activeUbicaciones.find((u) => u.id === sourceId);
        const dest = activeUbicaciones.find((u) => u.id === destId);
        const { precio_venta, costo_unitario } = await fetchUltimoCosto(
          producto.id,
          sourceId as number,
        );
        const trim = nota.trim();
        const rows = [
          {
            producto_id: producto.id,
            ubicacion_id: sourceId as number,
            cantidad: -qtyNum,
            precio_venta,
            costo_unitario,
            creado_por: user.id,
            nota: `Traslado a ${dest?.nombre ?? ""}${trim ? `: ${trim}` : ""}`,
            lote_id: loteId,
            tipo: "ajuste",
          },
          {
            producto_id: producto.id,
            ubicacion_id: destId as number,
            cantidad: qtyNum,
            precio_venta,
            costo_unitario,
            creado_por: user.id,
            nota: `Traslado desde ${source?.nombre ?? ""}${trim ? `: ${trim}` : ""}`,
            lote_id: loteId,
            tipo: "ajuste",
          },
        ];
        const { error: insertError } = await supabase
          .from("producto_inventario")
          .insert(rows);
        if (insertError) throw insertError;
      } else {
        const { precio_venta, costo_unitario } = await fetchUltimoCosto(
          producto.id,
          ubicacionId as number,
        );
        const signed = signo === "restar" ? -qtyNum : qtyNum;
        const { error: insertError } = await supabase
          .from("producto_inventario")
          .insert({
            producto_id: producto.id,
            ubicacion_id: ubicacionId as number,
            cantidad: signed,
            precio_venta,
            costo_unitario,
            creado_por: user.id,
            nota: nota.trim(),
            lote_id: loteId,
            tipo: "ajuste",
          });
        if (insertError) throw insertError;
      }

      await onSaved();
      onClose();
    } catch (err) {
      console.error("Error guardando movimiento de stock:", err);
      setError("Error al guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const totalActual = producto
    ? activeUbicaciones.reduce((sum, u) => sum + stockAt(u.id), 0)
    : 0;

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
              className="pointer-events-auto w-screen max-w-xl transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
            >
              <div className="relative flex h-full flex-col divide-y divide-gray-200 bg-white shadow-xl">
                <div className="h-0 flex-1 overflow-y-auto">
                  <div className="bg-primary px-4 py-6 sm:px-6">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-base font-semibold text-white">
                        {producto
                          ? `Mover stock · ${producto.nombre}`
                          : "Mover stock"}
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
                    {producto && (
                      <p className="mt-1 text-sm text-white/80">
                        Stock total actual: {totalActual}
                      </p>
                    )}
                  </div>

                  <div className="px-4 sm:px-6 pt-4">
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                      <button
                        type="button"
                        onClick={() => {
                          setTab("transferir");
                          setError(null);
                        }}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          tab === "transferir"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Transferir entre ubicaciones
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTab("corregir");
                          setError(null);
                        }}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          tab === "corregir"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Corregir conteo
                      </button>
                    </div>
                  </div>

                  <div className="px-4 sm:px-6 pt-5 pb-6 space-y-5">
                    {tab === "transferir" ? (
                      <>
                        <p className="text-sm text-gray-600">
                          Mueve unidades de una ubicación a otra. No cambia el
                          total general, solo dónde está el stock.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                              Desde
                            </label>
                            <select
                              value={sourceId}
                              onChange={(e) =>
                                setSourceId(
                                  e.target.value ? parseInt(e.target.value) : "",
                                )
                              }
                              className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                            >
                              <option value="">Seleccionar...</option>
                              {activeUbicaciones.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nombre} · {stockAt(u.id)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="hidden sm:flex pb-2 text-gray-400">
                            <ArrowRightIcon className="size-5" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                              Hacia
                            </label>
                            <select
                              value={destId}
                              onChange={(e) =>
                                setDestId(
                                  e.target.value ? parseInt(e.target.value) : "",
                                )
                              }
                              className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                            >
                              <option value="">Seleccionar...</option>
                              {activeUbicaciones
                                .filter((u) => u.id !== sourceId)
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.nombre} · {stockAt(u.id)}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Cantidad a mover
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={transferCap > 0 ? transferCap : undefined}
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            placeholder="0"
                            className="block w-32 rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                          {sourceId !== "" && (
                            <p className="mt-1 text-xs text-gray-500">
                              Disponibles en origen: {transferCap}
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
                            placeholder="Ej: reposición para fin de semana"
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">
                          Sumá o restá unidades para corregir errores de conteo,
                          mermas o ingresos sobrados. Sirve incluso si el lote
                          original ya tiene ventas.
                        </p>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Ubicación
                          </label>
                          <select
                            value={ubicacionId}
                            onChange={(e) =>
                              setUbicacionId(
                                e.target.value ? parseInt(e.target.value) : "",
                              )
                            }
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          >
                            <option value="">Seleccionar...</option>
                            {activeUbicaciones.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nombre} · stock actual {stockAt(u.id)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                          <button
                            type="button"
                            onClick={() => setSigno("restar")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              signo === "restar"
                                ? "bg-white text-red-700 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            Restar
                          </button>
                          <button
                            type="button"
                            onClick={() => setSigno("sumar")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              signo === "sumar"
                                ? "bg-white text-green-700 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            Sumar
                          </button>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={
                              signo === "restar" && restarCap > 0
                                ? restarCap
                                : undefined
                            }
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            placeholder="0"
                            className="block w-32 rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                          {ubicacionId !== "" && qtyNum > 0 && (
                            <p className="mt-1 text-xs text-gray-500">
                              Stock después:{" "}
                              <span className="font-semibold text-gray-900">
                                {restarCap +
                                  (signo === "sumar" ? qtyNum : -qtyNum)}
                              </span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Motivo <span className="text-red-600">*</span>
                          </label>
                          <textarea
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            rows={2}
                            placeholder="Ej: lote 200 estaba mal contado, eran 100"
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>
                      </>
                    )}

                    {error && (
                      <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                        {error}
                      </div>
                    )}
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
                    disabled={saving || !producto}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {saving
                      ? "Guardando..."
                      : tab === "transferir"
                        ? "Transferir"
                        : "Guardar ajuste"}
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
