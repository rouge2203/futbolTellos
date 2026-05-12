import { type ReactNode } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

export type ConfirmDialogTone = "danger" | "primary" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const TONE_CLASSES: Record<
  ConfirmDialogTone,
  { header: string; button: string; iconWrap: string }
> = {
  danger: {
    header: "bg-red-600",
    button: "bg-red-600 hover:bg-red-500",
    iconWrap: "bg-red-50 text-red-600",
  },
  warning: {
    header: "bg-amber-500",
    button: "bg-amber-500 hover:bg-amber-400",
    iconWrap: "bg-amber-50 text-amber-600",
  },
  primary: {
    header: "bg-primary",
    button: "bg-primary hover:bg-primary/90",
    iconWrap: "bg-primary/10 text-primary",
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const toneClasses = TONE_CLASSES[tone];
  const Icon = tone === "primary" ? InformationCircleIcon : ExclamationTriangleIcon;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onCancel();
      }}
      className="relative z-60"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/70 transition-opacity data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
      />
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel
            transition
            className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
          >
            <div className={`${toneClasses.header} px-4 py-3 flex items-center gap-2`}>
              <Icon className="size-5 text-white" />
              <DialogTitle className="text-base font-semibold text-white">
                {title}
              </DialogTitle>
            </div>
            <div className="p-4 space-y-3">
              {description && (
                <div className="flex items-start gap-3">
                  <div
                    className={`${toneClasses.iconWrap} flex size-9 shrink-0 items-center justify-center rounded-full`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="text-sm text-gray-700">{description}</div>
                </div>
              )}
              {details && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  {details}
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`rounded-md ${toneClasses.button} px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {loading ? "Procesando..." : confirmLabel}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
