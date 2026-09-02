import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useLedger } from "../../context/LedgerContext";
import { formatCurrency } from "../../utils/currency";
import { formatTransactionDateTime } from "../../utils/dateTime";

export default function RecentTransactions() {
  const navigate = useNavigate();

  const {
    parties,
    regions,
    transactions,
  } = useLedger();

  const recentTransactions = [
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
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h3 className="font-semibold text-slate-950">
            Recent Transactions
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Latest ledger activity
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate("/transactions")
          }
          className="flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-950"
        >
          View all
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3.5 font-medium">
                Party
              </th>

              <th className="px-5 py-3.5 font-medium">
                Region
              </th>

              <th className="px-5 py-3.5 font-medium">
                Type
              </th>

              <th className="px-5 py-3.5 font-medium">
                Date
              </th>

              <th className="px-5 py-3.5 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {recentTransactions.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-sm text-slate-500"
                >
                  No transactions yet.
                </td>
              </tr>
            )}

            {recentTransactions.map((transaction) => {
              const isCredit =
                transaction.type === "CREDIT";

              const party =
                parties.find(
                  (item) =>
                    item.id === transaction.partyId,
                );

              const region =
                regions.find(
                  (item) =>
                    item.id === party?.regionId,
                );

              return (
                <tr
                  key={transaction.id}
                  tabIndex={0}
                  onClick={() =>
                    navigate(
                      `/transactions?transaction=${transaction.id}`,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      navigate(
                        `/transactions?transaction=${transaction.id}`,
                      );
                    }
                  }}
                  className="cursor-pointer border-b border-slate-100 last:border-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300"
                >
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {party?.name ?? "Unknown party"}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {transaction.description}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {region?.name ?? "Unknown region"}
                  </td>

                  <td className="px-5 py-4">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isCredit
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {isCredit ? (
                        <ArrowUpRight size={13} />
                      ) : (
                        <ArrowDownLeft size={13} />
                      )}

                      {isCredit ? "Credit" : "Debit"}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-500">
                    {formatTransactionDateTime(
                      transaction.transactionDateTime,
                    )}
                  </td>

                  <td
                    className={`px-5 py-4 text-right text-sm font-semibold ${
                      isCredit
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
