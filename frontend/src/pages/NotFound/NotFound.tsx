import { ArrowLeft, FileQuestion, LayoutDashboard } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <FileQuestion size={27} aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
          Error 404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          This LedgerFlow address does not exist. No company or ledger data was
          changed.
        </p>

        <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Go back
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <LayoutDashboard size={16} aria-hidden="true" />
            Open dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
