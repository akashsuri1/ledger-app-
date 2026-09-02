import type {
  ReactNode,
} from "react";

import {
  X,
} from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export default function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="fixed inset-0"
          onClick={onClose}
        />

        <div className="relative z-10 flex max-h-[calc(100vh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {title}
              </h2>

              {description && (
                <p className="mt-1 text-sm text-slate-500">
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="ml-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}