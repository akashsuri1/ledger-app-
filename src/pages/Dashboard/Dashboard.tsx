import {
  useMemo,
  useState,
} from "react";

import {
  Landmark,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import StatCard from "../../components/dashboard/StatCard";
import QuickActions from "../../components/dashboard/QuickActions";
import BalanceChart from "../../components/dashboard/BalanceChart";
import RegionOverview from "../../components/dashboard/RegionOverview";
import RecentTransactions from "../../components/dashboard/RecentTransactions";
import AddPartyModal from "../../components/parties/AddPartyModal";

import { formatCurrency } from "../../utils/currency";

import { useLedger } from "../../context/LedgerContext";

import { useTransactionModal } from "../../context/TransactionModalContext";

export default function Dashboard() {
  const { openTransactionModal } = useTransactionModal();

  const {
    parties,
    transactions,
  } = useLedger();

  const [addPartyOpen, setAddPartyOpen] =
    useState(false);

  const dashboardStats =
    useMemo(() => {
      const balances =
        new Map<number, number>();

      transactions.forEach(
        (transaction) => {
          const current =
            balances.get(
              transaction.partyId,
            ) ?? 0;

          balances.set(
            transaction.partyId,
            transaction.type ===
              "CREDIT"
              ? current +
                  transaction.amount
              : current -
                  transaction.amount,
          );
        },
      );

      let receivable = 0;
      let payable = 0;

      parties.forEach((party) => {
        const balance =
          balances.get(
            party.id,
          ) ?? 0;

        if (balance > 0) {
          receivable += balance;
        } else if (balance < 0) {
          payable +=
            Math.abs(balance);
        }
      });

      return {
        receivable,
        payable,
        netBalance:
          receivable - payable,
        totalParties:
          parties.length,
      };
    }, [
      parties,
      transactions,
    ]);

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Page Heading */}
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Overview
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Dashboard
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Track parties, balances and recent ledger activity.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500 shadow-sm">
          All data stored locally
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Receivable"
          value={formatCurrency(dashboardStats.receivable)}
          description="Amount parties owe you"
          icon={TrendingUp}
          tone="green"
        />

        <StatCard
          title="Total Payable"
          value={formatCurrency(dashboardStats.payable)}
          description="Amount payable to parties"
          icon={TrendingDown}
          tone="red"
        />

        <StatCard
          title="Net Balance"
          value={formatCurrency(dashboardStats.netBalance)}
          description="Receivable minus payable"
          icon={Wallet}
          tone="blue"
        />

        <StatCard
          title="Total Parties"
          value={dashboardStats.totalParties.toString()}
          description="Across all active regions"
          icon={Users}
          tone="neutral"
        />
      </div>

      {/* Chart + Quick Actions */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <BalanceChart />

        <QuickActions
          onAddCredit={() =>
            openTransactionModal("CREDIT")
          }
          onAddDebit={() =>
            openTransactionModal("DEBIT")
          }
          onAddParty={() =>
            setAddPartyOpen(
              true,
            )
          }
        />
      </div>

      {/* Transactions + Regions */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <RecentTransactions />

        <RegionOverview />
      </div>

      {/* System Status */}
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Landmark size={19} />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-900">
                Local Database
              </p>

              <p className="text-xs text-slate-500">
                SQLite integration planned
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">
            Last Backup
          </p>

          <p className="mt-2 text-xl font-semibold text-slate-950">
            Not created yet
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Configure from Backup & Restore
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">
            Application Status
          </p>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

            <span className="text-sm text-slate-600">
              Operating normally
            </span>
          </div>
        </div>
      </div>

      <AddPartyModal
        open={addPartyOpen}
        onClose={() =>
          setAddPartyOpen(
            false,
          )
        }
      />
    </div>
  );
}
