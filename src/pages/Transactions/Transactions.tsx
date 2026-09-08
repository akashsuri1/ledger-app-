import {
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";

import { toast } from "sonner";

import {
  useLedger,
} from "../../hooks/useLedger";

import {
  useTransactionModal,
} from "../../hooks/useTransactionModal";

import TransactionDetailsModal from "../../components/transactions/TransactionDetailsModal";

import EditTransactionModal from "../../components/transactions/EditTransactionModal";

import ConfirmDialog from "../../components/ui/ConfirmDialog";

import {
  formatCurrency,
} from "../../utils/currency";

import {
  formatTransactionDateTime,
} from "../../utils/dateTime";
import { paginateItems } from "../../utils/pagination";

type TransactionTypeFilter =
  | "ALL"
  | "CREDIT"
  | "DEBIT";

function TransactionsWorkspace() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const {
    transactions,
    parties,
    regions,
    deleteTransaction,
  } = useLedger();

  const {
    openTransactionModal,
  } = useTransactionModal();

  const [search, setSearch] =
    useState("");

  const [
    partyFilter,
    setPartyFilter,
  ] = useState("ALL");

  const [
    regionFilter,
    setRegionFilter,
  ] = useState("ALL");

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState<TransactionTypeFilter>(
      "ALL",
    );

  const [
    fromDate,
    setFromDate,
  ] = useState("");

  const [
    toDate,
    setToDate,
  ] = useState("");

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(10);

  const [
    selectedTransactionId,
    setSelectedTransactionId,
  ] =
    useState<number | null>(
      () => {
        const value = Number(
          searchParams.get("transaction"),
        );

        return Number.isSafeInteger(value) &&
          value > 0 &&
          transactions.some(
            (transaction) => transaction.id === value,
          )
          ? value
          : null;
      },
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

  /*
   * SUMMARY
   */

  const totalCredit =
    useMemo(() => {
      return transactions
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
    }, [transactions]);

  const totalDebit =
    useMemo(() => {
      return transactions
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
    }, [transactions]);

  const net =
    totalCredit -
    totalDebit;

  /*
   * SEARCH + FILTERING
   */

  const filteredTransactions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return [
        ...transactions,
      ]
        .sort(
          (a, b) =>
            new Date(
              b.transactionDateTime,
            ).getTime() -
            new Date(
              a.transactionDateTime,
            ).getTime(),
        )
        .filter(
          (transaction) => {
            const party =
              parties.find(
                (item) =>
                  item.id ===
                  transaction.partyId,
              );

            const region =
              party
                ? regions.find(
                    (item) =>
                      item.id ===
                      party.regionId,
                  )
                : undefined;

            const transactionDate =
              transaction.transactionDateTime.slice(
                0,
                10,
              );

            const matchesSearch =
              !query ||
              party?.name
                .toLowerCase()
                .includes(query) ||
              transaction.description
                .toLowerCase()
                .includes(query) ||
              transaction.notes
                .toLowerCase()
                .includes(query) ||
              transaction.attachmentName
                ?.toLowerCase()
                .includes(query) ||
              region?.name
                .toLowerCase()
                .includes(query);

            const matchesParty =
              partyFilter ===
                "ALL" ||
              transaction.partyId ===
                Number(
                  partyFilter,
                );

            const matchesRegion =
              regionFilter ===
                "ALL" ||
              party?.regionId ===
                Number(
                  regionFilter,
                );

            const matchesType =
              typeFilter ===
                "ALL" ||
              transaction.type ===
                typeFilter;

            const matchesFrom =
              !fromDate ||
              transactionDate >=
                fromDate;

            const matchesTo =
              !toDate ||
              transactionDate <=
                toDate;

            return Boolean(
              matchesSearch &&
                matchesParty &&
                matchesRegion &&
                matchesType &&
                matchesFrom &&
                matchesTo,
            );
          },
        );
    }, [
      transactions,
      parties,
      regions,
      search,
      partyFilter,
      regionFilter,
      typeFilter,
      fromDate,
      toDate,
    ]);

  const pagination = paginateItems(
    filteredTransactions,
    currentPage,
    pageSize,
  );
  const paginatedTransactions = pagination.items;
  const visiblePage = pagination.page;
  const totalPages = pagination.totalPages;
  const firstVisible = pagination.firstVisible;
  const lastVisible = pagination.lastVisible;

  /*
   * DELETE INFO
   */

  const transactionToDelete =
    deleteTransactionId ===
    null
      ? undefined
      : transactions.find(
          (transaction) =>
            transaction.id ===
            deleteTransactionId,
        );

  const deleteParty =
    transactionToDelete
      ? parties.find(
          (party) =>
            party.id ===
            transactionToDelete.partyId,
        )
      : undefined;

  /*
   * HELPERS
   */

  function clearFilters() {
    setSearch("");
    setPartyFilter("ALL");
    setRegionFilter("ALL");
    setTypeFilter("ALL");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  }

  function closeTransactionDetails() {
    setSelectedTransactionId(
      null,
    );

    const nextParams =
      new URLSearchParams(
        searchParams,
      );

    nextParams.delete(
      "transaction",
    );

    setSearchParams(
      nextParams,
      {
        replace: true,
      },
    );
  }

  function handleDelete() {
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

  return (
    <>
      <div className="mx-auto max-w-[1600px]">
        {/* HEADER */}

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Ledger
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Transactions
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Search, filter and manage all credit and debit entries.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              openTransactionModal(
                "CREDIT",
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus size={17} />
            Add Transaction
          </button>
        </div>

        {/* SUMMARY */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <WalletCards
                  size={19}
                />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Transactions
                </p>

                <p className="text-xl font-semibold text-slate-950">
                  {
                    transactions.length
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Total Credit
            </p>

            <p className="mt-1 text-xl font-semibold text-emerald-600">
              {formatCurrency(
                totalCredit,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Total Debit
            </p>

            <p className="mt-1 text-xl font-semibold text-rose-600">
              {formatCurrency(
                totalDebit,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Net
            </p>

            <p
              className={`mt-1 text-xl font-semibold ${
                net >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {formatCurrency(
                Math.abs(net),
              )}
            </p>
          </div>
        </div>

        {/* TRANSACTION CARD */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* SEARCH */}

          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value,
                    );
                    setCurrentPage(1);
                  }}
                  placeholder="Search party, description, notes, attachment or region..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <RotateCcw
                  size={16}
                />

                Clear Filters
              </button>
            </div>

            {/* FILTERS */}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Filter
                    size={13}
                  />
                  Party
                </label>

                <select
                  value={
                    partyFilter
                  }
                  onChange={(event) => {
                    setPartyFilter(
                      event.target.value,
                    );
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="ALL">
                    All Parties
                  </option>

                  {parties.map(
                    (party) => (
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
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Region
                </label>

                <select
                  value={
                    regionFilter
                  }
                  onChange={(event) => {
                    setRegionFilter(
                      event.target.value,
                    );
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="ALL">
                    All Regions
                  </option>

                  {regions.map(
                    (region) => (
                      <option
                        key={
                          region.id
                        }
                        value={
                          region.id
                        }
                      >
                        {
                          region.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Type
                </label>

                <select
                  value={
                    typeFilter
                  }
                  onChange={(event) => {
                    setTypeFilter(
                      event.target.value as TransactionTypeFilter,
                    );
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="ALL">
                    All Types
                  </option>

                  <option value="CREDIT">
                    Credit
                  </option>

                  <option value="DEBIT">
                    Debit
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  From Date
                </label>

                <input
                  type="date"
                  value={
                    fromDate
                  }
                  onChange={(event) => {
                    setFromDate(
                      event.target.value,
                    );
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  To Date
                </label>

                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(
                      event.target.value,
                    );
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                />
              </div>
            </div>
          </div>

          {/* EMPTY STATE */}

          {filteredTransactions.length ===
          0 ? (
            <div className="p-14 text-center">
              <WalletCards
                size={32}
                className="mx-auto text-slate-300"
              />

              <p className="mt-4 font-medium text-slate-900">
                No transactions found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            /* TABLE */

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-4 font-medium">
                      Date & Time
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Party
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Region
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Description
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Type
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Attachment
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
                  {paginatedTransactions.map(
                    (transaction) => {
                      const party =
                        parties.find(
                          (item) =>
                            item.id ===
                            transaction.partyId,
                        );

                      const region =
                        party
                          ? regions.find(
                              (item) =>
                                item.id ===
                                party.regionId,
                            )
                          : undefined;

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
                              {party?.name ??
                                "Unknown"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-500">
                            {region?.name ??
                              "Unknown"}
                          </td>

                          <td className="max-w-xs px-5 py-4">
                            <p className="truncate text-sm text-slate-700">
                              {
                                transaction.description
                              }
                            </p>

                            {transaction.notes && (
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                {
                                  transaction.notes
                                }
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                isCredit
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {isCredit ? (
                                <ArrowUpRight
                                  size={13}
                                />
                              ) : (
                                <ArrowDownLeft
                                  size={13}
                                />
                              )}

                              {isCredit
                                ? "Credit"
                                : "Debit"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {transaction.attachmentName ? (
                              <div className="flex max-w-[150px] items-center gap-1.5 text-sm text-blue-600">
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
                              <span className="text-slate-300">
                                —
                              </span>
                            )}
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
                                aria-label="View transaction"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setSelectedTransactionId(
                                    transaction.id,
                                  );
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Eye size={17} />
                              </button>

                              <button
                                type="button"
                                title="Edit transaction"
                                aria-label="Edit transaction"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setEditTransactionId(
                                    transaction.id,
                                  );
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Pencil size={17} />
                              </button>

                              <button
                                type="button"
                                title="Delete transaction"
                                aria-label="Delete transaction"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setDeleteTransactionId(
                                    transaction.id,
                                  );
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={17} />
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

          {/* PAGINATION */}

          <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500">
                Showing{" "}
                {firstVisible}–
                {lastVisible} of{" "}
                {
                  filteredTransactions.length
                }
              </p>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(
                    Number(
                      event.target.value,
                    ),
                  );
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 outline-none"
              >
                <option value={10}>
                  10 per page
                </option>

                <option value={25}>
                  25 per page
                </option>

                <option value={50}>
                  50 per page
                </option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={
                  visiblePage === 1
                }
                onClick={() =>
                  setCurrentPage(
                    Math.max(1, visiblePage - 1),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft
                  size={16}
                />
              </button>

              <span className="text-sm text-slate-600">
                Page{" "}
                <strong>
                  {visiblePage}
                </strong>{" "}
                of{" "}
                <strong>
                  {totalPages}
                </strong>
              </span>

              <button
                type="button"
                disabled={
                  visiblePage ===
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    Math.min(totalPages, visiblePage + 1),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight
                  size={16}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TRANSACTION DETAILS */}

      <TransactionDetailsModal
        open={
          selectedTransactionId !==
          null
        }
        transactionId={
          selectedTransactionId
        }
        onClose={
          closeTransactionDetails
        }
        onEdit={(transactionId) => {
          closeTransactionDetails();

          setEditTransactionId(
            transactionId,
          );
        }}
        onDelete={(transactionId) => {
          closeTransactionDetails();

          setDeleteTransactionId(
            transactionId,
          );
        }}
      />

      {/* EDIT */}

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

      {/* DELETE */}

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
              )}${
                deleteParty
                  ? ` for ${deleteParty.name}`
                  : ""
              }? This action cannot be undone.`
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
          handleDelete
        }
      />
    </>
  );
}

export default function Transactions() {
  const [searchParams] = useSearchParams();

  return (
    <TransactionsWorkspace
      key={searchParams.get("transaction") ?? "transaction-list"}
    />
  );
}
