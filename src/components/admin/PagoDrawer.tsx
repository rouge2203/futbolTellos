import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
  Switch,
} from "@headlessui/react";
import { XMarkIcon, EyeIcon } from "@heroicons/react/24/outline";
import { RiBankLine } from "react-icons/ri";

interface Cancha {
  id: number;
  nombre: string;
  img?: string;
  local: number;
  cantidad?: string;
  precio?: string;
}

interface Pago {
  id: number;
  reserva_id: number;
  monto_sinpe: number;
  monto_efectivo: number;
  nota: string | null;
  completo: boolean;
  creado_por: string;
  created_at?: string;
  sinpe_pago: string | null;
}

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  correo_reserva: string;
  precio: number;
  arbitro: boolean;
  cancha: Cancha;
  pagos?: Pago[];
  pagoStatus?: "no_registrado" | "incompleto" | "completo";
  pago_checkeado?: boolean;
}

interface PagoDrawerProps {
  open: boolean;
  onClose: () => void;
  reserva: Reserva | null;
  onPagoCreated: () => Promise<void>;
  user: User | null;
  cierresMode?: boolean;
  onReservaUpdated?: () => Promise<void>;
}

export default function PagoDrawer({
  open,
  onClose,
  reserva,
  onPagoCreated,
  user,
  cierresMode = false,
  onReservaUpdated,
}: PagoDrawerProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [montoSinpe, setMontoSinpe] = useState<string>("");
  const [montoEfectivo, setMontoEfectivo] = useState<string>("");
  const [nota, setNota] = useState<string>("");
  const [selectedSinpeFile, setSelectedSinpeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Image preview dialog state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewPago, setPreviewPago] = useState<Pago | null>(null);

  // Pago checkeado state
  const [pagoCheckeado, setPagoCheckeado] = useState(false);
  const [updatingCheckeado, setUpdatingCheckeado] = useState(false);

  // User lookup cache
  const [userCache, setUserCache] = useState<Record<string, string>>({});

  // Fetch pagos when drawer opens
  useEffect(() => {
    if (open && reserva) {
      fetchPagos();
      setPagoCheckeado(reserva.pago_checkeado || false);
    } else {
      setPagos([]);
      setShowCreateForm(false);
      setMontoSinpe("");
      setMontoEfectivo("");
      setNota("");
      setSelectedSinpeFile(null);
      setPagoCheckeado(false);
    }
  }, [open, reserva]);

  const fetchPagos = async () => {
    if (!reserva) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pagos")
        .select("*")
        .eq("reserva_id", reserva.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPagos(data || []);

      // Fetch user info for creado_por
      const userIds = [...new Set((data || []).map((p) => p.creado_por))];
      const newUserCache: Record<string, string> = { ...userCache };

      for (const userId of userIds) {
        if (!userCache[userId]) {
          try {
            // Try to get user from auth.users via admin API
            // Since we can't directly query auth.users, we'll use the email from user context if available
            // Or display UUID
            newUserCache[userId] = userId;
          } catch (err) {
            newUserCache[userId] = userId;
          }
        }
      }

      setUserCache(newUserCache);
    } catch (error) {
      console.error("Error fetching pagos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplay = (userId: string): string => {
    if (userCache[userId]) {
      // If it's the current user, show email
      if (user && user.id === userId) {
        return user.email || userId;
      }
      return userCache[userId];
    }
    return userId;
  };

  const calculateTotalPaid = (): number => {
    return pagos.reduce((sum, p) => sum + p.monto_sinpe + p.monto_efectivo, 0);
  };

  const calculatePercentage = (): number => {
    if (!reserva || reserva.precio === 0) return 0;
    const totalPaid = calculateTotalPaid();
    return Math.round((totalPaid / reserva.precio) * 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
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

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      alert("El archivo es muy grande. El tamaño máximo es 20MB.");
      return;
    }

    setSelectedSinpeFile(file);
  };

  const uploadSinpeImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `sinpe_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("Sinpes_admin")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("Sinpes_admin")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleCreatePago = async () => {
    if (!reserva || !user) return;

    const sinpe = parseFloat(montoSinpe) || 0;
    const efectivo = parseFloat(montoEfectivo) || 0;

    if (sinpe === 0 && efectivo === 0) {
      alert("Debe ingresar al menos un monto");
      return;
    }

    setCreating(true);
    setUploading(true);
    try {
      let sinpeImageUrl: string | null = null;

      // Upload image if selected
      if (selectedSinpeFile) {
        sinpeImageUrl = await uploadSinpeImage(selectedSinpeFile);
      }

      const existingTotal = calculateTotalPaid();
      const newTotal = existingTotal + sinpe + efectivo;
      const completo = newTotal >= reserva.precio;

      const { error } = await supabase.from("pagos").insert({
        reserva_id: reserva.id,
        monto_sinpe: sinpe,
        monto_efectivo: efectivo,
        nota: nota.trim() || null,
        completo: completo,
        creado_por: user.id,
        sinpe_pago: sinpeImageUrl,
      });

      if (error) throw error;

      // Refresh pagos
      await fetchPagos();
      await onPagoCreated();

      // Reset form
      setMontoSinpe("");
      setMontoEfectivo("");
      setNota("");
      setSelectedSinpeFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error creating pago:", error);
      alert("Error al registrar el pago. Por favor intente de nuevo.");
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  const handlePagoCheckeadoChange = async (checked: boolean) => {
    if (!reserva) return;

    setUpdatingCheckeado(true);
    try {
      const { error } = await supabase
        .from("reservas")
        .update({ pago_checkeado: checked })
        .eq("id", reserva.id);

      if (error) throw error;

      setPagoCheckeado(checked);
      if (onReservaUpdated) {
        await onReservaUpdated();
      }
    } catch (error) {
      console.error("Error updating pago_checkeado:", error);
      alert("Error al actualizar el estado. Por favor intente de nuevo.");
    } finally {
      setUpdatingCheckeado(false);
    }
  };

  const handlePreviewSinpe = (pago: Pago) => {
    setPreviewPago(pago);
    setPreviewDialogOpen(true);
  };

  if (!reserva) return null;

  const totalPaid = calculateTotalPaid();
  const percentage = calculatePercentage();
  const isComplete = totalPaid >= reserva.precio;

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
                        Pagos - {reserva.nombre_reserva}
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
                      {loading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                      ) : (
                        <div className="space-y-6 pt-6 pb-5">
                          {/* Reservation Info */}
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                              Información de la Reserva
                            </h3>
                            <div className="space-y-2 text-xs sm:text-sm">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-gray-600 shrink-0">
                                  Cancha:
                                </span>
                                <span className="text-gray-900 font-medium text-right">
                                  {reserva.cancha.nombre}
                                </span>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-gray-600 shrink-0">
                                  Fecha/Hora:
                                </span>
                                <span className="text-gray-900 font-medium text-right text-xs">
                                  {new Date(reserva.hora_inicio).toLocaleString(
                                    "es-CR",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-gray-600 shrink-0">
                                  Cliente:
                                </span>
                                <span className="text-gray-900 font-medium text-right">
                                  {reserva.nombre_reserva}
                                </span>
                              </div>
                              <div className="flex justify-between items-start gap-2 border-t border-gray-200 pt-2">
                                <span className="text-gray-900 font-semibold shrink-0">
                                  Precio Total:
                                </span>
                                <span className="text-gray-900 font-bold text-base sm:text-lg">
                                  ₡ {reserva.precio.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Payment Summary */}
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                              Resumen de Pagos
                            </h3>
                            <div className="space-y-2 text-xs sm:text-sm">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-gray-600 shrink-0">
                                  Total Pagado:
                                </span>
                                <span className="text-gray-900 font-medium text-right">
                                  ₡ {totalPaid.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-gray-600 shrink-0">
                                  Porcentaje:
                                </span>
                                <span className="text-gray-900 font-medium text-right">
                                  {percentage}%
                                </span>
                              </div>
                              <div className="border-t border-gray-200 pt-2">
                                {isComplete ? (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-green-600 font-semibold text-xs sm:text-sm">
                                      Pago Completo
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-extrabold text-green-600 shrink-0">
                                      ✓
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                    <span className="text-yellow-600 font-semibold text-xs sm:text-sm">
                                      Pago Incompleto
                                    </span>
                                    <span className="text-yellow-600  font-bold text-sm">
                                      Faltan ₡{" "}
                                      {(
                                        reserva.precio - totalPaid
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Pago Checkeado Toggle - only in Cierres mode */}
                              {cierresMode && (
                                <div className="border-t border-gray-200 pt-3 mt-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                        <RiBankLine className="size-4 text-primary" />
                                        Monto confirmado
                                      </label>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        Confirme que el total de la reserva se
                                        encuentra en bancos y efectivo
                                      </p>
                                    </div>
                                    <Switch
                                      checked={pagoCheckeado}
                                      onChange={handlePagoCheckeadoChange}
                                      disabled={updatingCheckeado}
                                      className={`${
                                        pagoCheckeado
                                          ? "bg-green-600"
                                          : "bg-gray-200"
                                      } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={`${
                                          pagoCheckeado
                                            ? "translate-x-5"
                                            : "translate-x-0"
                                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                                      />
                                    </Switch>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Pagos Table */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-semibold text-gray-900">
                                Historial de Pagos
                              </h3>
                              {!showCreateForm && (
                                <button
                                  type="button"
                                  onClick={() => setShowCreateForm(true)}
                                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90"
                                >
                                  Registrar pago
                                </button>
                              )}
                            </div>

                            {showCreateForm && (
                              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-primary/30">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                                  Nuevo Pago
                                </h4>
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-900 mb-1">
                                      Monto SINPE
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={montoSinpe}
                                      onChange={(e) =>
                                        setMontoSinpe(e.target.value)
                                      }
                                      placeholder="0"
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-900 mb-1">
                                      Monto Efectivo
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={montoEfectivo}
                                      onChange={(e) =>
                                        setMontoEfectivo(e.target.value)
                                      }
                                      placeholder="0"
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-900 mb-1">
                                      Nota (opcional)
                                    </label>
                                    <textarea
                                      value={nota}
                                      onChange={(e) => setNota(e.target.value)}
                                      placeholder="Notas adicionales..."
                                      rows={2}
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-900 mb-1">
                                      Comprobante de SINPE (opcional)
                                    </label>
                                    <input
                                      ref={fileInputRef}
                                      type="file"
                                      accept="image/*"
                                      onChange={handleFileSelect}
                                      className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                    />
                                    {selectedSinpeFile && (
                                      <p className="mt-1 text-xs text-green-600">
                                        Archivo seleccionado:{" "}
                                        {selectedSinpeFile.name}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowCreateForm(false);
                                        setMontoSinpe("");
                                        setMontoEfectivo("");
                                        setNota("");
                                      }}
                                      className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCreatePago}
                                      disabled={creating}
                                      className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 disabled:bg-gray-700 disabled:cursor-not-allowed"
                                    >
                                      {creating
                                        ? "Registrando..."
                                        : "Registrar"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {pagos.length === 0 ? (
                              <div className="text-center py-8 text-gray-500 text-sm">
                                No hay pagos registrados
                              </div>
                            ) : (
                              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead>
                                    <tr>
                                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        SINPE
                                      </th>
                                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        Efectivo
                                      </th>
                                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        Total
                                      </th>
                                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                                        Nota
                                      </th>
                                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                        Estado
                                      </th>
                                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell">
                                        Por
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {pagos.map((pago) => {
                                      const total =
                                        pago.monto_sinpe + pago.monto_efectivo;
                                      return (
                                        <tr key={pago.id}>
                                          <td className="px-2 py-1.5 text-xs text-gray-900">
                                            <div className="flex items-center gap-1.5">
                                              <span>
                                                ₡{" "}
                                                {pago.monto_sinpe.toLocaleString()}
                                              </span>
                                              {pago.sinpe_pago && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handlePreviewSinpe(pago)
                                                  }
                                                  className="text-primary hover:text-primary/80 transition-colors border border-gray-300 rounded p-0.5"
                                                  title="Ver comprobante SINPE"
                                                >
                                                  <EyeIcon className="size-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-2 py-1.5 text-xs text-gray-900">
                                            ₡{" "}
                                            {pago.monto_efectivo.toLocaleString()}
                                          </td>
                                          <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                                            ₡ {total.toLocaleString()}
                                          </td>
                                          <td className="px-2 py-1.5 text-xs text-gray-600 hidden sm:table-cell">
                                            {pago.nota || "-"}
                                          </td>
                                          <td className="px-2 py-1.5">
                                            {pago.completo ? (
                                              <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-extrabold text-green-600">
                                                ✓
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center text-yellow-600 rounded-full bg-yellow-50 px-1.5 py-0.5 text-xs font-extrabold">
                                                !
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 py-1.5 text-xs text-gray-600 hidden md:table-cell truncate max-w-[100px]">
                                            {getUserDisplay(pago.creado_por)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 justify-end px-4 py-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>

      {/* Full-screen Loader */}
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

      {/* SINPE Image Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        className="relative z-60"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:opacity-0 data-closed:scale-95 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in max-w-lg w-full"
            >
              <div className="bg-primary px-4 py-3 flex items-center justify-between">
                <DialogTitle className="text-base font-semibold text-white">
                  Comprobante SINPE
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => setPreviewDialogOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  <XMarkIcon className="size-5" />
                </button>
              </div>
              <div className="p-4">
                {previewPago && (
                  <>
                    <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Monto SINPE:
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          ₡ {previewPago.monto_sinpe.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {previewPago.sinpe_pago && (
                      <img
                        src={previewPago.sinpe_pago}
                        alt="Comprobante SINPE"
                        className="w-full rounded-lg shadow-md"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="bg-gray-50 px-4 py-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewDialogOpen(false)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                >
                  Cerrar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </Dialog>
  );
}
