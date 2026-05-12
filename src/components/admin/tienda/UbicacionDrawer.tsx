import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
  Switch,
} from "@headlessui/react";
import { XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import ConfirmDialog from "./ConfirmDialog";

interface Ubicacion {
  id: number;
  created_at: string;
  nombre: string;
  activo: boolean;
  creado_por: string | null;
}

interface UbicacionDrawerProps {
  open: boolean;
  onClose: () => void;
  ubicacion: Ubicacion | null;
  onSaved: () => Promise<void>;
}

export default function UbicacionDrawer({
  open,
  onClose,
  ubicacion,
  onSaved,
}: UbicacionDrawerProps) {
  const [nombre, setNombre] = useState("");
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isEdit = ubicacion !== null;

  const resetForm = () => {
    setNombre("");
    setActivo(true);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    if (ubicacion) {
      setNombre(ubicacion.nombre);
      setActivo(ubicacion.activo);
    } else {
      resetForm();
    }
  }, [open, ubicacion]);

  const handleSave = async () => {
    if (!nombre.trim()) {
      alert("El nombre es requerido");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase
          .from("ubicaciones")
          .update({ nombre: nombre.trim(), activo })
          .eq("id", ubicacion.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ubicaciones")
          .insert({ nombre: nombre.trim() });

        if (error) throw error;
      }

      await onSaved();
      onClose();
    } catch (error: any) {
      console.error("Error saving ubicación:", error);
      alert(error.message || "Error al guardar la ubicación");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!ubicacion) return;
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!ubicacion) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("ubicaciones")
        .delete()
        .eq("id", ubicacion.id);

      if (error) throw error;

      setConfirmDeleteOpen(false);
      await onSaved();
      onClose();
    } catch (error: any) {
      console.error("Error deleting ubicación:", error);
      alert(error.message || "Error al eliminar la ubicación");
    } finally {
      setDeleting(false);
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
                        {isEdit ? "Editar Ubicación" : "Nueva Ubicación"}
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
                      <div className="space-y-6 pt-6 pb-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Nombre de la ubicación"
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>

                        {isEdit && (
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-900">
                              Estado activo
                            </label>
                            <Switch
                              checked={activo}
                              onChange={setActivo}
                              className={`${
                                activo ? "bg-primary" : "bg-gray-200"
                              } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  activo ? "translate-x-5" : "translate-x-0"
                                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                              />
                            </Switch>
                          </div>
                        )}

                        {isEdit && ubicacion.nombre !== "Bodega" && (
                          <div className="border-t border-gray-200 pt-6">
                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={deleting}
                              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <TrashIcon className="size-4" />
                              {deleting ? "Eliminando..." : "Eliminar ubicación"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 justify-end px-4 py-4 gap-3">
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
                    disabled={saving}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar ubicación"
        description={
          <>
            ¿Está seguro que desea eliminar la ubicación
            {ubicacion ? (
              <>
                {" "}<strong>{ubicacion.nombre}</strong>
              </>
            ) : null}
            ?
          </>
        }
        details="Esta acción no se puede deshacer. Si la ubicación tiene inventario o ventas asociadas, no podrá ser eliminada."
        confirmLabel={deleting ? "Eliminando..." : "Eliminar"}
        tone="danger"
        loading={deleting}
        onConfirm={performDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </Dialog>
  );
}
