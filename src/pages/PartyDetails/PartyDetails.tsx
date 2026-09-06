import { useState } from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Eye,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Printer,
  StickyNote,
  Trash2,
} from "lucide-react";

import { toast } from "sonner";

import EditPartyModal from "../../components/parties/EditPartyModal";

import TransactionDetailsModal from "../../components/transactions/TransactionDetailsModal";

import EditTransactionModal from "../../components/transactions/EditTransactionModal";

import ConfirmDialog from "../../components/ui/ConfirmDialog";

import {
  useLedger,
} from "../../hooks/useLedger";

import {
  useTransactionModal,
} from "../../hooks/useTransactionModal";

import {
  formatCurrency,
} from "../../utils/currency";

import {
  formatTransactionDateTime,
} from "../../utils/dateTime";

export default function PartyDetails() {
  const navigate =
    useNavigate();

  const { partyId } =
    useParams();

  const {
    parties,
    transactions,
    deleteParty,
    deleteTransaction,
    getPartyBalance,
    getRegionById,
  } = useLedger();

  const {
    openTransactionModal,
  } =
    useTransactionModal();

  const [
    editPartyOpen,
    setEditPartyOpen,
  ] = useState(false);

  const [
    selectedTransactionId,
    setSelectedTransactionId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    editTransactionId,
    setEditTransactionId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    deleteTransactionId,
    setDeleteTransactionId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    deletePartyOpen,
    setDeletePartyOpen,
  ] =
    useState(false);

  const id =
    Number(partyId);

  const party =
    parties.find(
      (item) =>
        item.id === id,
    );

  if (!party) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">
          Party not found
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          The selected party does not exist.
        </p>

        <button
          onClick={() =>
            navigate(
              "/parties",
            )
          }
          className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
        >
          Back to Parties
        </button>
      </div>
    );
  }

  const region =
    getRegionById(
      party.regionId,
    );

  const partyTransactions =
    transactions
      .filter(
        (transaction) =>
          transaction.partyId ===
          party.id,
      )
      .sort(
        (a, b) =>
          new Date(
            b.transactionDateTime,
          ).getTime() -
          new Date(
            a.transactionDateTime,
          ).getTime(),
      );

  const totalCredit =
    partyTransactions
      .filter(
        (transaction) =>
          transaction.type ===
          "CREDIT",
      )
      .reduce(
        (
          total,
          transaction,
        ) =>
          total +
          transaction.amount,
        0,
      );

  const totalDebit =
    partyTransactions
      .filter(
        (transaction) =>
          transaction.type ===
          "DEBIT",
      )
      .reduce(
        (
          total,
          transaction,
        ) =>
          total +
          transaction.amount,
        0,
      );

  const balance =
    getPartyBalance(
      party.id,
    );

  const transactionToDelete =
    deleteTransactionId ===
    null
      ? undefined
      : transactions.find(
          (transaction) =>
            transaction.id ===
            deleteTransactionId,
        );

  function handleDeleteTransaction() {
    if (
      deleteTransactionId ===
      null
    ) {
      return;
    }

    try {
      deleteTransaction(
        deleteTransactionId,
      );

      toast.success(
        "Transaction deleted successfully",
      );

      setDeleteTransactionId(
        null,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to delete transaction.",
      );
    }
  }

  function handleDeleteParty() {
  if (!party) {
    toast.error(
      "Party not found.",
    );

    navigate(
      "/parties",
    );

    return;
  }

  try {
    deleteParty(
      party.id,
    );

    toast.success(
      "Party deleted successfully",
    );

    navigate(
      "/parties",
    );
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Unable to delete party.",
    );
  }
}

  return (
    <>
      <div className="mx-auto max-w-[1600px]">
        {/* BACK */}

        <button
          onClick={() =>
            navigate(
              "/parties",
            )
          }
          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950"
        >
          <ArrowLeft
            size={17}
          />

          Back to Parties
        </button>

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Party Details
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {party.name}
            </h1>

            <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <MapPin
                  size={15}
                />

                {region?.name ??
                  "Unknown"}
              </span>

              {party.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone
                    size={15}
                  />

                  {party.phone}
                </span>
              )}

              {party.gstin && (
                <span className="flex items-center gap-1.5">
                  <Building2
                    size={15}
                  />

                  GSTIN:{" "}
                  {party.gstin}
                </span>
              )}
            </div>

            {party.address && (
              <p className="mt-3 text-sm text-slate-500">
                {party.address}
              </p>
            )}
          </div>

          {/* ACTIONS */}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                setEditPartyOpen(
                  true,
                )
              }
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil
                size={16}
              />

              Edit Party
            </button>

            <button
              onClick={() =>
                openTransactionModal(
                  "CREDIT",
                  party.id,
                )
              }
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <ArrowUpRight
                size={17}
              />

              Add Credit
            </button>

            <button
              onClick={() =>
                openTransactionModal(
                  "DEBIT",
                  party.id,
                )
              }
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              <ArrowDownLeft
                size={17}
              />

              Add Debit
            </button>

            <button
              onClick={() =>
                navigate(
                  `/reports?type=party&party=${party.id}`,
                )
              }
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Printer
                size={17}
              />

              Print Statement
            </button>
          </div>
        </div>

        {/* PARTY NOTES / DESCRIPTION */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <StickyNote
                size={18}
              />
            </div>

            <div>
              <h2 className="font-semibold text-slate-950">
                Notes / Description
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Additional information about this party.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            {party.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {party.notes}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                No notes or description have been added for this party.
              </p>
            )}
          </div>
        </div>

        {/* SUMMARY */}

        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Current Balance
            </p>

            <p
              className={`mt-2 text-2xl font-semibold ${
                balance > 0
                  ? "text-emerald-600"
                  : balance < 0
                    ? "text-rose-600"
                    : "text-slate-700"
              }`}
            >
              {formatCurrency(
                Math.abs(
                  balance,
                ),
              )}
            </p>

            <p className="mt-2 text-xs text-slate-400">
              {balance > 0
                ? "Receivable"
                : balance < 0
                  ? "Payable"
                  : "Settled"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Credit
            </p>

            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {formatCurrency(
                totalCredit,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Debit
            </p>

            <p className="mt-2 text-2xl font-semibold text-rose-600">
              {formatCurrency(
                totalDebit,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Transactions
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {
                partyTransactions.length
              }
            </p>
          </div>
        </div>

        {/* TRANSACTION HISTORY */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-950">
              Transaction History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Click any transaction to view, edit or delete it.
            </p>
          </div>

          {partyTransactions.length ===
          0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-900">
                No transactions yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Add a credit or debit transaction to begin this party's ledger.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-4 font-medium">
                      Date & Time
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Description
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Notes
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Attachment
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Type
                    </th>

                    <th className="px-5 py-4 text-right font-medium">
                      Amount
                    </th>

                    <th className="px-5 py-4 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {partyTransactions.map(
                    (transaction) => {
                      const isCredit =
                        transaction.type ===
                        "CREDIT";

                      return (
                        <tr
                          key={
                            transaction.id
                          }
                          onClick={() =>
                            setSelectedTransactionId(
                              transaction.id,
                            )
                          }
                          className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                            {formatTransactionDateTime(
                              transaction.transactionDateTime,
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-slate-900">
                              {
                                transaction.description
                              }
                            </p>
                          </td>

                          <td className="max-w-xs px-5 py-4">
                            <p className="truncate text-sm text-slate-500">
                              {transaction.notes ||
                                "—"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            {transaction.attachmentName ? (
                              <div className="flex max-w-[170px] items-center gap-1.5 text-sm text-blue-600">
                                <Paperclip
                                  size={14}
                                />

                                <span className="truncate">
                                  {
                                    transaction.attachmentName
                                  }
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                isCredit
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {isCredit
                                ? "Credit"
                                : "Debit"}
                            </span>
                          </td>

                          <td
                            className={`whitespace-nowrap px-5 py-4 text-right text-sm font-semibold ${
                              isCredit
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {isCredit
                              ? "+"
                              : "-"}

                            {formatCurrency(
                              transaction.amount,
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="View transaction"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setSelectedTransactionId(
                                    transaction.id,
                                  );
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Eye
                                  size={16}
                                />
                              </button>

                              <button
                                type="button"
                                title="Edit transaction"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setEditTransactionId(
                                    transaction.id,
                                  );
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Pencil
                                  size={16}
                                />
                              </button>

                              <button
                                type="button"
                                title="Delete transaction"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setDeleteTransactionId(
                                    transaction.id,
                                  );
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2
                                  size={16}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PARTY INFORMATION */}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">
              Party Information
            </h2>

            <dl className="mt-5 space-y-4">
              <div className="flex justify-between gap-4">
                <dt className="text-sm text-slate-500">
                  Name
                </dt>

                <dd className="text-right text-sm font-medium text-slate-900">
                  {party.name}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-sm text-slate-500">
                  Region
                </dt>

                <dd className="text-right text-sm font-medium text-slate-900">
                  {region?.name ??
                    "—"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-sm text-slate-500">
                  Phone
                </dt>

                <dd className="text-right text-sm font-medium text-slate-900">
                  {party.phone ||
                    "—"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-sm text-slate-500">
                  GSTIN
                </dt>

                <dd className="text-right text-sm font-medium text-slate-900">
                  {party.gstin ||
                    "—"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-sm text-slate-500">
                  Address
                </dt>

                <dd className="max-w-sm text-right text-sm font-medium text-slate-900">
                  {party.address ||
                    "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">
              Ledger Summary
            </h2>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Credit
                </span>

                <span className="font-semibold text-emerald-600">
                  {formatCurrency(
                    totalCredit,
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Debit
                </span>

                <span className="font-semibold text-rose-600">
                  {formatCurrency(
                    totalDebit,
                  )}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    Balance
                  </span>

                  <span
                    className={`font-semibold ${
                      balance > 0
                        ? "text-emerald-600"
                        : balance < 0
                          ? "text-rose-600"
                          : "text-slate-600"
                    }`}
                  >
                    {formatCurrency(
                      Math.abs(
                        balance,
                      ),
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DANGER ZONE */}

        <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
          <h3 className="text-sm font-semibold text-rose-700">
            Delete Party
          </h3>

          <p className="mt-1 text-sm text-rose-600">
            A party with transaction history cannot be deleted until its transactions are removed.
          </p>

          <button
            onClick={() =>
              setDeletePartyOpen(
                true,
              )
            }
            className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2
              size={16}
            />

            Delete Party
          </button>
        </div>
      </div>

      {/* EDIT PARTY */}

      <EditPartyModal
        open={
          editPartyOpen
        }
        partyId={
          party.id
        }
        onClose={() =>
          setEditPartyOpen(
            false,
          )
        }
      />

      {/* TRANSACTION DETAILS */}

      <TransactionDetailsModal
        open={
          selectedTransactionId !==
          null
        }
        transactionId={
          selectedTransactionId
        }
        onClose={() =>
          setSelectedTransactionId(
            null,
          )
        }
        onEdit={(transactionId) => {
          setSelectedTransactionId(
            null,
          );

          setEditTransactionId(
            transactionId,
          );
        }}
        onDelete={(transactionId) => {
          setSelectedTransactionId(
            null,
          );

          setDeleteTransactionId(
            transactionId,
          );
        }}
      />

      {/* EDIT TRANSACTION */}

      <EditTransactionModal
        open={
          editTransactionId !==
          null
        }
        transactionId={
          editTransactionId
        }
        onClose={() =>
          setEditTransactionId(
            null,
          )
        }
      />

      {/* DELETE TRANSACTION */}

      <ConfirmDialog
        open={
          deleteTransactionId !==
          null
        }
        title="Delete Transaction?"
        description={
          transactionToDelete
            ? `Delete the ${transactionToDelete.type.toLowerCase()} transaction of ${formatCurrency(
                transactionToDelete.amount,
              )}? This action cannot be undone.`
            : "Delete this transaction?"
        }
        confirmLabel="Delete Transaction"
        tone="danger"
        onCancel={() =>
          setDeleteTransactionId(
            null,
          )
        }
        onConfirm={
          handleDeleteTransaction
        }
      />

      {/* DELETE PARTY */}

      <ConfirmDialog
        open={
          deletePartyOpen
        }
        title="Delete Party?"
        description={
          partyTransactions.length >
          0
            ? `${party.name} has ${partyTransactions.length} transaction(s). Delete those transactions before deleting this party.`
            : `Delete ${party.name}? This action cannot be undone.`
        }
        confirmLabel="Delete Party"
        tone="danger"
        onCancel={() =>
          setDeletePartyOpen(
            false,
          )
        }
        onConfirm={
          handleDeleteParty
        }
      />
    </>
  );
}
