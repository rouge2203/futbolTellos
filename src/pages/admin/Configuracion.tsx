import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { supabase } from "../../lib/supabase";
import { FaSave } from "react-icons/fa";

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
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    setMessage(null);

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

      setMessage({ type: "success", text: "Configuración guardada exitosamente" });
    } catch (error) {
      console.error("Error saving config:", error);
      setMessage({ type: "error", text: "Error al guardar la configuración" });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Configuracion, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <AdminLayout title="Configuración">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Configuración">
      <div className="max-w-2xl">
        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg ${
              message.type === "success"
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-red-100 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-3">
            Horarios de Operación
          </h3>

          {/* Sabana Hours */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-700">📍 Sabana</h4>
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
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
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
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Guadalupe Hours */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-700">📍 Guadalupe</h4>
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
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
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
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <FaSave />
              )}
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

