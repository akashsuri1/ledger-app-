import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";

import { toast } from "sonner";

import Modal from "../ui/Modal";

import { useLedger } from "../../hooks/useLedger";

import { transactionApi } from "../../api/transactionApi";

import { mapTransactionDto } from "../../api/mappers";

import type { LedgerTransaction } from "../../types";

interface EditTransactionModalProps {
  open: boolean;
  transactionId: number | null;
  onClose: () => void;
}

function EditTransactionModalContent({
  open,
  transactionId,
  onClose,
  transactionOverride,
}: EditTransactionModalContentProps) {
  const {
    transactions,
    parties,
    regions,
    updateTransaction,
    deleteAttachment,
  } = useLedger();

  const transaction = transactionOverride ??
    (transactionId === null
      ? undefined
      : transactions.find(
          (item) =>
            item.id === transactionId,
        ));

  const [partyId, setPartyId] =
    useState(
      transaction?.partyId.toString() ?? "",
    );

  const [type, setType] =
    useState<
      "CREDIT" | "DEBIT"
    >(transaction?.type ?? "CREDIT");

  const [amount, setAmount] =
    useState(
      transaction?.amount.toString() ?? "",
    );

  const [
    transactionDate,
    setTransactionDate,
  ] = useState(
    transaction?.transactionDate ?? "",
  );

  const [
    description,
    setDescription,
  ] = useState(
    transaction?.description ?? "",
  );

  const [notes, setNotes] =
    useState(transaction?.notes ?? "");

  const [
    attachmentName,
    setAttachmentName,
  ] = useState(
    transaction?.attachmentName ?? "",
  );
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!transaction) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Edit Transaction"
      >
        <p className="py-8 text-center text-sm text-slate-500">
          Transaction not found.
        </p>
      </Modal>
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!transaction) {
      toast.error(
        "Transaction not found.",
      );
      onClose();
      return;
    }

    if (!partyId) {
      toast.error(
        "Please select a party.",
      );
      return;
    }

    if (!amount || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0) {
      toast.error(
        "Enter a valid amount.",
      );
      return;
    }

    if (
      !transactionDate
    ) {
      toast.error(
        "Date is required.",
      );
      return;
    }

    if (
      !description.trim()
    ) {
      toast.error(
        "Description is required.",
      );
      return;
    }

    try {
      setSubmitting(true);
      await updateTransaction(
        transaction.id,
        {
          partyId:
            Number(partyId),

          type,

          amount:
            Number(amount),

          transactionDate,

          description:
            description.trim(),

          notes:
            notes.trim(),

          attachmentName:
            attachmentName ||
            undefined,
          attachmentFile: attachmentFile ?? undefined,
        },
      );

      if (transaction.attachmentName && !attachmentName && !attachmentFile) await deleteAttachment(transaction.id);

      toast.success(
        "Transaction updated successfully",
      );
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update transaction.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Transaction"
      description={`Transaction #${transaction.id}`}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* PARTY */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Party *
          </label>

          <select
            value={partyId}
            onChange={(event) =>
              setPartyId(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="">
              Select Party
            </option>

            {!parties.some((party) => party.id === transaction.partyId) && (
              <option value={transaction.partyId}>
                {transaction.partyName ?? `Party #${transaction.partyId}`} — {transaction.regionName ?? "Unknown"}
              </option>
            )}

            {parties.map(
              (party) => {
                const region =
                  regions.find(
                    (item) =>
                      item.id ===
                      party.regionId,
                  );

                return (
                  <option
                    key={party.id}
                    value={party.id}
                  >
                    {party.name} —{" "}
                    {region?.name ??
                      "Unknown"}
                  </option>
                );
              },
            )}
          </select>
        </div>

        {/* TYPE */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Transaction Type *
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                setType("CREDIT")
              }
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                type === "CREDIT"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Credit
            </button>

            <button
              type="button"
              onClick={() =>
                setType("DEBIT")
              }
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                type === "DEBIT"
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Debit
            </button>
          </div>
        </div>

        {/* AMOUNT */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Amount *
          </label>

          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) =>
              setAmount(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* DATE */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Date *
          </label>

          <input
            type="date"
            value={
              transactionDate
            }
            onChange={(event) =>
              setTransactionDate(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* DESCRIPTION */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Description *
          </label>

          <input
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* NOTES */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Notes
          </label>

          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            rows={3}
            placeholder="Optional transaction notes..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* ATTACHMENT */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Attachment
          </label>

          {attachmentName ? (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Paperclip
                    size={18}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {attachmentName}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Current attachment
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                  <Upload size={14} />
                  Replace

                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(
                      event,
                    ) => {
                      const file =
                        event.target
                          .files?.[0];

                      if (file) {
                        setAttachmentFile(file);
                        setAttachmentName(
                          file.name,
                        );
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    (setAttachmentName(""), setAttachmentFile(null))
                  }
                  className="flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 transition hover:bg-slate-100">
              <Upload size={17} />
              Add attachment

              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(
                  event,
                ) => {
                  const file =
                    event.target
                      .files?.[0];

                  if (file) {
                    setAttachmentFile(file);
                    setAttachmentName(
                      file.name,
                    );
                  }
                }}
              />
            </label>
          )}

          <p className="mt-2 text-xs text-slate-400">
            PDF and image files are stored by the backend with this transaction.
          </p>
        </div>

        {/* ACTIONS */}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface EditTransactionModalContentProps extends EditTransactionModalProps {
  transactionOverride?: LedgerTransaction;
}

export default function EditTransactionModal(
  props: EditTransactionModalProps,
) {
  const { activeCompanyId, transactions } = useLedger();
  const requestKey = `${activeCompanyId}:${props.transactionId ?? "none"}`;
  const [remoteTransaction, setRemoteTransaction] = useState<{ key: string; value: LedgerTransaction } | null>(null);
  const [loadState, setLoadState] = useState<{ key: string; loading: boolean; error: string | null }>({ key: requestKey, loading: false, error: null });
  const cachedTransaction = props.transactionId === null
    ? undefined
    : transactions.find((item) => item.id === props.transactionId);

  useEffect(() => {
    if (!props.open || props.transactionId === null) return;
    const controller = new AbortController();
    queueMicrotask(() => setLoadState({ key: requestKey, loading: true, error: null }));
    transactionApi.get(activeCompanyId, props.transactionId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setRemoteTransaction({ key: requestKey, value: mapTransactionDto(value) });
          setLoadState({ key: requestKey, loading: false, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadState({ key: requestKey, loading: false, error: cause instanceof Error ? cause.message : "Unable to load this transaction." });
      });
    return () => controller.abort();
  }, [activeCompanyId, props.open, props.transactionId, requestKey]);

  const currentRemote = remoteTransaction?.key === requestKey ? remoteTransaction.value : undefined;
  const loading = loadState.key === requestKey ? loadState.loading : props.open;
  const loadError = loadState.key === requestKey ? loadState.error : null;
  const transaction = currentRemote ?? cachedTransaction;
  if (props.open && !transaction) {
    return (
      <Modal open={props.open} onClose={props.onClose} title="Edit Transaction">
        <p className="py-8 text-center text-sm text-slate-500">
          {loading ? "Loading transaction..." : loadError ?? "Transaction not found."}
        </p>
      </Modal>
    );
  }

  return (
    <EditTransactionModalContent
      key={`${props.transactionId ?? "no-transaction"}-${currentRemote ? "remote" : "cached"}`}
      {...props}
      transactionOverride={transaction}
    />
  );
}
