import {
  ArrowDownLeft,
  ArrowUpRight,
  UserPlus,
} from "lucide-react";

interface QuickActionsProps {
  onAddCredit: () => void;
  onAddDebit: () => void;
  onAddParty: () => void;
}

export default function QuickActions({
  onAddCredit,
  onAddDebit,
  onAddParty,
}: QuickActionsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-semibold text-slate-950">
          Quick Actions
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Common ledger operations
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <button
          onClick={onAddCredit}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <ArrowUpRight size={18} />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">
              Add Credit
            </p>

            <p className="text-xs text-slate-500">
              Record money receivable
            </p>
          </div>
        </button>

        <button
          onClick={onAddDebit}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-rose-200 hover:bg-rose-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <ArrowDownLeft size={18} />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">
              Add Debit
            </p>

            <p className="text-xs text-slate-500">
              Record money paid
            </p>
          </div>
        </button>

        <button
          onClick={onAddParty}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-blue-200 hover:bg-blue-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <UserPlus size={18} />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">
              Add Party
            </p>

            <p className="text-xs text-slate-500">
              Create a new party
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}