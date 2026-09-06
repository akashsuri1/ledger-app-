import { useEffect, useRef, useState } from "react";

import {
  Check,
  ChevronDown,
  Pencil,
  Plus,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useLedger } from "../../hooks/useLedger";
import type { Company } from "../../types";
import CompanyFormModal from "./CompanyFormModal";
import ManageCompaniesModal from "./ManageCompaniesModal";

type CompanyFormState =
  | { mode: "create" }
  | { mode: "edit"; company: Company }
  | null;

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

export default function CompanySwitcher() {
  const {
    companies,
    activeCompany,
    activeCompanyId,
    switchCompany,
  } = useLedger();
  const navigate = useNavigate();
  const location = useLocation();
  const switcherRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [formState, setFormState] = useState<CompanyFormState>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function clearCompanyBoundRoute() {
    if (/^\/parties\/[^/]+/.test(location.pathname)) {
      navigate("/parties", { replace: true });
      return;
    }

    if (
      location.pathname === "/parties" ||
      location.pathname === "/transactions" ||
      location.pathname === "/reports"
    ) {
      navigate(location.pathname, { replace: true });
    }
  }

  function handleSwitch(company: Company) {
    setMenuOpen(false);
    setManageOpen(false);

    if (company.id === activeCompanyId) {
      return;
    }

    switchCompany(company.id);
    clearCompanyBoundRoute();
    toast.success(`Switched to ${company.name}`, {
      description:
        "Dashboard, ledger, reports, and company settings now show this workspace.",
    });
  }

  function openCreateForm() {
    setMenuOpen(false);
    setManageOpen(false);
    setFormState({ mode: "create" });
  }

  function openEditForm(company: Company) {
    setMenuOpen(false);
    setManageOpen(false);
    setFormState({ mode: "edit", company });
  }

  return (
    <>
      <div
        ref={switcherRef}
        className="relative shrink-0 border-b border-slate-800 p-4"
      >
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Current company
        </p>

        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-left transition hover:border-slate-600 hover:bg-slate-800"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-950">
            {getInitials(activeCompany.name)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {activeCompany.name}
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-400">
              Switch workspace
            </span>
          </span>

          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-400 transition ${
              menuOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute left-4 right-4 top-[calc(100%-8px)] z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl"
          >
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {companies.map((company) => {
                const isActive = company.id === activeCompanyId;

                return (
                  <button
                    key={company.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => handleSwitch(company)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-700 text-[10px] font-bold">
                      {getInitials(company.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {company.name}
                    </span>
                    {isActive && (
                      <Check
                        size={14}
                        className="shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="my-2 border-t border-slate-700" />

            <button
              type="button"
              role="menuitem"
              onClick={openCreateForm}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Plus size={15} aria-hidden="true" />
              Add company
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setManageOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Pencil size={14} aria-hidden="true" />
              Manage companies
            </button>
          </div>
        )}
      </div>

      <ManageCompaniesModal
        open={manageOpen}
        companies={companies}
        activeCompanyId={activeCompanyId}
        onClose={() => setManageOpen(false)}
        onCreate={openCreateForm}
        onEdit={openEditForm}
        onSwitch={handleSwitch}
      />

      {formState && (
        <CompanyFormModal
          key={
            formState.mode === "edit"
              ? `edit-${formState.company.id}`
              : "create"
          }
          open
          company={
            formState.mode === "edit" ? formState.company : undefined
          }
          onClose={() => setFormState(null)}
          onSaved={(_company, mode) => {
            if (mode === "create") {
              clearCompanyBoundRoute();
            }
          }}
        />
      )}
    </>
  );
}
