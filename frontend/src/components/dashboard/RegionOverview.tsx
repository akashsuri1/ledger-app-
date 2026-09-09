import { ChevronRight, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useLedger } from "../../hooks/useLedger";
import { formatCurrency } from "../../utils/currency";

export default function RegionOverview() {
  const navigate = useNavigate();

  const {
    regions,
    parties,
    getPartyBalance,
  } = useLedger();

  const regionData = regions.map(
    (region) => {
      const regionParties =
        parties.filter(
          (party) =>
            party.regionId ===
            region.id,
        );

      const balance =
        regionParties.reduce(
          (total, party) =>
            total +
            getPartyBalance(
              party.id,
            ),
          0,
        );

      return {
        ...region,
        partyCount:
          regionParties.length,
        balance,
      };
    },
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="font-semibold text-slate-950">
          Region Overview
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Parties grouped by region
        </p>
      </div>

      {regionData.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <MapPin
            size={28}
            className="mx-auto text-slate-300"
          />

          <p className="mt-3 text-sm font-medium text-slate-900">
            No regions yet
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Add a region to organize your parties.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {regionData.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() =>
              navigate(
                `/parties?region=${region.id}`,
              )
            }
            className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <MapPin size={17} />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900">
                  {region.name}
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  {region.partyCount}{" "}
                  {region.partyCount === 1
                    ? "party"
                    : "parties"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p
                  className={`text-sm font-medium ${
                    region.balance > 0
                      ? "text-emerald-600"
                      : region.balance < 0
                        ? "text-rose-600"
                        : "text-slate-600"
                  }`}
                >
                  {formatCurrency(
                    Math.abs(
                      region.balance,
                    ),
                  )}
                </p>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  {region.balance > 0
                    ? "Receivable"
                    : region.balance < 0
                      ? "Payable"
                      : "Settled"}
                </p>
              </div>

              <ChevronRight
                size={16}
                className="text-slate-400"
              />
            </div>
          </button>
          ))}
        </div>
      )}
    </div>
  );
}
