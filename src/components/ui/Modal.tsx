import type {
  ReactNode,
} from "react";

import {
  useEffect,
  useId,
  useRef,
} from "react";

import {
  X,
} from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  ariaDescribedBy?: string;
  children: ReactNode;
  onClose: () => void;
}

const FOCUSABLE_ELEMENTS = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
  open,
  title,
  description,
  ariaDescribedBy,
  children,
  onClose,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const preferred = dialog?.querySelector<HTMLElement>(
        "[data-modal-initial-focus], [autofocus]",
      );
      (preferred ?? dialog)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true",
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

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

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={
            ariaDescribedBy ?? (description ? descriptionId : undefined)
          }
          tabIndex={-1}
          className="relative z-10 flex max-h-[calc(100vh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none"
        >
          <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2
                id={titleId}
                className="text-lg font-semibold text-slate-950"
              >
                {title}
              </h2>

              {description && (
                <p
                  id={descriptionId}
                  className="mt-1 text-sm text-slate-500"
                >
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="ml-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={18} aria-hidden="true" />
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
