import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import CompanyFormModal from "../../components/companies/CompanyFormModal";
import { useLedger } from "../../hooks/useLedger";
import type { Company } from "../../types";

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "CO"
  );
}

function companyDetail(company: Company) {
  if (company.gstin) return `GSTIN: ${company.gstin}`;
  if (company.address) return company.address;
  if (company.email) return company.email;
  if (company.phone) return company.phone;
  return "No contact details added";
}

export default function CompanySelection() {
  const {
    companies,
    activeCompanyId,
    switchCompany,
  } = useLedger();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  if (companies.length === 1) {
    return <Navigate to="/dashboard" replace />;
  }

  function openCompany(companyId: number) {
    switchCompany(companyId);
    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <Building2 size={23} aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-semibold text-blue-600">
            LedgerFlow
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Choose a company to continue.
          </p>
        </header>

        <section
          aria-label="Available companies"
          className="mt-9 grid gap-4 md:grid-cols-2"
        >
          {companies.map((company) => {
            const wasLastUsed = company.id === activeCompanyId;

            return (
              <article
                key={company.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                    {getInitials(company.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-slate-950">
                        {company.name}
                      </h2>
                      {wasLastUsed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          Last used
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-sm text-slate-500">
                      {companyDetail(company)}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      Company workspace
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => openCompany(company.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open company
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100"
          >
            <Plus size={17} aria-hidden="true" />
            Create company
          </button>
        </div>
      </div>

      <CompanyFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => navigate("/dashboard", { replace: true })}
      />
    </main>
  );
}
