import { useState, useEffect, useRef, Fragment } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
  Switch,
} from "@headlessui/react";
import {
  XMarkIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { RiBankLine } from "react-icons/ri";
import { validarNuevoPago } from "../../lib/pagoValidation";
import { recomputarCompletos } from "../../lib/recomputarCompletos";
import { useAuth } from "../../contexts/AuthContext";

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
  // Soft delete: un pago anulado se sigue mostrando (queda el rastro de quién
  // lo anuló) pero no cuenta para ningún total.
  anulado_at: string | null;
  anulado_por: string | null;
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

const DAYS_SPANISH_FULL = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

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
  const { isSuperuser } = useAuth();

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edición y anulación: sólo superusuarios, y siempre visibles (no dependen
  // del Modo Cierres).
  const [editandoPagoId, setEditandoPagoId] = useState<number | null>(null);
  const [editSinpe, setEditSinpe] = useState<string>("");
  const [editEfectivo, setEditEfectivo] = useState<string>("");
  const [editNota, setEditNota] = useState<string>("");
  const [pagoAAnular, setPagoAAnular] = useState<Pago | null>(null);
  const [edicionPendiente, setEdicionPendiente] = useState<{
    pago: Pago;
    sinpe: number;
    efectivo: number;
    nota: string | null;
  } | null>(null);
  const [procesando, setProcesando] = useState(false);

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
      setEditandoPagoId(null);
      setPagoAAnular(null);
      setEdicionPendiente(null);
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
    } catch (error) {
      console.error("Error fetching pagos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplay = (creadoPor: string): string => {
    // Return the stored username directly
    return creadoPor;
  };

  const estaAnulado = (pago: Pago): boolean => pago.anulado_at != null;

  // Un pago anulado deja de existir para efectos de plata. Todo lo demás
  // (porcentaje, sobrepago, "Pago Completo", el restante que valida el formulario)
  // se deriva de este número, así que excluirlos acá alcanza para que el resumen
  // completo quede coherente.
  const calculateTotalPaid = (): number => {
    return pagos.reduce(
      (sum, p) => (estaAnulado(p) ? sum : sum + p.monto_sinpe + p.monto_efectivo),
      0
    );
  };

  // Total de los OTROS pagos vivos. Al editar una fila su monto viejo no puede
  // contar contra el tope del precio: si no, el importe que se está reemplazando
  // se cobraría dos veces y la edición quedaría bloqueada sin razón.
  const totalOtrosPagos = (pagoId: number): number => {
    return pagos.reduce(
      (sum, p) =>
        estaAnulado(p) || p.id === pagoId
          ? sum
          : sum + p.monto_sinpe + p.monto_efectivo,
      0
    );
  };

  /** parseFloat("") es NaN; acá un campo vacío vale 0, como en el alta. */
  const aNumero = (valor: string): number => {
    const n = parseFloat(valor);
    return Number.isFinite(n) ? n : 0;
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

    // Mismo chequeo que deshabilita el botón: un render viejo no debe poder
    // colar una fila que la UI ya marcó como inválida.
    const check = validarNuevoPago({
      precio: reserva.precio,
      totalPagado: calculateTotalPaid(),
      sinpe,
      efectivo,
      tieneComprobante: selectedSinpeFile !== null,
    });
    if (!check.puedeRegistrar) return;

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

      // Get username from email (part before @)
      const username = user.email ? user.email.split("@")[0] : user.id;

      const { error } = await supabase.from("pagos").insert({
        reserva_id: reserva.id,
        monto_sinpe: sinpe,
        monto_efectivo: efectivo,
        nota: nota.trim() || null,
        completo: completo,
        creado_por: username,
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

  // ---------------------------------------------------------------------------
  // Anular y editar (superusuarios)
  // ---------------------------------------------------------------------------

  // RLS: la política de UPDATE de `pagos` sólo deja pasar a is_superuser(), y
  // PostgREST reporta éxito con CERO filas cuando la política filtra al llamador
  // (mismo caso documentado en EditCanchaDrawer). Sin este chequeo el drawer
  // diría "listo" sin haber escrito nada.
  const assertFilaActualizada = (filas: unknown[] | null) => {
    if (!filas || filas.length === 0) {
      throw new Error(
        "No se pudo guardar: solo un superusuario puede anular o editar pagos."
      );
    }
  };

  const refrescarTodo = async () => {
    await fetchPagos();
    await onPagoCreated();
    if (onReservaUpdated) {
      await onReservaUpdated();
    }
  };

  /**
   * `completo` se guardó con el acumulado que existía cuando se creó cada fila,
   * así que después de anular o editar puede quedar mintiendo. Se recalcula
   * sobre los pagos frescos de la base y se persisten sólo las filas que cambian.
   */
  const recomputarYPersistir = async () => {
    if (!reserva) return;

    const { data, error } = await supabase
      .from("pagos")
      .select("*")
      .eq("reserva_id", reserva.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const frescos = (data || []) as Pago[];
    const cambios = recomputarCompletos(
      frescos.map((p) => ({
        id: p.id,
        monto_sinpe: p.monto_sinpe,
        monto_efectivo: p.monto_efectivo,
        completo: p.completo,
        created_at: p.created_at ?? null,
        anulado_at: p.anulado_at,
      })),
      reserva.precio
    );

    for (const cambio of cambios) {
      const { data: filas, error: errorUpdate } = await supabase
        .from("pagos")
        .update({ completo: cambio.completo })
        .eq("id", cambio.id)
        .select();

      if (errorUpdate) throw errorUpdate;
      assertFilaActualizada(filas);
    }
  };

  const handleConfirmarAnular = async () => {
    if (!reserva || !user || !pagoAAnular) return;

    // Mismo criterio de username que handleCreatePago.
    const username = user.email ? user.email.split("@")[0] : user.id;

    setProcesando(true);
    try {
      const { data, error } = await supabase
        .from("pagos")
        .update({
          anulado_at: new Date().toISOString(),
          anulado_por: username,
        })
        .eq("id", pagoAAnular.id)
        .select();

      if (error) throw error;
      assertFilaActualizada(data);

      await recomputarYPersistir();

      // Si la fila anulada era la que estaba en edición, el formulario ya no aplica.
      if (editandoPagoId === pagoAAnular.id) {
        setEditandoPagoId(null);
      }
      setPagoAAnular(null);
      await refrescarTodo();
    } catch (error) {
      console.error("Error anulando pago:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Error al anular el pago. Por favor intente de nuevo."
      );
      // Se recarga desde la base para no dejar la UI mostrando algo que no se guardó.
      await fetchPagos();
      setPagoAAnular(null);
    } finally {
      setProcesando(false);
    }
  };

  const iniciarEdicion = (pago: Pago) => {
    setEditandoPagoId(pago.id);
    setEditSinpe(String(pago.monto_sinpe));
    setEditEfectivo(String(pago.monto_efectivo));
    setEditNota(pago.nota || "");
  };

  const cancelarEdicion = () => {
    setEditandoPagoId(null);
    setEditSinpe("");
    setEditEfectivo("");
    setEditNota("");
  };

  const handleGuardarEdicion = async () => {
    if (!edicionPendiente) return;

    const { pago, sinpe, efectivo, nota: notaEditada } = edicionPendiente;

    setProcesando(true);
    try {
      const { data, error } = await supabase
        .from("pagos")
        .update({
          monto_sinpe: sinpe,
          monto_efectivo: efectivo,
          nota: notaEditada,
        })
        .eq("id", pago.id)
        .select();

      if (error) throw error;
      assertFilaActualizada(data);

      await recomputarYPersistir();

      setEdicionPendiente(null);
      cancelarEdicion();
      await refrescarTodo();
    } catch (error) {
      console.error("Error editando pago:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Error al editar el pago. Por favor intente de nuevo."
      );
      await fetchPagos();
      setEdicionPendiente(null);
    } finally {
      setProcesando(false);
    }
  };

  if (!reserva) return null;

  const totalPaid = calculateTotalPaid();
  const percentage = calculatePercentage();
  const isComplete = totalPaid >= reserva.precio;
  const sobrepago = Math.max(0, totalPaid - reserva.precio);

  const validacion = validarNuevoPago({
    precio: reserva.precio,
    totalPagado: totalPaid,
    sinpe: parseFloat(montoSinpe),
    efectivo: parseFloat(montoEfectivo),
    tieneComprobante: selectedSinpeFile !== null,
  });

  const pagoEnEdicion = pagos.find((p) => p.id === editandoPagoId) || null;

  // Se reusan las mismas reglas del alta; lo único distinto es la base contra la
  // que se mide el tope (los otros pagos vivos) y que el comprobante ya existe
  // o no existe, no se puede adjuntar.
  const validacionEdicion = pagoEnEdicion
    ? validarNuevoPago({
        precio: reserva.precio,
        totalPagado: totalOtrosPagos(pagoEnEdicion.id),
        sinpe: parseFloat(editSinpe),
        efectivo: parseFloat(editEfectivo),
        tieneComprobante: pagoEnEdicion.sinpe_pago !== null,
      })
    : null;

  const abrirConfirmacionEdicion = (pago: Pago) => {
    if (!validacionEdicion?.puedeRegistrar) return;
    setEdicionPendiente({
      pago,
      sinpe: aNumero(editSinpe),
      efectivo: aNumero(editEfectivo),
      nota: editNota.trim() || null,
    });
  };

  // Función normal (no componente): así el JSX se inserta en el mismo árbol y
  // los inputs no pierden el foco en cada tecla.
  const renderFormularioEdicion = (pago: Pago) => (
    <div className="mt-3 space-y-3 rounded-lg border border-primary/30 bg-gray-50 p-3">
      <h4 className="text-xs font-semibold text-gray-900">Editar pago</h4>
      <div>
        <label className="block text-xs font-medium text-gray-900 mb-1">
          Monto SINPE
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={editSinpe}
          onChange={(e) => setEditSinpe(e.target.value)}
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
          min="0"
          value={editEfectivo}
          onChange={(e) => setEditEfectivo(e.target.value)}
          placeholder="0"
          className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-900 mb-1">
          Nota (opcional)
        </label>
        <textarea
          value={editNota}
          onChange={(e) => setEditNota(e.target.value)}
          placeholder="Notas adicionales..."
          rows={2}
          className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        />
      </div>

      <p className="text-xs text-gray-500">
        El comprobante no se puede cambiar al editar.
      </p>

      {validacionEdicion &&
        (validacionEdicion.montoInvalido ||
          validacionEdicion.faltaComprobante ||
          validacionEdicion.sinMonto ||
          validacionEdicion.yaPagada ||
          validacionEdicion.excedePrecio) && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
            {validacionEdicion.montoInvalido && (
              <p className="text-xs font-semibold text-red-700">
                Los montos no pueden ser negativos.
              </p>
            )}
            {validacionEdicion.faltaComprobante && (
              <p className="text-xs font-semibold text-red-700">
                Anule este pago y regístrelo de nuevo con el comprobante.
              </p>
            )}
            {validacionEdicion.sinMonto && (
              <p className="text-xs font-semibold text-red-700">
                El pago no puede quedar en ₡ 0. Si desea eliminarlo, anúlelo.
              </p>
            )}
            {validacionEdicion.yaPagada && (
              <p className="text-xs font-semibold text-red-700">
                Los demás pagos ya cubren el precio de la reserva. Anule este
                pago en vez de editarlo.
              </p>
            )}
            {validacionEdicion.excedePrecio && (
              <p className="text-xs font-semibold text-red-700">
                El total excede el precio de la cancha. Máximo para este pago: ₡{" "}
                {validacionEdicion.restante.toLocaleString()}
              </p>
            )}
          </div>
        )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={cancelarEdicion}
          className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => abrirConfirmacionEdicion(pago)}
          disabled={procesando || !validacionEdicion?.puedeRegistrar}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 disabled:bg-gray-700 disabled:cursor-not-allowed"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );

  const renderAccionesSuperuser = (pago: Pago) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => iniciarEdicion(pago)}
        className="rounded border border-gray-300 p-1 text-gray-600 transition-colors hover:text-primary"
        title="Editar pago"
      >
        <PencilSquareIcon className="size-4" />
        <span className="sr-only">Editar pago</span>
      </button>
      <button
        type="button"
        onClick={() => setPagoAAnular(pago)}
        className="rounded border border-gray-300 p-1 text-gray-600 transition-colors hover:text-red-600"
        title="Anular pago"
      >
        <TrashIcon className="size-4" />
        <span className="sr-only">Anular pago</span>
      </button>
    </div>
  );

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
                                  {(() => {
                                    const d = new Date(reserva.hora_inicio);
                                    return `${DAYS_SPANISH_FULL[d.getDay()]}, ${d.toLocaleString(
                                      "es-CR",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}`;
                                  })()}
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
                                {sobrepago > 0 ? (
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                    <span className="text-red-600 font-semibold text-xs sm:text-sm">
                                      Sobrepago
                                    </span>
                                    <span className="text-red-600 font-bold text-sm">
                                      Sobra ₡ {sobrepago.toLocaleString()}
                                    </span>
                                  </div>
                                ) : isComplete ? (
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
                                      min="0"
                                      value={montoSinpe}
                                      onChange={(e) =>
                                        setMontoSinpe(e.target.value)
                                      }
                                      placeholder="0"
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                      Si ingresa un monto SINPE, el comprobante
                                      es obligatorio.
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-900 mb-1">
                                      Monto Efectivo
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
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
                                      Comprobante de SINPE{" "}
                                      {validacion.comprobanteRequerido ? (
                                        <span className="text-red-600 font-semibold">
                                          (obligatorio)
                                        </span>
                                      ) : (
                                        "(opcional)"
                                      )}
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

                                  {/* Restricciones: comprobante obligatorio y tope del precio */}
                                  {(validacion.faltaComprobante ||
                                    validacion.excedePrecio ||
                                    validacion.yaPagada ||
                                    validacion.montoInvalido) && (
                                    <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
                                      {validacion.montoInvalido && (
                                        <p className="text-xs font-semibold text-red-700">
                                          Los montos no pueden ser negativos.
                                        </p>
                                      )}
                                      {validacion.faltaComprobante && (
                                        <p className="text-xs font-semibold text-red-700">
                                          Debe adjuntar el comprobante del
                                          SINPE.
                                        </p>
                                      )}
                                      {validacion.yaPagada && (
                                        <p className="text-xs font-semibold text-red-700">
                                          Esta reserva ya está pagada por
                                          completo. No se pueden registrar más
                                          pagos.
                                        </p>
                                      )}
                                      {validacion.excedePrecio && (
                                        <p className="text-xs font-semibold text-red-700">
                                          El total excede el precio de la
                                          cancha. Máximo restante: ₡{" "}
                                          {validacion.restante.toLocaleString()}
                                        </p>
                                      )}
                                      {(validacion.excedePrecio ||
                                        validacion.yaPagada) && (
                                        <p className="text-xs text-red-600">
                                          Si el precio real de esta reservación
                                          es mayor, vaya a Reservaciones y edite
                                          el precio de la reservación.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowCreateForm(false);
                                        setMontoSinpe("");
                                        setMontoEfectivo("");
                                        setNota("");
                                        setSelectedSinpeFile(null);
                                        if (fileInputRef.current) {
                                          fileInputRef.current.value = "";
                                        }
                                      }}
                                      className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCreatePago}
                                      disabled={creating || !validacion.puedeRegistrar}
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
                              <>
                              {/* Móvil: tarjetas en lugar de tabla */}
                              <ul className="space-y-3 sm:hidden">
                                {pagos.map((pago) => {
                                  const total =
                                    pago.monto_sinpe + pago.monto_efectivo;
                                  const anulado = estaAnulado(pago);
                                  return (
                                    <li
                                      key={pago.id}
                                      className={`rounded-lg border p-3 ${
                                        anulado
                                          ? "border-gray-200 bg-gray-50"
                                          : "border-gray-200 bg-white"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p
                                            className={`text-base font-semibold ${
                                              anulado
                                                ? "text-gray-400 line-through"
                                                : "text-gray-900"
                                            }`}
                                          >
                                            ₡ {total.toLocaleString()}
                                          </p>
                                          <p
                                            className={`mt-0.5 text-xs ${
                                              anulado
                                                ? "text-gray-400 line-through"
                                                : "text-gray-500"
                                            }`}
                                          >
                                            SINPE ₡{" "}
                                            {pago.monto_sinpe.toLocaleString()}{" "}
                                            · Efectivo ₡{" "}
                                            {pago.monto_efectivo.toLocaleString()}
                                          </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                          {pago.sinpe_pago && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handlePreviewSinpe(pago)
                                              }
                                              className="rounded border border-gray-300 p-1 text-primary transition-colors hover:text-primary/80"
                                              title="Ver comprobante SINPE"
                                            >
                                              <EyeIcon className="size-4" />
                                            </button>
                                          )}
                                          {anulado ? (
                                            <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-500">
                                              Anulado
                                            </span>
                                          ) : pago.completo ? (
                                            <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-extrabold text-green-600">
                                              ✓
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center rounded-full bg-yellow-50 px-1.5 py-0.5 text-xs font-extrabold text-yellow-600">
                                              !
                                            </span>
                                          )}
                                          {/* Una fila anulada no ofrece acciones. */}
                                          {isSuperuser &&
                                            !anulado &&
                                            editandoPagoId !== pago.id &&
                                            renderAccionesSuperuser(pago)}
                                        </div>
                                      </div>
                                      {pago.nota && (
                                        <p
                                          className={`mt-2 text-xs break-words ${
                                            anulado
                                              ? "text-gray-400 line-through"
                                              : "text-gray-600"
                                          }`}
                                        >
                                          {pago.nota}
                                        </p>
                                      )}
                                      <p className="mt-2 truncate text-xs text-gray-400">
                                        Por {getUserDisplay(pago.creado_por)}
                                      </p>
                                      {anulado && (
                                        <p className="mt-1 truncate text-xs font-medium text-gray-500">
                                          Anulado por{" "}
                                          {pago.anulado_por || "desconocido"}
                                        </p>
                                      )}
                                      {isSuperuser &&
                                        !anulado &&
                                        editandoPagoId === pago.id &&
                                        renderFormularioEdicion(pago)}
                                    </li>
                                  );
                                })}
                              </ul>

                              {/* sm y superiores: tabla */}
                              <div className="hidden overflow-x-auto sm:block">
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
                                      {isSuperuser && (
                                        <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                          <span className="sr-only">
                                            Acciones
                                          </span>
                                        </th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {pagos.map((pago) => {
                                      const total =
                                        pago.monto_sinpe + pago.monto_efectivo;
                                      const anulado = estaAnulado(pago);
                                      const estiloMonto = anulado
                                        ? "text-gray-400 line-through"
                                        : "text-gray-900";
                                      const editandoEstaFila =
                                        isSuperuser &&
                                        !anulado &&
                                        editandoPagoId === pago.id;
                                      return (
                                        <Fragment key={pago.id}>
                                          <tr className={anulado ? "bg-gray-50" : undefined}>
                                          <td
                                            className={`px-2 py-1.5 text-xs ${estiloMonto}`}
                                          >
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
                                          <td
                                            className={`px-2 py-1.5 text-xs ${estiloMonto}`}
                                          >
                                            ₡{" "}
                                            {pago.monto_efectivo.toLocaleString()}
                                          </td>
                                          <td
                                            className={`px-2 py-1.5 text-xs font-medium ${estiloMonto}`}
                                          >
                                            ₡ {total.toLocaleString()}
                                          </td>
                                          <td
                                            className={`px-2 py-1.5 text-xs hidden sm:table-cell ${
                                              anulado
                                                ? "text-gray-400 line-through"
                                                : "text-gray-600"
                                            }`}
                                          >
                                            {pago.nota || "-"}
                                          </td>
                                          <td className="px-2 py-1.5">
                                            {anulado ? (
                                              // La columna "Por" se esconde en pantallas chicas,
                                              // así que la autoría de la anulación va acá para que
                                              // se vea siempre.
                                              <span className="inline-flex flex-col items-start rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">
                                                <span className="text-xs font-semibold">
                                                  Anulado
                                                </span>
                                                <span className="text-[10px] whitespace-nowrap">
                                                  por{" "}
                                                  {pago.anulado_por ||
                                                    "desconocido"}
                                                </span>
                                              </span>
                                            ) : pago.completo ? (
                                              <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-extrabold text-green-600">
                                                ✓
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center text-yellow-600 rounded-full bg-yellow-50 px-1.5 py-0.5 text-xs font-extrabold">
                                                !
                                              </span>
                                            )}
                                          </td>
                                          <td
                                            className={`px-2 py-1.5 text-xs hidden md:table-cell truncate max-w-[100px] ${
                                              anulado
                                                ? "text-gray-400"
                                                : "text-gray-600"
                                            }`}
                                          >
                                            {getUserDisplay(pago.creado_por)}
                                          </td>
                                          {isSuperuser && (
                                            <td className="px-2 py-1.5">
                                              {/* Una fila anulada no ofrece acciones. */}
                                              {!anulado &&
                                                !editandoEstaFila && (
                                                  <div className="flex justify-end">
                                                    {renderAccionesSuperuser(
                                                      pago
                                                    )}
                                                  </div>
                                                )}
                                            </td>
                                          )}
                                          </tr>
                                          {editandoEstaFila && (
                                            <tr>
                                              <td colSpan={7} className="px-2 pb-3">
                                                {renderFormularioEdicion(pago)}
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              </>
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

      {/* Confirmación de anulación (mismo patrón anidado y z-60 que el preview) */}
      <Dialog
        open={pagoAAnular !== null}
        onClose={() => {
          if (!procesando) setPagoAAnular(null);
        }}
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
              className="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:opacity-0 data-closed:scale-95 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in max-w-md w-full"
            >
              <div className="bg-red-600 px-4 py-3">
                <DialogTitle className="text-base font-semibold text-white">
                  Anular pago
                </DialogTitle>
              </div>
              <div className="p-4 space-y-3">
                {pagoAAnular && (
                  <>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Monto:</span>
                        <span className="text-lg font-bold text-gray-900">
                          ₡{" "}
                          {(
                            pagoAAnular.monto_sinpe +
                            pagoAAnular.monto_efectivo
                          ).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        SINPE ₡ {pagoAAnular.monto_sinpe.toLocaleString()} ·
                        Efectivo ₡{" "}
                        {pagoAAnular.monto_efectivo.toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700">
                      Este pago dejará de contar en el total de la reserva y en
                      los cierres. La fila queda visible como anulada; no se
                      borra.
                    </p>
                  </>
                )}
              </div>
              <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPagoAAnular(null)}
                  disabled={procesando}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAnular}
                  disabled={procesando}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {procesando ? "Anulando..." : "Anular pago"}
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Confirmación de edición: ANTES -> DESPUÉS antes de tocar la base */}
      <Dialog
        open={edicionPendiente !== null}
        onClose={() => {
          if (!procesando) setEdicionPendiente(null);
        }}
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
              className="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:opacity-0 data-closed:scale-95 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in max-w-md w-full"
            >
              <div className="bg-primary px-4 py-3">
                <DialogTitle className="text-base font-semibold text-white">
                  Confirmar cambios del pago
                </DialogTitle>
              </div>
              <div className="p-4 space-y-3">
                {edicionPendiente && (
                  <>
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="grid grid-cols-3 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                        <span></span>
                        <span className="text-right">Antes</span>
                        <span className="text-right">Después</span>
                      </div>
                      <div className="grid grid-cols-3 px-3 py-1.5 text-xs text-gray-900 border-t border-gray-200">
                        <span className="text-gray-600">SINPE</span>
                        <span className="text-right">
                          ₡{" "}
                          {edicionPendiente.pago.monto_sinpe.toLocaleString()}
                        </span>
                        <span className="text-right font-semibold">
                          ₡ {edicionPendiente.sinpe.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 px-3 py-1.5 text-xs text-gray-900 border-t border-gray-200">
                        <span className="text-gray-600">Efectivo</span>
                        <span className="text-right">
                          ₡{" "}
                          {edicionPendiente.pago.monto_efectivo.toLocaleString()}
                        </span>
                        <span className="text-right font-semibold">
                          ₡ {edicionPendiente.efectivo.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 px-3 py-1.5 text-xs border-t border-gray-200 bg-gray-50">
                        <span className="text-gray-600 font-semibold">
                          Total
                        </span>
                        <span className="text-right text-gray-900">
                          ₡{" "}
                          {(
                            edicionPendiente.pago.monto_sinpe +
                            edicionPendiente.pago.monto_efectivo
                          ).toLocaleString()}
                        </span>
                        <span className="text-right font-bold text-gray-900">
                          ₡{" "}
                          {(
                            edicionPendiente.sinpe + edicionPendiente.efectivo
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {(edicionPendiente.pago.nota || edicionPendiente.nota) && (
                      <div className="rounded-lg border border-gray-200 p-3 text-xs space-y-1">
                        <p className="text-gray-600">
                          Nota antes:{" "}
                          <span className="text-gray-900">
                            {edicionPendiente.pago.nota || "-"}
                          </span>
                        </p>
                        <p className="text-gray-600">
                          Nota después:{" "}
                          <span className="text-gray-900 font-semibold">
                            {edicionPendiente.nota || "-"}
                          </span>
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      El comprobante del SINPE no cambia.
                    </p>
                  </>
                )}
              </div>
              <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEdicionPendiente(null)}
                  disabled={procesando}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarEdicion}
                  disabled={procesando}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {procesando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </Dialog>
  );
}
