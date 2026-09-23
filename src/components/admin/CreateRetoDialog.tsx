import { PhotoIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";

export default function CreateRetoDialog({ open, onClose, onNavigate }: {
  open: boolean; onClose: () => void; onNavigate: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-2xl rounded-2xl bg-white p-6 text-gray-900 shadow-xl">
            <DialogTitle className="text-xl font-semibold text-gray-900">Crea un reto desde Reservaciones</DialogTitle>
            <p className="mt-3 text-sm leading-6 text-gray-600">Crea una reservación, elige la cancha, la fecha y la hora. En el paso de datos del cliente, activa <strong className="text-gray-900">Crear reto</strong> y confirma la reservación. El reto quedará abierto, pendiente del Equipo 2.</p>
            <figure className="mt-5 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-100">
              <figcaption className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-600">
                <PhotoIcon aria-hidden="true" className="size-4" />
                Captura de referencia · No es un formulario
              </figcaption>
              <div className="p-4">
                <img src="/images/crear-reto-reservacion.webp" alt="Captura de referencia: activa Crear reto en el paso de datos de contacto de la reservación." className="pointer-events-none mx-auto max-h-[40vh] w-full select-none rounded-lg border border-gray-200 object-contain shadow-sm" />
              </div>
              <p className="px-4 pb-3 text-xs leading-5 text-gray-500">Paso 2 · Activa el interruptor en el formulario de Reservaciones.</p>
            </figure>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cerrar</button>
              <button onClick={onNavigate} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">Ir a Reservaciones</button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
