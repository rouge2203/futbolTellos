import { useEffect } from "react";
import { Transition } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/20/solid";

interface SuccessNotificationProps {
  show: boolean;
  onClose: () => void;
  message?: string;
  description?: string;
}

export default function SuccessNotification({
  show,
  onClose,
  message = "Reserva creada",
  description = "La reservación se ha creado exitosamente.",
}: SuccessNotificationProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-[100]"
    >
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        <Transition show={show}>
          <div className="pointer-events-auto w-full max-w-sm rounded-lg bg-white shadow-lg outline-1 outline-black/5 transition data-closed:opacity-0 data-enter:transform data-enter:duration-300 data-enter:ease-out data-closed:data-enter:translate-y-2 data-leave:duration-100 data-leave:ease-in data-closed:data-enter:sm:translate-x-2 data-closed:data-enter:sm:translate-y-0">
            <div className="p-4">
              <div className="flex items-start">
                <div className="shrink-0">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="size-6 text-primary"
                  />
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-gray-900">
                    {message}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{description}</p>
                </div>
                <div className="ml-4 flex shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-primary"
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
  );
}
