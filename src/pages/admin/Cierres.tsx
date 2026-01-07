import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop, Transition } from "@headlessui/react";

interface Cierre {
  id: number;
  inicio: string;
  fin: string;
  creado_por: string;
  nota: string | null;
  cierre_pdf: string;
  faltantes: number;
  created_at: string;
}

const MONTHS_SPANISH = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function Cierres() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cierreToDelete, setCierreToDelete] = useState<Cierre | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    fetchCierres();
    
    // Check if coming from successful cierre creation
    if (location.state?.cierreCreated) {
      setShowNotification(true);
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, document.title);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const fetchCierres = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cierres")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCierres(data || []);
    } catch (error) {
      console.error("Error fetching cierres:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const day = parseInt(parts[2]);
      const month = parseInt(parts[1]) - 1;
      const year = parts[0];
      return `${day} ${MONTHS_SPANISH[month]} ${year}`;
    }
    return dateStr;
  };

  const formatDateRange = (inicio: string, fin: string): string => {
    if (inicio === fin) {
      return formatDate(inicio);
    }
    const inicioParts = inicio.split("-");
    const finParts = fin.split("-");
    
    if (inicioParts[1] === finParts[1] && inicioParts[0] === finParts[0]) {
      // Same month and year
      return `${parseInt(inicioParts[2])}-${parseInt(finParts[2])} ${MONTHS_SPANISH[parseInt(inicioParts[1]) - 1]} ${inicioParts[0]}`;
    }
    return `${formatDate(inicio)} - ${formatDate(fin)}`;
  };

  const handleOpenPdf = (pdfUrl: string) => {
    window.open(pdfUrl, "_blank");
  };

  const handleDeleteClick = (cierre: Cierre) => {
    setCierreToDelete(cierre);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!cierreToDelete) return;

    setDeleting(true);
    try {
      // Delete from database
      const { error } = await supabase
        .from("cierres")
        .delete()
        .eq("id", cierreToDelete.id);

      if (error) throw error;

      // Optionally delete from storage (extract filename from URL)
      try {
        const urlParts = cierreToDelete.cierre_pdf.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from("cierres").remove([fileName]);
      } catch (storageError) {
        console.warn("Could not delete PDF from storage:", storageError);
      }

      // Refresh list
      await fetchCierres();
      setDeleteDialogOpen(false);
      setCierreToDelete(null);
    } catch (error) {
      console.error("Error deleting cierre:", error);
      alert("Error al eliminar el cierre. Por favor intente de nuevo.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Cierres">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cierres">
      {/* Success Notification */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-50"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          <Transition show={showNotification}>
            <div className="pointer-events-auto w-full max-w-sm rounded-lg bg-white shadow-lg ring-1 ring-black/5 transition data-closed:opacity-0 data-enter:transform data-enter:duration-300 data-enter:ease-out data-closed:data-enter:translate-y-2 data-leave:duration-100 data-leave:ease-in data-closed:data-enter:sm:translate-x-2 data-closed:data-enter:sm:translate-y-0">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <CheckCircleIcon aria-hidden="true" className="size-6 text-primary" />
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">Cierre registrado</p>
                    <p className="mt-1 text-sm text-gray-500">El cierre ha sido guardado exitosamente.</p>
                  </div>
                  <div className="ml-4 flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowNotification(false)}
                      className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                      <span className="sr-only">Cerrar</span>
                      <XMarkIcon aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <div className="min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/admin/pagos")}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="size-4" />
            Volver a Pagos
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <DocumentTextIcon className="size-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-900">Historial de Cierres</h1>
        </div>

        {cierres.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay cierres registrados
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Periodo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Faltante
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Nota
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Creado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cierres.map((cierre) => (
                  <tr key={cierre.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDateRange(cierre.inicio, cierre.fin)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-semibold ${
                          cierre.faltantes > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        ₡ {cierre.faltantes.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {cierre.nota || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-500">
                        {new Date(cierre.created_at).toLocaleDateString("es-CR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenPdf(cierre.cierre_pdf)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Ver PDF"
                        >
                          <EyeIcon className="size-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(cierre)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <TrashIcon className="size-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
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
              className="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:opacity-0 data-closed:scale-95 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in max-w-sm w-full"
            >
              <div className="bg-primary px-4 py-3 flex items-center gap-2">
                <TrashIcon className="size-5 text-white" />
                <DialogTitle className="text-base font-semibold text-white">
                  Eliminar Cierre
                </DialogTitle>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600">
                  ¿Está seguro que desea eliminar este cierre? Esta acción no se puede deshacer.
                </p>
                {cierreToDelete && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateRange(cierreToDelete.inicio, cierreToDelete.fin)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Faltante: ₡ {cierreToDelete.faltantes.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setCierreToDelete(null);
                  }}
                  disabled={deleting}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-800 disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </AdminLayout>
  );
}

