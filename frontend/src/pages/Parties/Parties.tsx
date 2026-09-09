import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import { toast } from "sonner";

import AddPartyModal from "../../components/parties/AddPartyModal";

import EditPartyModal from "../../components/parties/EditPartyModal";

import ConfirmDialog from "../../components/ui/ConfirmDialog";

import {
  useLedger,
} from "../../hooks/useLedger";

import {
  formatCurrency,
} from "../../utils/currency";
import { paginateItems } from "../../utils/pagination";

export default function Parties() {
  const navigate =
    useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const {
    parties,
    regions,
    transactions,
    deleteParty,
    getPartyBalance,
    getRegionById,
  } = useLedger();

  const [
    search,
    setSearch,
  ] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [
    addPartyOpen,
    setAddPartyOpen,
  ] = useState(false);

  const [
    editPartyId,
    setEditPartyId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    deletePartyId,
    setDeletePartyId,
  ] =
    useState<number | null>(
      null,
    );

  /*
   * Region filter is now reflected
   * in the URL.
   *
   * Example:
   * /parties?region=1
   */

  const selectedRegion =
    searchParams.get(
      "region",
    ) ?? "ALL";

  function changeRegionFilter(
    value: string,
  ) {
    const nextParams =
      new URLSearchParams(
        searchParams,
      );

    if (
      value === "ALL"
    ) {
      nextParams.delete(
        "region",
      );
    } else {
      nextParams.set(
        "region",
        value,
      );
    }

    setSearchParams(
      nextParams,
      {
        replace: true,
      },
    );
    setCurrentPage(1);
  }

  const filteredParties =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return parties.filter(
        (party) => {
          const region =
            getRegionById(
              party.regionId,
            );

          const matchesSearch =
            !query ||
            party.name
              .toLowerCase()
              .includes(query) ||
            party.phone
              .toLowerCase()
              .includes(query) ||
            party.gstin
              .toLowerCase()
              .includes(query) ||
            party.address
              .toLowerCase()
              .includes(query) ||
            party.notes
              .toLowerCase()
              .includes(query) ||
            region?.name
              .toLowerCase()
              .includes(query);

          const matchesRegion =
            selectedRegion ===
              "ALL" ||
            party.regionId ===
              Number(
                selectedRegion,
              );

          return Boolean(
            matchesSearch &&
              matchesRegion,
          );
        },
      );
    }, [
      parties,
      search,
      selectedRegion,
      getRegionById,
    ]);

  const pagination = paginateItems(
    filteredParties,
    currentPage,
    pageSize,
  );
  const paginatedParties = pagination.items;
  const visiblePage = pagination.page;
  const totalPages = pagination.totalPages;
  const firstVisible = pagination.firstVisible;
  const lastVisible = pagination.lastVisible;

  const receivableParties =
    parties.filter(
      (party) =>
        getPartyBalance(
          party.id,
        ) > 0,
    ).length;

  const payableParties =
    parties.filter(
      (party) =>
        getPartyBalance(
          party.id,
        ) < 0,
    ).length;

  const partyToDelete =
    deletePartyId ===
    null
      ? undefined
      : parties.find(
          (party) =>
            party.id ===
            deletePartyId,
        );

  const partyTransactionCount =
    deletePartyId === null
      ? 0
      : transactions.filter(
          (transaction) =>
            transaction.partyId ===
            deletePartyId,
        ).length;

  function handleDeleteParty() {
    if (
      deletePartyId ===
      null
    ) {
      return;
    }

    try {
      deleteParty(
        deletePartyId,
      );

      toast.success(
        partyTransactionCount > 0
          ? "Party and related transactions deleted successfully."
          : "Party deleted successfully.",
      );

      setDeletePartyId(
        null,
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
        {/* HEADER */}

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Directory
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Parties
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage customers and suppliers across different regions.
            </p>
          </div>

          <button
            onClick={() =>
              setAddPartyOpen(
                true,
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus size={17} />

            Add Party
          </button>
        </div>

        {/* SUMMARY */}

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Users
                  size={19}
                />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Total Parties
                </p>

                <p className="text-xl font-semibold text-slate-950">
                  {parties.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Receivable Parties
            </p>

            <p className="mt-1 text-xl font-semibold text-emerald-600">
              {receivableParties}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Payable Parties
            </p>

            <p className="mt-1 text-xl font-semibold text-rose-600">
              {payableParties}
            </p>
          </div>
        </div>

        {/* TABLE */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
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
                placeholder="Search name, notes, phone, GSTIN or region..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <MapPin
                size={17}
                className="text-slate-400"
              />

              <select
                value={
                  selectedRegion
                }
                onChange={(event) =>
                  changeRegionFilter(
                    event.target.value,
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="ALL">
                  All Regions
                </option>

                {regions.map(
                  (region) => (
                    <option
                      key={region.id}
                      value={region.id}
                    >
                      {region.name}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          {filteredParties.length ===
          0 ? (
            <div className="p-14 text-center">
              <Users
                className="mx-auto text-slate-300"
                size={30}
              />

              <p className="mt-4 font-medium text-slate-900">
                No parties found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your search or region filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-4 font-medium">
                      Party
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Region
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Phone
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Balance
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedParties.map(
                    (party) => {
                      const region =
                        getRegionById(
                          party.regionId,
                        );

                      const balance =
                        getPartyBalance(
                          party.id,
                        );

                      return (
                        <tr
                          key={party.id}
                          onClick={() =>
                            navigate(
                              `/parties/${party.id}`,
                            )
                          }
                          className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-slate-900">
                              {party.name}
                            </p>

                            <p className="mt-1 max-w-sm truncate text-xs text-slate-500">
                              {party.notes ||
                                "No notes added"}
                            </p>

                            {party.address && (
                              <p className="mt-0.5 max-w-sm truncate text-xs text-slate-400">
                                {party.address}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {region?.name ??
                              "Unknown"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {party.phone ||
                              "—"}
                          </td>

                          <td
                            className={`px-5 py-4 text-sm font-semibold ${
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
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                balance > 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : balance < 0
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {balance > 0
                                ? "Receivable"
                                : balance < 0
                                  ? "Payable"
                                  : "Settled"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Edit party"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setEditPartyId(
                                    party.id,
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
                                title="Delete party"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setDeletePartyId(
                                    party.id,
                                  );
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2
                                  size={16}
                                />
                              </button>

                              <ChevronRight
                                size={17}
                                className="ml-1 text-slate-400"
                              />
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

          <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-slate-500">
                Showing {firstVisible}-{lastVisible} of{" "}
                {filteredParties.length} filtered ({parties.length} total)
              </p>

              <select
                value={pageSize}
                aria-label="Parties per page"
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous parties page"
                disabled={visiblePage === 1}
                onClick={() =>
                  setCurrentPage(Math.max(1, visiblePage - 1))
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>

              <span className="text-sm text-slate-600">
                Page <strong>{visiblePage}</strong> of{" "}
                <strong>{totalPages}</strong>
              </span>

              <button
                type="button"
                aria-label="Next parties page"
                disabled={visiblePage === totalPages}
                onClick={() =>
                  setCurrentPage(
                    Math.min(totalPages, visiblePage + 1),
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddPartyModal
        open={
          addPartyOpen
        }
        onClose={() =>
          setAddPartyOpen(
            false,
          )
        }
      />

      <EditPartyModal
        open={
          editPartyId !==
          null
        }
        partyId={
          editPartyId
        }
        onClose={() =>
          setEditPartyId(
            null,
          )
        }
      />

      <ConfirmDialog
        open={
          deletePartyId !==
          null
        }
        title="Delete Party?"
        description={
          partyTransactionCount > 0
            ? `${partyToDelete?.name ?? "This party"} has ${partyTransactionCount} ${
                partyTransactionCount === 1
                  ? "transaction"
                  : "transactions"
              }. Deleting this party will also permanently delete ${
                partyTransactionCount === 1
                  ? "the related transaction"
                  : `all ${partyTransactionCount} related transactions`
              }. This action cannot be undone.`
            : `Delete ${partyToDelete?.name ?? "this party"}? This action cannot be undone.`
        }
        confirmLabel={
          partyTransactionCount > 0
            ? `Delete Party & ${partyTransactionCount} ${
                partyTransactionCount === 1
                  ? "Transaction"
                  : "Transactions"
              }`
            : "Delete Party"
        }
        tone="danger"
        onCancel={() =>
          setDeletePartyId(
            null,
          )
        }
        onConfirm={
          handleDeleteParty
        }
      />
    </>
  );
}
