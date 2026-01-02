import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import SuccessNotification from "../../components/admin/SuccessNotification";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { supabase } from "../../lib/supabase";
import { FaSave, FaEdit } from "react-icons/fa";

interface Configuracion {
  id: number;
  apertura_guada: string;
  apertura_sabana: string;
  cierre_guada: string;
  cierre_sabana: string;
}

export default function Configuracion() {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("configuracion")
          .select("*")
          .limit(1)
          .single();

        if (error) throw error;
        setConfig(data);
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setShowConfirmDialog(false);

    try {
      const { error } = await supabase
        .from("configuracion")
        .update({
          apertura_guada: config.apertura_guada,
          apertura_sabana: config.apertura_sabana,
          cierre_guada: config.cierre_guada,
          cierre_sabana: config.cierre_sabana,
        })
        .eq("id", config.id);

      if (error) throw error;

      setIsEditing(false);
      setShowSuccessNotification(true);
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    // Reload config to reset changes
    if (config) {
      const fetchConfig = async () => {
        try {
          const { data, error } = await supabase
            .from("configuracion")
            .select("*")
            .limit(1)
            .single();

          if (error) throw error;
          setConfig(data);
        } catch (error) {
          console.error("Error fetching config:", error);
        }
      };
      fetchConfig();
    }
    setIsEditing(false);
  };

  const handleChange = (field: keyof Configuracion, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <AdminLayout title="Configuración">
        <div className="flex h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Configuración">
      <div className="min-h-screen w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Horarios de Operación
            </h3>
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FaEdit />
                Editar
              </button>
            )}
          </div>

          {/* Sabana Hours */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">📍 Sabana</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Apertura
                </label>
                <input
                  type="time"
                  value={config?.apertura_sabana?.slice(0, 5) || ""}
                  onChange={(e) =>
                    handleChange("apertura_sabana", e.target.value + ":00")
                  }
                  disabled={!isEditing}
                  className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Cierre
                </label>
                <input
                  type="time"
                  value={config?.cierre_sabana?.slice(0, 5) || ""}
                  onChange={(e) =>
                    handleChange("cierre_sabana", e.target.value + ":00")
                  }
                  disabled={!isEditing}
                  className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Guadalupe Hours */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">📍 Guadalupe</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Apertura
                </label>
                <input
                  type="time"
                  value={config?.apertura_guada?.slice(0, 5) || ""}
                  onChange={(e) =>
                    handleChange("apertura_guada", e.target.value + ":00")
                  }
                  disabled={!isEditing}
                  className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Cierre
                </label>
                <input
                  type="time"
                  value={config?.cierre_guada?.slice(0, 5) || ""}
                  onChange={(e) =>
                    handleChange("cierre_guada", e.target.value + ":00")
                  }
                  disabled={!isEditing}
                  className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed sm:text-sm"
                />
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="pt-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <FaSave />
                )}
                {saving ? "Guardando..." : "Actualizar horario"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl outline -outline-offset-1 outline-gray-200 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Está seguro de actualizar los horarios?
              </DialogTitle>
              <p className="text-sm text-gray-600 mb-4">
                Los cambios afectarán la disponibilidad de las canchas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                >
                  Actualizar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Success Notification */}
      <SuccessNotification
        show={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
        message="Horarios actualizados"
        description="Los horarios se han actualizado exitosamente."
      />
    </AdminLayout>
  );
}
