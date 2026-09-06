import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DatabaseBackup,
  ExternalLink,
  FileText,
  Info,
  Palette,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useLedger } from "../../hooks/useLedger";
import { useSettings } from "../../hooks/useSettings";
import type {
  AccentColor,
  AppFontFamily,
  AppearanceSettings,
  AppearanceTheme,
  AppSettings,
  BaseFontSize,
  BusinessSettings,
  PrintFontSize,
  PrintSettings,
  TableDensity,
  UiDensity,
  UiScale,
} from "../../types/settings";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_SETTINGS,
} from "../../utils/settingsStorage";

type SettingsTab =
  | "BUSINESS"
  | "APPEARANCE"
  | "STATEMENTS"
  | "BACKUP"
  | "ADVANCED";

type PrintToggleKey =
  | "showRunningBalance"
  | "showNotes"
  | "showAttachment"
  | "showTransactionTime"
  | "showBusinessAddress"
  | "showBusinessPhone"
  | "showBusinessGstin"
  | "showGeneratedDate";

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

const TABS = [
  { id: "BUSINESS", label: "Business", icon: Building2 },
  { id: "APPEARANCE", label: "Appearance", icon: Palette },
  { id: "STATEMENTS", label: "Statements", icon: FileText },
  { id: "BACKUP", label: "Backup", icon: DatabaseBackup },
  { id: "ADVANCED", label: "Advanced", icon: SlidersHorizontal },
] as const;

const PRINT_TOGGLES: Array<{
  key: PrintToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: "showRunningBalance",
    label: "Running balance",
    description: "Show the balance after every transaction row.",
  },
  {
    key: "showTransactionTime",
    label: "Transaction time",
    description: "Include the recorded time alongside each date.",
  },
  {
    key: "showNotes",
    label: "Transaction notes",
    description: "Print notes when a transaction has one.",
  },
  {
    key: "showAttachment",
    label: "Attachment reference",
    description: "Show the saved attachment name or reference.",
  },
  {
    key: "showBusinessAddress",
    label: "Business address",
    description: "Include the saved address in the report header.",
  },
  {
    key: "showBusinessPhone",
    label: "Business phone",
    description: "Include the saved phone number in the report header.",
  },
  {
    key: "showBusinessGstin",
    label: "Business GSTIN",
    description: "Include the saved GSTIN in the report header.",
  },
  {
    key: "showGeneratedDate",
    label: "Generated date",
    description: "Show when the report was prepared.",
  },
];

const ACCENTS: Array<{
  value: AccentColor;
  label: string;
  color: string;
}> = [
  { value: "blue", label: "Blue", color: "bg-blue-600" },
  { value: "indigo", label: "Indigo", color: "bg-indigo-600" },
  { value: "emerald", label: "Emerald", color: "bg-emerald-600" },
  { value: "slate", label: "Slate", color: "bg-slate-600" },
];

const FONT_STACKS: Record<AppFontFamily, string> = {
  inter: 'Inter, "Segoe UI", Arial, sans-serif',
  system:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "segoe-ui": '"Segoe UI", Arial, sans-serif',
  arial: "Arial, sans-serif",
};

function cloneSettings(settings: Readonly<AppSettings>): AppSettings {
  return {
    business: { ...settings.business },
    print: { ...settings.print },
    appearance: { ...settings.appearance },
  };
}

function normalizeDraft(draft: AppSettings): AppSettings {
  return {
    business: {
      ...draft.business,
      companyName: draft.business.companyName.trim(),
      address: draft.business.address.trim(),
      phone: draft.business.phone.trim(),
      gstin: draft.business.gstin.trim().toUpperCase(),
      email: draft.business.email.trim(),
      statementHeader: draft.business.statementHeader.trim(),
      statementFooter: draft.business.statementFooter.trim(),
      currency: "INR",
    },
    print: {
      ...draft.print,
      paperSize: "A4",
      customFooter: draft.print.customFooter.trim(),
    },
    appearance: { ...draft.appearance },
  };
}

function Toggle({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleProps) {
  return (
    <div
      className={`flex items-start justify-between gap-5 rounded-xl border border-slate-200 p-4 ${
        disabled ? "opacity-70" : ""
      }`}
    >
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        <p
          id={`${id}-description`}
          className="mt-1 text-xs leading-5 text-slate-500"
        >
          {description}
        </p>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-description`}
        data-settings-switch
        data-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          data-settings-switch-knob
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SettingsWorkspace() {
  const {
    getWorkspaceSnapshot,
    replaceWorkspace,
  } = useLedger();
  const {
    settings,
    storageError,
    isPersisted,
    updateSettings,
    resetAllSettings,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>("BUSINESS");
  const [draft, setDraft] = useState<AppSettings>(() =>
    cloneSettings(settings),
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [storageRecoveryOpen, setStorageRecoveryOpen] = useState(false);

  const requiresExplicitStorageRecovery = Boolean(
    storageError &&
      [
        "READ_FAILED",
        "PARSE_FAILED",
        "INVALID_DATA",
        "UNSUPPORTED_VERSION",
      ].includes(storageError.code),
  );

  const phone = draft.business.phone.trim();
  const email = draft.business.email.trim();
  const companyName = draft.business.companyName.trim();
  const companyNameError = companyName
    ? ""
    : "Company name is required.";
  const phoneError =
    phone !== "" && !/^\d{10}$/.test(phone)
      ? "Enter a 10-digit phone number, or leave this field blank."
      : "";
  const emailError =
    email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? "Enter a valid email address, or leave this field blank."
      : "";
  const hasErrors = Boolean(
    companyNameError || phoneError || emailError,
  );
  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const selectClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  function updateBusiness(patch: Partial<BusinessSettings>) {
    setDraft((current) => ({
      ...current,
      business: { ...current.business, ...patch },
    }));
  }

  function updateAppearance(patch: Partial<AppearanceSettings>) {
    setDraft((current) => ({
      ...current,
      appearance: { ...current.appearance, ...patch },
    }));
  }

  function updatePrint(patch: Partial<PrintSettings>) {
    setDraft((current) => ({
      ...current,
      print: { ...current.print, ...patch },
    }));
  }

  function saveChanges() {
    if (hasErrors) {
      setActiveTab("BUSINESS");
      toast.error("Check the highlighted fields before saving.");
      return;
    }

    const nextSettings = normalizeDraft(draft);
    const result = updateSettings(nextSettings);
    setDraft(nextSettings);

    if (result.ok) {
      toast.success("Settings saved", {
        description: "Your preferences are saved in this browser.",
      });
    } else if (
      result.error.code === "WRITE_FAILED" ||
      result.error.code === "STORAGE_UNAVAILABLE"
    ) {
      toast.error("Settings applied for this session only", {
        description: result.error.message,
      });
    } else {
      toast.error("Settings could not be saved", {
        description: result.error.message,
      });
    }
  }

  function resetAppearanceDraft() {
    setDraft((current) => ({
      ...current,
      appearance: { ...DEFAULT_APPEARANCE_SETTINGS },
    }));
    toast.info("Appearance defaults loaded", {
      description: "Select Save Changes to apply them.",
    });
  }

  function confirmResetAllSettings() {
    const result = resetAllSettings();
    const resetDraft = cloneSettings(DEFAULT_SETTINGS);
    resetDraft.business.companyName = settings.business.companyName;
    setDraft(resetDraft);
    setResetConfirmOpen(false);

    if (result.ok) {
      toast.success("Settings restored to defaults", {
        description:
          "Parties, transactions, regions, and other ledger data were not changed.",
      });
    } else {
      toast.error("Defaults applied for this session only", {
        description: result.error.message,
      });
    }
  }

  function persistCurrentWorkspace() {
    const result = replaceWorkspace(getWorkspaceSnapshot());
    setStorageRecoveryOpen(false);

    if (result.ok) {
      toast.success("Workspace storage recovered", {
        description:
          "The current companies, ledger data, and settings are saved in this browser.",
      });
    } else {
      toast.error("Workspace still could not be saved", {
        description: result.error.message,
      });
    }
  }

  function retryWorkspaceStorage() {
    if (requiresExplicitStorageRecovery) {
      setStorageRecoveryOpen(true);
      return;
    }

    persistCurrentWorkspace();
  }

  return (
    <div data-settings-page className="mx-auto max-w-[1500px]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Workspace preferences
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-950">
            <Settings2 size={28} aria-hidden="true" />
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Configure your business identity, appearance, and statement
            defaults. Settings are stored locally in this browser.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div
            aria-live="polite"
            className={`flex items-center gap-2 text-xs font-medium ${
              isDirty || !isPersisted
                ? "text-amber-700"
                : "text-emerald-700"
            }`}
          >
            {isDirty || !isPersisted ? (
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            ) : (
              <CheckCircle2 size={15} aria-hidden="true" />
            )}
            {isDirty
              ? "Unsaved changes"
              : isPersisted
                ? "No unsaved changes"
                : "Applied for this session"}
          </div>
          <button
            type="button"
            onClick={saveChanges}
            disabled={!isDirty}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={17} aria-hidden="true" />
            Save Changes
          </button>
        </div>
      </div>

      {(storageError || !isPersisted) && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Workspace storage issue</p>
              <p className="mt-1 text-sm leading-6">
                {storageError?.message ??
                  "Settings are active for this session, but could not be saved in this browser."}
              </p>
              {storageError && (
                <p className="mt-1 text-xs text-amber-700">
                  Error code: {storageError.code}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={retryWorkspaceStorage}
              className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium transition hover:bg-amber-100"
            >
              {requiresExplicitStorageRecovery
                ? "Review recovery"
                : "Retry saving"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="h-fit rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          {activeTab === "BUSINESS" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                title="Business profile"
                description={`These details identify ${settings.business.companyName} on printable statements and reports. Only the company name is required.`}
              />

              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <label className="text-sm font-medium text-slate-700">
                  Company name
                  <input
                    type="text"
                    value={draft.business.companyName}
                    aria-invalid={Boolean(companyNameError)}
                    aria-describedby={
                      companyNameError ? "company-name-error" : undefined
                    }
                    onChange={(event) =>
                      updateBusiness({ companyName: event.target.value })
                    }
                    placeholder="Your business name"
                    className={`${inputClass} ${
                      companyNameError
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                        : ""
                    }`}
                  />
                  {companyNameError && (
                    <span
                      id="company-name-error"
                      className="mt-1.5 block text-xs font-normal text-rose-600"
                    >
                      {companyNameError}
                    </span>
                  )}
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Currency
                  <select
                    value="INR"
                    disabled
                    aria-describedby="currency-help"
                    className={`${selectClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                  >
                    <option value="INR">INR — Indian Rupee (₹)</option>
                  </select>
                  <span
                    id="currency-help"
                    className="mt-1.5 block text-xs font-normal text-slate-500"
                  >
                    LedgerFlow currently supports INR only.
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Business address
                  <textarea
                    value={draft.business.address}
                    onChange={(event) =>
                      updateBusiness({ address: event.target.value })
                    }
                    rows={3}
                    placeholder="Street, city, state, postal code"
                    className={`${inputClass} resize-y`}
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Phone number
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={draft.business.phone}
                    aria-invalid={Boolean(phoneError)}
                    aria-describedby={
                      phoneError ? "phone-error" : "phone-help"
                    }
                    onChange={(event) =>
                      updateBusiness({ phone: event.target.value })
                    }
                    placeholder="10-digit phone number"
                    className={`${inputClass} ${
                      phoneError
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                        : ""
                    }`}
                  />
                  <span
                    id={phoneError ? "phone-error" : "phone-help"}
                    className={`mt-1.5 block text-xs font-normal ${
                      phoneError ? "text-rose-600" : "text-slate-500"
                    }`}
                  >
                    {phoneError ||
                      "Optional; use 10 digits without a country code."}
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={draft.business.email}
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "email-error" : undefined}
                    onChange={(event) =>
                      updateBusiness({ email: event.target.value })
                    }
                    placeholder="accounts@example.com"
                    className={`${inputClass} ${
                      emailError
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                        : ""
                    }`}
                  />
                  {emailError && (
                    <span
                      id="email-error"
                      className="mt-1.5 block text-xs font-normal text-rose-600"
                    >
                      {emailError}
                    </span>
                  )}
                </label>

                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  GSTIN
                  <input
                    type="text"
                    autoCapitalize="characters"
                    value={draft.business.gstin}
                    onChange={(event) =>
                      updateBusiness({
                        gstin: event.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Business GST identification number"
                    className={`${inputClass} uppercase`}
                  />
                  <span className="mt-1.5 block text-xs font-normal text-slate-500">
                    Spaces are trimmed and letters are saved in uppercase.
                  </span>
                </label>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Statement identity
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Set the title and business message used on account statements.
                </p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Statement heading
                    <input
                      type="text"
                      value={draft.business.statementHeader}
                      onChange={(event) =>
                        updateBusiness({ statementHeader: event.target.value })
                      }
                      placeholder="Statement of Account"
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Business statement footer
                    <input
                      type="text"
                      value={draft.business.statementFooter}
                      onChange={(event) =>
                        updateBusiness({ statementFooter: event.target.value })
                      }
                      placeholder="Thank you for your business"
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            </section>
          )}

          {activeTab === "APPEARANCE" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                title="Appearance"
                description="Choose how LedgerFlow looks and how much information fits on screen. Changes apply after saving."
              />

              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <label className="text-sm font-medium text-slate-700">
                  Theme
                  <select
                    value={draft.appearance.theme}
                    onChange={(event) =>
                      updateAppearance({
                        theme: event.target.value as AppearanceTheme,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="system">Use system setting</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Font family
                  <select
                    value={draft.appearance.fontFamily}
                    onChange={(event) =>
                      updateAppearance({
                        fontFamily: event.target.value as AppFontFamily,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="inter">Inter</option>
                    <option value="system">System default</option>
                    <option value="segoe-ui">Segoe UI</option>
                    <option value="arial">Arial</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Base font size
                  <select
                    value={draft.appearance.baseFontSize}
                    onChange={(event) =>
                      updateAppearance({
                        baseFontSize: Number(
                          event.target.value,
                        ) as BaseFontSize,
                      })
                    }
                    className={selectClass}
                  >
                    <option value={13}>13 px — Small</option>
                    <option value={14}>14 px</option>
                    <option value={15}>15 px</option>
                    <option value={16}>16 px — Default</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  UI scale
                  <select
                    value={draft.appearance.uiScale}
                    onChange={(event) =>
                      updateAppearance({
                        uiScale: Number(event.target.value) as UiScale,
                      })
                    }
                    className={selectClass}
                  >
                    <option value={90}>90% — More compact</option>
                    <option value={100}>100% — Default</option>
                    <option value={110}>110% — Larger</option>
                    <option value={125}>125% — Extra large</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Interface spacing
                  <select
                    value={draft.appearance.density}
                    onChange={(event) =>
                      updateAppearance({
                        density: event.target.value as UiDensity,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Table row spacing
                  <select
                    value={draft.appearance.tableDensity}
                    onChange={(event) =>
                      updateAppearance({
                        tableDensity: event.target.value as TableDensity,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="comfortable">Comfortable</option>
                  </select>
                </label>

                <fieldset className="sm:col-span-2">
                  <legend className="text-sm font-medium text-slate-700">
                    Accent color
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {ACCENTS.map((accent) => {
                      const selected =
                        draft.appearance.accentColor === accent.value;
                      return (
                        <label
                          key={accent.value}
                          data-selected={selected}
                          className={`settings-accent-option flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                            selected
                              ? "border-slate-900 bg-slate-50 text-slate-950 ring-1 ring-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="settings-accent-color"
                            value={accent.value}
                            checked={selected}
                            onChange={() =>
                              updateAppearance({ accentColor: accent.value })
                            }
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`h-4 w-4 rounded-full ${accent.color}`}
                          />
                          {accent.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Draft preview
                    </p>
                    <div
                      className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700"
                      style={{
                        fontFamily: FONT_STACKS[draft.appearance.fontFamily],
                        fontSize: `${
                          draft.appearance.baseFontSize *
                          (draft.appearance.uiScale / 100)
                        }px`,
                      }}
                    >
                      LedgerFlow keeps your books clear and readable.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetAppearanceDraft}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Reset appearance only
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "STATEMENTS" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                title="Statement & print defaults"
                description={`Set the report defaults for ${settings.business.companyName}. Other companies keep their own statement preferences.`}
              />

              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <label className="text-sm font-medium text-slate-700">
                  Paper size
                  <select
                    value="A4"
                    disabled
                    className={`${selectClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                  >
                    <option value="A4">A4</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Orientation
                  <select
                    value={draft.print.orientation}
                    onChange={(event) =>
                      updatePrint({
                        orientation: event.target
                          .value as PrintSettings["orientation"],
                      })
                    }
                    className={selectClass}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Print font size
                  <select
                    value={draft.print.fontSize}
                    aria-describedby="print-font-size-help"
                    onChange={(event) =>
                      updatePrint({
                        fontSize: event.target.value as PrintFontSize,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="small">Small</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                  </select>
                  <span
                    id="print-font-size-help"
                    className="mt-1.5 block text-xs font-normal text-slate-500"
                  >
                    Applied to printed pages and PDF output; the on-screen
                    preview follows your interface scale.
                  </span>
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Default transaction count
                  <select
                    value={draft.print.defaultTransactionLimit}
                    onChange={(event) =>
                      updatePrint({
                        defaultTransactionLimit:
                          event.target.value === "ALL"
                            ? "ALL"
                            : (Number(
                                event.target.value,
                              ) as PrintSettings["defaultTransactionLimit"]),
                      })
                    }
                    className={selectClass}
                  >
                    <option value={10}>Last 10</option>
                    <option value={25}>Last 25</option>
                    <option value={50}>Last 50</option>
                    <option value={100}>Last 100</option>
                    <option value="ALL">All transactions</option>
                  </select>
                </label>
              </div>

              <div className="border-t border-slate-100 p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Information to include
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  These switches become the default for new statement previews.
                </p>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {PRINT_TOGGLES.map((item) => (
                    <Toggle
                      key={item.key}
                      id={`print-${item.key}`}
                      label={item.label}
                      description={item.description}
                      checked={draft.print[item.key]}
                      onChange={(checked) =>
                        updatePrint({ [item.key]: checked })
                      }
                    />
                  ))}

                </div>

                <div className="mt-4 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                  <Info
                    size={18}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold">
                      Page numbers are browser managed
                    </p>
                    <p className="mt-1 text-xs leading-5">
                      Chromium browsers usually control page numbers through
                      the print dialog’s “Headers and footers” option. LedgerFlow
                      cannot guarantee whether numbers appear on paper or PDF.
                    </p>
                  </div>
                </div>

                <label className="mt-5 block text-sm font-medium text-slate-700">
                  Custom print footer
                  <textarea
                    value={draft.print.customFooter}
                    onChange={(event) =>
                      updatePrint({ customFooter: event.target.value })
                    }
                    rows={3}
                    placeholder="Payment instructions, terms, or a closing message"
                    className={`${inputClass} resize-y`}
                  />
                  <span className="mt-1.5 block text-xs font-normal text-slate-500">
                    When set, this overrides the business statement footer for
                    printed reports.
                  </span>
                </label>
              </div>
            </section>
          )}

          {activeTab === "BACKUP" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                title="Backup & restore"
                description="Data export and recovery tools live in their own workspace so this page remains focused on preferences."
              />
              <div className="p-5 sm:p-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <DatabaseBackup size={22} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">
                    Open Backup & Restore
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Download one versioned JSON backup containing every company,
                    ledger record, company preference, and application appearance
                    setting. You can also validate and safely restore a full backup.
                  </p>
                  <Link
                    to="/backup"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Open backup workspace
                    <ExternalLink size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {activeTab === "ADVANCED" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                title="Advanced settings"
                description="Maintenance actions for preferences stored in this browser."
              />
              <div className="p-5 sm:p-6">
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert
                      size={21}
                      className="mt-0.5 shrink-0 text-rose-700"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-rose-950">
                        Reset all settings
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-rose-800">
                        Restore this company&apos;s business and statement
                        preferences plus the application-wide appearance. Other
                        companies and all ledger data remain unchanged.
                      </p>
                      <button
                        type="button"
                        onClick={() => setResetConfirmOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        Reset settings to defaults
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={storageRecoveryOpen}
        title="Replace unreadable saved workspace?"
        description={`LedgerFlow reported ${storageError?.code ?? "a storage error"}. Continuing writes the safe workspace currently visible in this session over the unreadable or unsupported saved workspace. Use Backup & Restore first if you need a JSON copy of the currently visible data.`}
        confirmLabel="Save current workspace"
        cancelLabel="Keep saved data untouched"
        tone="danger"
        onCancel={() => setStorageRecoveryOpen(false)}
        onConfirm={persistCurrentWorkspace}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset all settings?"
        description={`Business and statement settings for ${settings.business.companyName}, plus the application-wide appearance, will return to defaults. Other companies and all ledger data remain untouched.`}
        confirmLabel="Reset settings"
        tone="danger"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={confirmResetAllSettings}
      />
    </div>
  );
}

export default function Settings() {
  const { activeCompany } = useLedger();

  const companyIdentityKey = JSON.stringify([
    activeCompany.id,
    activeCompany.name,
    activeCompany.address,
    activeCompany.phone,
    activeCompany.gstin,
    activeCompany.email,
  ]);

  return (
    <SettingsWorkspace
      key={companyIdentityKey}
    />
  );
}
