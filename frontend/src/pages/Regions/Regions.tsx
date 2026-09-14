import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  ArrowRight,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import {
  toast,
} from "sonner";

import RegionModal from "../../components/regions/RegionModal";

import ConfirmDialog from "../../components/ui/ConfirmDialog";

import {
  useLedger,
} from "../../hooks/useLedger";

import {
  formatCurrency,
} from "../../utils/currency";

export default function Regions() {
  const navigate =
    useNavigate();

  const {
    regions,
    parties,
    deleteRegion,
    canWrite,
    getPartyBalance,
  } = useLedger();

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    regionModalOpen,
    setRegionModalOpen,
  ] = useState(false);

  const [
    editRegionId,
    setEditRegionId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    deleteRegionId,
    setDeleteRegionId,
  ] =
    useState<number | null>(
      null,
    );

  /*
   * Calculate statistics for
   * every region.
   */
  const regionRows =
    useMemo(() => {
      return regions.map(
        (region) => {
          const regionParties =
            parties.filter(
              (party) =>
                party.regionId ===
                region.id,
            );

          let receivable = 0;
          let payable = 0;

          regionParties.forEach(
            (party) => {
              const balance =
                getPartyBalance(
                  party.id,
                );

              if (balance > 0) {
                receivable +=
                  balance;
              }

              if (balance < 0) {
                payable +=
                  Math.abs(
                    balance,
                  );
              }
            },
          );

          return {
            ...region,

            partyCount:
              regionParties.length,

            receivable,

            payable,

            net:
              receivable -
              payable,
          };
        },
      );
    }, [
      regions,
      parties,
      getPartyBalance,
    ]);

  const filteredRegions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return regionRows;
      }

      return regionRows.filter(
        (region) =>
          region.name
            .toLowerCase()
            .includes(query),
      );
    }, [
      regionRows,
      search,
    ]);

  /*
   * Overall statistics.
   */

  const totalReceivable =
    regionRows.reduce(
      (
        total,
        region,
      ) =>
        total +
        region.receivable,
      0,
    );

  const totalPayable =
    regionRows.reduce(
      (
        total,
        region,
      ) =>
        total +
        region.payable,
      0,
    );

  const regionToDelete =
    deleteRegionId ===
    null
      ? undefined
      : regionRows.find(
          (region) =>
            region.id ===
            deleteRegionId,
        );

  function openAddRegion() {
    setEditRegionId(null);

    setRegionModalOpen(
      true,
    );
  }

  function openEditRegion(
    regionId: number,
  ) {
    setEditRegionId(
      regionId,
    );

    setRegionModalOpen(
      true,
    );
  }

  function closeRegionModal() {
    setRegionModalOpen(
      false,
    );

    setEditRegionId(null);
  }

  async function handleDeleteRegion() {
    if (
      deleteRegionId ===
      null
    ) {
      return;
    }

    try {
      await deleteRegion(
        deleteRegionId,
      );

      toast.success(
        "Region deleted successfully",
      );

      setDeleteRegionId(
        null,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to delete region.",
      );
    }
  }

  return (
    <>
      <div className="mx-auto max-w-[1600px]">
        {/* PAGE HEADER */}

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Organization
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Regions
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Organize parties geographically and track balances by region.
            </p>
          </div>

          {canWrite && <button
            type="button"
            onClick={
              openAddRegion
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus size={17} />

            Add Region
          </button>}
        </div>

        {/* SUMMARY */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <MapPin size={19} />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Total Regions
                </p>

                <p className="text-xl font-semibold text-slate-950">
                  {regions.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Users size={19} />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Assigned Parties
                </p>

                <p className="text-xl font-semibold text-slate-950">
                  {parties.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Total Receivable
            </p>

            <p className="mt-1 text-xl font-semibold text-emerald-600">
              {formatCurrency(
                totalReceivable,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Total Payable
            </p>

            <p className="mt-1 text-xl font-semibold text-rose-600">
              {formatCurrency(
                totalPayable,
              )}
            </p>
          </div>
        </div>

        {/* REGIONS CARD */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="relative max-w-md">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search regions..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>
          </div>

          {filteredRegions.length ===
          0 ? (
            <div className="p-14 text-center">
              <MapPin
                size={32}
                className="mx-auto text-slate-300"
              />

              <p className="mt-4 font-medium text-slate-900">
                No regions found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Add a region or change your search.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-4 font-medium">
                      Region
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Parties
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Receivable
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Payable
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Net Balance
                    </th>

                    <th className="px-5 py-4 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRegions.map(
                    (region) => (
                      <tr
                        key={region.id}
                        onClick={() =>
                          navigate(
                            `/parties?region=${region.id}`,
                          )
                        }
                        className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                              <MapPin
                                size={16}
                              />
                            </div>

                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {region.name}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                Click to view parties
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-700">
                          {region.partyCount}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-emerald-600">
                          {formatCurrency(
                            region.receivable,
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-rose-600">
                          {formatCurrency(
                            region.payable,
                          )}
                        </td>

                        <td
                          className={`px-5 py-4 text-sm font-semibold ${
                            region.net > 0
                              ? "text-emerald-600"
                              : region.net < 0
                                ? "text-rose-600"
                                : "text-slate-600"
                          }`}
                        >
                          {formatCurrency(
                            Math.abs(
                              region.net,
                            ),
                          )}

                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {region.net > 0
                              ? "Receivable"
                              : region.net < 0
                                ? "Payable"
                                : "Settled"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {canWrite && <button
                              type="button"
                              title="Edit region"
                              onClick={(event) => {
                                event.stopPropagation();

                                openEditRegion(
                                  region.id,
                                );
                              }}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Pencil
                                size={16}
                              />
                            </button>}

                            {canWrite && <button
                              type="button"
                              title="Delete region"
                              onClick={(event) => {
                                event.stopPropagation();

                                setDeleteRegionId(
                                  region.id,
                                );
                              }}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2
                                size={16}
                              />
                            </button>}

                            <ArrowRight
                              size={17}
                              className="ml-1 text-slate-400"
                            />
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-400">
              Showing{" "}
              {filteredRegions.length}{" "}
              of {regions.length} regions
            </p>
          </div>
        </div>
      </div>

      {/* ADD / EDIT */}

      <RegionModal
        open={
          regionModalOpen
        }
        regionId={
          editRegionId
        }
        onClose={
          closeRegionModal
        }
      />

      {/* DELETE */}

      <ConfirmDialog
        open={
          deleteRegionId !==
          null
        }
        title="Delete Region?"
        description={
          regionToDelete &&
          regionToDelete.partyCount >
            0
            ? `${regionToDelete.name} currently contains ${regionToDelete.partyCount} party/parties. Move those parties to another region before deleting it.`
            : `Delete ${regionToDelete?.name ?? "this region"}? This action cannot be undone.`
        }
        confirmLabel="Delete Region"
        tone="danger"
        onCancel={() =>
          setDeleteRegionId(
            null,
          )
        }
        onConfirm={
          handleDeleteRegion
        }
      />
    </>
  );
}
