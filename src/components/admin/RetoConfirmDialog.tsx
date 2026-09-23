import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowPathIcon, ExclamationTriangleIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  tone?: "danger" | "primary";
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function RetoConfirmDialog({
  open, title, description, confirmLabel, busy = false, error,
  tone = "danger", onCancel, onConfirm,
}: Props) {
  const Icon = tone === "danger" ? ExclamationTriangleIcon : CalendarDaysIcon;
  return (
    <Dialog open={open} onClose={() => { if (!busy) onCancel(); }} className="relative z-[60]">
      <DialogBackdrop className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/5">
            <div className="p-6">
              <div className={`mb-4 flex size-11 items-center justify-center rounded-full ${tone === "danger" ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"}`}>
                <Icon aria-hidden="true" className="size-6" />
              </div>
              <DialogTitle className="text-lg font-semibold leading-6 text-gray-900">{title}</DialogTitle>
              <Description className="mt-3 text-sm leading-6 text-gray-600">{description}</Description>
              {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">{error}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button type="button" data-autofocus disabled={busy} onClick={onCancel}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={onConfirm}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${tone === "danger" ? "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600" : "bg-primary hover:bg-primary/90 focus-visible:outline-primary"}`}>
                {busy && <ArrowPathIcon aria-hidden="true" className="size-4 animate-spin" />}
                {busy ? "Procesando…" : confirmLabel}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
