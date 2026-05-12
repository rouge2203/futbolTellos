import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
  Switch,
} from "@headlessui/react";
import { XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import ConfirmDialog from "./ConfirmDialog";

interface Producto {
  id: number;
  created_at: string;
  nombre: string;
  foto_url: string | null;
  precio_sugerido: number | null;
  creado_por: string | null;
  activo: boolean;
}

interface ProductoDrawerProps {
  open: boolean;
  onClose: () => void;
  producto: Producto | null;
  onSaved: () => Promise<void>;
}

const TIENDA_BUCKET = "tienda";

const getStoragePathFromUrl = (url: string | null | undefined): string | null => {
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

export default function ProductoDrawer({
  open,
  onClose,
  producto,
  onSaved,
}: ProductoDrawerProps) {
  const { user } = useAuth();
  const [nombre, setNombre] = useState("");
  const [precioSugerido, setPrecioSugerido] = useState<string>("");
  const [activo, setActivo] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [decimalWarning, setDecimalWarning] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [ventasCount, setVentasCount] = useState<number | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = producto !== null;

  const resetForm = () => {
    setNombre("");
    setPrecioSugerido("");
    setActivo(true);
    setSelectedFile(null);
    setDecimalWarning(false);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    if (producto) {
      setNombre(producto.nombre);
      setPrecioSugerido(
        producto.precio_sugerido != null
          ? producto.precio_sugerido.toString()
          : ""
      );
      setActivo(producto.activo);
      setSelectedFile(null);
      setDecimalWarning(false);
    } else {
      resetForm();
    }
  }, [open, producto]);

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

  const uploadPhoto = async (
    file: File,
  ): Promise<{ publicUrl: string; path: string }> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `producto_${Date.now()}_${Math.random()
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

  const removeStorageObjectByPath = async (path: string | null) => {
    if (!path) return;
    const { error } = await supabase.storage.from(TIENDA_BUCKET).remove([path]);
    if (error) {
      console.error("Error deleting storage object:", error);
    }
  };

  const removeStorageObjectByUrl = async (url: string | null | undefined) => {
    await removeStorageObjectByPath(getStoragePathFromUrl(url));
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      alert("El nombre es requerido");
      return;
    }

    setSaving(true);
    if (selectedFile) setUploading(true);
    let uploadedPath: string | null = null;

    try {
      let fotoUrl: string | null = producto?.foto_url ?? null;

      if (selectedFile) {
        const uploaded = await uploadPhoto(selectedFile);
        fotoUrl = uploaded.publicUrl;
        uploadedPath = uploaded.path;
      }

      const precio = precioSugerido ? parseInt(precioSugerido) : null;

      if (isEdit) {
        const { error } = await supabase
          .from("productos")
          .update({
            nombre: nombre.trim(),
            precio_sugerido: precio,
            foto_url: fotoUrl,
            activo,
          })
          .eq("id", producto.id);

        if (error) throw error;

        if (selectedFile && producto?.foto_url) {
          const previousPhotoPath = getStoragePathFromUrl(producto.foto_url);
          if (previousPhotoPath && previousPhotoPath !== uploadedPath) {
            await removeStorageObjectByPath(previousPhotoPath);
          }
        }
      } else {
        const { error } = await supabase.from("productos").insert({
          nombre: nombre.trim(),
          precio_sugerido: precio,
          foto_url: fotoUrl,
          creado_por: user?.id ?? null,
        });

        if (error) throw error;
      }

      await onSaved();
      onClose();
    } catch (error: any) {
      if (uploadedPath) {
        await removeStorageObjectByPath(uploadedPath);
      }
      console.error("Error saving producto:", error);
      alert(error.message || "Error al guardar el producto");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!producto) return;
    const { count } = await supabase
      .from("producto_ventas")
      .select("id", { count: "exact", head: true })
      .eq("producto_id", producto.id);
    setVentasCount(count ?? 0);
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!producto) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", producto.id);

      if (error) {
        if (error.code === "23503") {
          setConfirmDeleteOpen(false);
          setDeactivateOpen(true);
          return;
        }
        throw error;
      }

      await removeStorageObjectByUrl(producto.foto_url);
      setConfirmDeleteOpen(false);
      await onSaved();
      onClose();
    } catch (error: any) {
      console.error("Error deleting producto:", error);
      alert(error.message || "Error al eliminar el producto");
    } finally {
      setDeleting(false);
    }
  };

  const performDeactivate = async () => {
    if (!producto) return;
    setDeleting(true);
    try {
      const { error: deactivateError } = await supabase
        .from("productos")
        .update({
          activo: false,
          foto_url: null,
        })
        .eq("id", producto.id);
      if (deactivateError) throw deactivateError;
      await removeStorageObjectByUrl(producto.foto_url);
      setDeactivateOpen(false);
      await onSaved();
      onClose();
    } catch (error: any) {
      console.error("Error deactivating producto:", error);
      alert(error.message || "Error al desactivar el producto");
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
                        {isEdit ? "Editar Producto" : "Nuevo Producto"}
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
                            placeholder="Nombre del producto"
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Precio sugerido (₡)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={precioSugerido}
                            onChange={(e) => {
                              setPrecioSugerido(e.target.value);
                              setDecimalWarning(
                                e.target.value.includes(".") ||
                                  e.target.value.includes(","),
                              );
                            }}
                            placeholder="0"
                            className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                          />
                          {decimalWarning && (
                            <p className="mt-1 text-xs text-amber-600">
                              Se guardan solo colones enteros.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Foto del producto
                          </label>
                          {isEdit && producto.foto_url && !selectedFile && (
                            <div className="mb-3">
                              <img
                                src={producto.foto_url}
                                alt={producto.nombre}
                                className="aspect-square w-full object-cover rounded-lg border border-gray-200"
                              />
                            </div>
                          )}
                          {selectedFile && (
                            <div className="mb-3">
                              <img
                                src={URL.createObjectURL(selectedFile)}
                                alt="Vista previa"
                                className="aspect-square w-full object-cover rounded-lg border border-gray-200"
                              />
                            </div>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
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

                        {isEdit && (
                          <div className="border-t border-gray-200 pt-6">
                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={deleting}
                              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <TrashIcon className="size-4" />
                              {deleting ? "Eliminando..." : "Eliminar producto"}
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

      {uploading && (
        <div className="fixed inset-0 z-100 bg-black/80 flex flex-col items-center justify-center">
          <img
            src="/tellos-square.svg"
            alt="Futbol Tello"
            className="w-16 h-16 animate-spin"
          />
          <p className="mt-4 text-white text-lg font-semibold">Futbol Tello</p>
          <p className="mt-2 text-white/70 text-sm">Subiendo foto...</p>
        </div>
      )}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar producto"
        description={
          <>
            ¿Está seguro que desea eliminar
            {producto ? (
              <>
                {" "}<strong>{producto.nombre}</strong>
              </>
            ) : (
              " este producto"
            )}
            ?
          </>
        }
        details={
          ventasCount && ventasCount > 0
            ? `Este producto tiene ${ventasCount} venta(s) asociada(s). Si la base de datos lo bloquea, se ofrecerá desactivarlo en su lugar.`
            : "Esta acción no se puede deshacer."
        }
        confirmLabel={deleting ? "Eliminando..." : "Eliminar"}
        tone="danger"
        loading={deleting}
        onConfirm={performDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
      <ConfirmDialog
        open={deactivateOpen}
        title="Desactivar producto"
        description="Este producto tiene ventas registradas y no se puede eliminar. ¿Desea desactivarlo en su lugar?"
        details="El producto dejará de aparecer en las listas activas pero se conservará el historial de ventas."
        confirmLabel={deleting ? "Desactivando..." : "Desactivar"}
        cancelLabel="Cancelar"
        tone="warning"
        loading={deleting}
        onConfirm={performDeactivate}
        onCancel={() => setDeactivateOpen(false)}
      />
    </Dialog>
  );
}
