import Modal from "./Modal";

import {
  useId,
} from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "normal";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "normal",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const descriptionId = useId();

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      ariaDescribedBy={descriptionId}
    >
      <p
        id={descriptionId}
        className="break-all text-sm leading-6 text-slate-600"
      >
        {description}
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          data-modal-initial-focus
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {cancelLabel}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-xl px-5 py-2.5 text-sm font-medium text-white transition ${
            tone === "danger"
              ? "bg-rose-600 hover:bg-rose-700"
              : "bg-slate-950 hover:bg-slate-800"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
