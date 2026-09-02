import Modal from "./Modal";

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
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
    >
      <p className="text-sm leading-6 text-slate-600">
        {description}
      </p>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={onCancel}
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