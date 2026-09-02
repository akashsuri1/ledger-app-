import {
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  Paperclip,
} from "lucide-react";

import {
  toast,
} from "sonner";

import Modal from "../ui/Modal";

import {
  useLedger,
} from "../../context/LedgerContext";

interface AddTransactionModalProps {
  open: boolean;

  onClose: () => void;

  defaultType?:
    | "CREDIT"
    | "DEBIT";

  defaultPartyId?: number;
}

export default function AddTransactionModal({
  open,
  onClose,
  defaultType = "CREDIT",
  defaultPartyId,
}: AddTransactionModalProps) {
  const {
    parties,
    regions,
    addTransaction,
  } = useLedger();

  const [
    partyId,
    setPartyId,
  ] =
    useState(
      defaultPartyId
        ? defaultPartyId.toString()
        : "",
    );

  const [
    type,
    setType,
  ] =
    useState<
      "CREDIT" | "DEBIT"
    >(defaultType);

  const [
    amount,
    setAmount,
  ] =
    useState("");

  const [
    transactionDateTime,
    setTransactionDateTime,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    attachmentName,
    setAttachmentName,
  ] =
    useState("");

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!partyId) {
      toast.error(
        "Please select a party.",
      );
      return;
    }

    if (
      !amount ||
      Number(amount) <= 0
    ) {
      toast.error(
        "Enter a valid amount.",
      );
      return;
    }

    if (
      !transactionDateTime
    ) {
      toast.error(
        "Please select the transaction date and time.",
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
      /*
       * datetime-local usually gives:
       *
       * 2026-08-24T13:15
       *
       * We normalize it to:
       *
       * 2026-08-24T13:15:00
       */
      const normalizedDateTime =
        transactionDateTime.length ===
        16
          ? `${transactionDateTime}:00`
          : transactionDateTime;

      const transaction =
        addTransaction({
          partyId:
            Number(partyId),

          type,

          amount:
            Number(amount),

          transactionDateTime:
            normalizedDateTime,

          description:
            description.trim(),

          notes:
            notes.trim(),

          attachmentName:
            attachmentName ||
            undefined,
        });

      const party =
        parties.find(
          (item) =>
            item.id ===
            transaction.partyId,
        );

      toast.success(
        `${
          type === "CREDIT"
            ? "Credit"
            : "Debit"
        } added successfully`,
        {
          description:
            party
              ? `${party.name} — ₹${transaction.amount.toLocaleString(
                  "en-IN",
                )}`
              : undefined,
        },
      );

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save transaction.",
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Transaction"
      description="Record credit or debit activity."
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
            onChange={(
              event,
            ) =>
              setPartyId(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="">
              Select Party
            </option>

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
                    key={
                      party.id
                    }
                    value={
                      party.id
                    }
                  >
                    {
                      party.name
                    }{" "}
                    —{" "}
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
                setType(
                  "CREDIT",
                )
              }
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                type ===
                "CREDIT"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Credit
            </button>

            <button
              type="button"
              onClick={() =>
                setType(
                  "DEBIT",
                )
              }
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                type ===
                "DEBIT"
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
            step="0.01"
            value={amount}
            onChange={(
              event,
            ) =>
              setAmount(
                event.target.value,
              )
            }
            placeholder="₹ 0"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* DATE + TIME */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Date & Time *
          </label>

          <input
            type="datetime-local"
            value={
              transactionDateTime
            }
            onChange={(
              event,
            ) =>
              setTransactionDateTime(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />

          <p className="mt-2 text-xs text-slate-400">
            Enter the actual date and time of this transaction.
          </p>
        </div>

        {/* DESCRIPTION */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Description *
          </label>

          <input
            value={
              description
            }
            onChange={(
              event,
            ) =>
              setDescription(
                event.target.value,
              )
            }
            placeholder="Invoice, payment, purchase..."
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* ATTACHMENT */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Bill / Attachment
          </label>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 transition hover:border-slate-400 hover:bg-slate-100">
            <Paperclip
              size={17}
            />

            {attachmentName ||
              "Choose bill or document"}

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
                  setAttachmentName(
                    file.name,
                  );

                  toast.success(
                    "Attachment selected",
                    {
                      description:
                        file.name,
                    },
                  );
                }
              }}
            />
          </label>

          <p className="mt-2 text-xs text-slate-400">
            The filename is stored for now. The actual file will be stored locally when we connect the backend.
          </p>
        </div>

        {/* NOTES */}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Notes
          </label>

          <textarea
            value={notes}
            onChange={(
              event,
            ) =>
              setNotes(
                event.target.value,
              )
            }
            rows={3}
            placeholder="Optional transaction notes..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        {/* ACTIONS */}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save Transaction
          </button>
        </div>
      </form>
    </Modal>
  );
}