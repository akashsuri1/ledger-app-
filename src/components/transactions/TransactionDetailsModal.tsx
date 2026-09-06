import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  FileText,
  MapPin,
  Paperclip,
  Pencil,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";

import { toast } from "sonner";

import Modal from "../ui/Modal";

import { useLedger } from "../../hooks/useLedger";

import { formatCurrency } from "../../utils/currency";

import { formatTransactionDateTime } from "../../utils/dateTime";

interface TransactionDetailsModalProps {
  open: boolean;
  transactionId: number | null;
  onClose: () => void;
  onEdit: (transactionId: number) => void;
  onDelete: (transactionId: number) => void;
}

export default function TransactionDetailsModal({
  open,
  transactionId,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailsModalProps) {
  const {
    transactions,
    parties,
    regions,
  } = useLedger();

  const transaction =
    transactionId === null
      ? undefined
      : transactions.find(
          (item) =>
            item.id === transactionId,
        );

  if (!transaction) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Transaction Details"
      >
        <div className="py-8 text-center">
          <p className="font-medium text-slate-900">
            Transaction not found.
          </p>
        </div>
      </Modal>
    );
  }

  const party = parties.find(
    (item) =>
      item.id === transaction.partyId,
  );

  const region = party
    ? regions.find(
        (item) =>
          item.id === party.regionId,
      )
    : undefined;

  const isCredit =
    transaction.type === "CREDIT";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transaction Details"
      description={`Transaction #${transaction.id}`}
    >
      <div className="space-y-6">
        {/* AMOUNT */}

        <div
          className={`rounded-2xl border p-5 ${
            isCredit
              ? "border-emerald-100 bg-emerald-50"
              : "border-rose-100 bg-rose-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-medium ${
                  isCredit
                    ? "text-emerald-700"
                    : "text-rose-700"
                }`}
              >
                {isCredit
                  ? "Credit"
                  : "Debit"}
              </p>

              <p
                className={`mt-2 text-3xl font-semibold ${
                  isCredit
                    ? "text-emerald-700"
                    : "text-rose-700"
                }`}
              >
                {isCredit ? "+" : "-"}
                {formatCurrency(
                  transaction.amount,
                )}
              </p>
            </div>

            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                isCredit
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {isCredit ? (
                <ArrowUpRight size={22} />
              ) : (
                <ArrowDownLeft size={22} />
              )}
            </div>
          </div>
        </div>

        {/* DETAILS */}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              <User size={14} />
              Party
            </div>

            <p className="mt-2 text-sm font-medium text-slate-900">
              {party?.name ??
                "Unknown party"}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              <MapPin size={14} />
              Region
            </div>

            <p className="mt-2 text-sm font-medium text-slate-900">
              {region?.name ??
                "Unknown region"}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              <CalendarClock size={14} />
              Date & Time
            </div>

            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatTransactionDateTime(
                transaction.transactionDateTime,
              )}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              <FileText size={14} />
              Description
            </div>

            <p className="mt-2 text-sm font-medium text-slate-900">
              {transaction.description}
            </p>
          </div>
        </div>

        {/* NOTES */}

        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <StickyNote size={14} />
            Notes
          </div>

          <div className="mt-2 rounded-xl bg-slate-50 p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {transaction.notes ||
                "No notes added."}
            </p>
          </div>
        </div>

        {/* ATTACHMENT */}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Attachment
          </p>

          {transaction.attachmentName ? (
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "Actual file preview will work after local file storage is connected.",
                  {
                    description:
                      transaction.attachmentName,
                  },
                )
              }
              className="mt-2 flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Paperclip size={18} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {
                    transaction.attachmentName
                  }
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  View attachment
                </p>
              </div>
            </button>
          ) : (
            <div className="mt-2 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
              No attachment
            </div>
          )}
        </div>

        {/* ACTIONS */}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() =>
              onDelete(transaction.id)
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 size={16} />
            Delete
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex-none"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() =>
                onEdit(transaction.id)
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 sm:flex-none"
            >
              <Pencil size={16} />
              Edit
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
