import {
  Building2,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import type { Company } from "../../types";
import Modal from "../ui/Modal";

interface ManageCompaniesModalProps {
  open: boolean;
  companies: Company[];
  activeCompanyId: number;
  deletableCompanyIds: ReadonlySet<number>;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (company: Company) => void;
  onSwitch: (company: Company) => void;
  onDelete: (company: Company) => void;
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  return (
    words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "CO"
  );
}

export default function ManageCompaniesModal({
  open,
  companies,
  activeCompanyId,
  deletableCompanyIds,
  onClose,
  onCreate,
  onEdit,
  onSwitch,
  onDelete,
}: ManageCompaniesModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage companies"
      description="Switch workspaces or update company details. Each company's ledger and statement settings stay separate."
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100"
        >
          <Plus size={17} aria-hidden="true" />
          Add another company
        </button>

        <div className="space-y-3">
          {companies.map((company) => {
            const isActive = company.id === activeCompanyId;

            return (
              <article
                key={company.id}
                className={`rounded-2xl border p-4 transition ${
                  isActive
                    ? "border-blue-200 bg-blue-50/60"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {getInitials(company.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-950">
                        {company.name}
                      </h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          Current
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {company.gstin ||
                        company.email ||
                        company.phone ||
                        "No contact details added"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200/80 pt-3">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSwitch(company)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Switch to company
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEdit(company)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil size={13} aria-hidden="true" />
                    Edit details
                  </button>

                  {deletableCompanyIds.has(company.id) && (
                    <button
                      type="button"
                      onClick={() => onDelete(company)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Delete company
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="rounded-xl bg-slate-50 p-3.5">
          <div className="flex items-start gap-2.5">
            <Building2
              size={17}
              className="mt-0.5 shrink-0 text-slate-500"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-slate-600">
              Delete is available only for companies with no regions, parties,
              or transactions.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
