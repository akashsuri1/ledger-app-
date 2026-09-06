import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  DatabaseBackup,
  Download,
  FileJson,
  History,
  MapPin,
  Receipt,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useLedger } from "../../hooks/useLedger";
import type {
  BackupCounts,
  BackupHistoryAction,
  BackupHistoryEntry,
  BackupSummary,
  LedgerFlowBackupV1,
} from "../../types/backup";
import {
  BACKUP_HISTORY_LIMIT,
  MAX_BACKUP_FILE_SIZE_BYTES,
  createBackupFileName,
  createBackupHistoryEntry,
  createBackupSummary,
  createLedgerFlowBackup,
  downloadLedgerFlowBackup,
  loadBackupHistory,
  parseLedgerFlowBackup,
  prependBackupHistory,
  saveBackupHistory,
} from "../../utils/backup";

interface PendingBackup {
  backup: LedgerFlowBackupV1;
  summary: BackupSummary;
  fileName: string;
  fileSize: number;
}

interface HistoryState {
  entries: BackupHistoryEntry[];
  error: string | null;
}

const HISTORY_LABELS: Record<
  BackupHistoryAction,
  { label: string; className: string }
> = {
  backup: {
    label: "Full backup",
    className: "bg-blue-50 text-blue-900",
  },
  safety: {
    label: "Safety backup",
    className: "bg-amber-50 text-amber-700",
  },
  restore: {
    label: "Restore",
    className: "bg-emerald-50 text-emerald-700",
  },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected backup error occurred.";
}

function CountSummary({ counts }: { counts: BackupCounts }) {
  const items = [
    { label: "Companies", value: counts.companies, icon: Building2 },
    { label: "Regions", value: counts.regions, icon: MapPin },
    { label: "Parties", value: counts.parties, icon: Users },
    { label: "Transactions", value: counts.transactions, icon: Receipt },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3"
          >
            <dt className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon size={14} aria-hidden="true" />
              {item.label}
            </dt>
            <dd className="mt-1.5 text-lg font-semibold text-slate-950">
              {item.value.toLocaleString("en-IN")}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function Backup() {
  const {
    activeCompany,
    companies,
    getWorkspaceSnapshot,
    replaceWorkspace,
  } = useLedger();

  const [historyState, setHistoryState] = useState<HistoryState>(() =>
    loadBackupHistory(),
  );
  const historyEntriesRef = useRef(historyState.entries);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] =
    useState<PendingBackup | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [restoreStep, setRestoreStep] = useState<
    "closed" | "prepare-safety" | "confirm-restore"
  >("closed");

  const lastFullBackup = historyState.entries.find(
    (entry) => entry.action === "backup",
  );

  function recordActivity(
    action: BackupHistoryAction,
    fileName: string,
    summary: BackupSummary,
  ) {
    const entry = createBackupHistoryEntry(action, fileName, summary);
    const entries = prependBackupHistory(historyEntriesRef.current, entry);
    historyEntriesRef.current = entries;

    const saved = saveBackupHistory(entries);
    setHistoryState({ entries, error: saved.error });
    return saved;
  }

  function clearPendingBackup() {
    setPendingBackup(null);
    setFileError(null);
    setRestoreStep("closed");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleCreateBackup() {
    try {
      const backup = createLedgerFlowBackup(getWorkspaceSnapshot());
      const fileName = createBackupFileName(backup);
      const summary = createBackupSummary(backup);

      downloadLedgerFlowBackup(backup, fileName);
      const historyResult = recordActivity("backup", fileName, summary);

      toast.success("Full backup download started", {
        description: `${summary.counts.companies.toLocaleString("en-IN")} companies and ${summary.counts.transactions.toLocaleString("en-IN")} transactions included.`,
      });

      if (!historyResult.ok) {
        toast.warning("Backup history was not saved", {
          description: historyResult.error,
        });
      }
    } catch (error) {
      toast.error("Backup could not be created", {
        description: errorMessage(error),
      });
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPendingBackup(null);
    setFileError(null);

    if (!file) return;

    if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
      const message = `This file is larger than the ${formatFileSize(MAX_BACKUP_FILE_SIZE_BYTES)} safety limit.`;
      setFileError(message);
      event.target.value = "";
      toast.error("Backup file is too large", { description: message });
      return;
    }

    setIsReadingFile(true);
    try {
      const parsed = parseLedgerFlowBackup(await file.text());
      if (!parsed.ok) {
        setFileError(parsed.error);
        event.target.value = "";
        toast.error("Backup validation failed", {
          description: parsed.error,
        });
        return;
      }

      setPendingBackup({
        backup: parsed.backup,
        summary: parsed.summary,
        fileName: file.name,
        fileSize: file.size,
      });
      toast.success("Backup is valid", {
        description: "Review the contents before restoring.",
      });
    } catch (error) {
      const message = errorMessage(error);
      setFileError(message);
      event.target.value = "";
      toast.error("Backup file could not be read", { description: message });
    } finally {
      setIsReadingFile(false);
    }
  }

  function prepareSafetyBackup() {
    if (!pendingBackup) return;

    try {
      const safetyBackup = createLedgerFlowBackup(getWorkspaceSnapshot());
      const safetyFileName = createBackupFileName(safetyBackup, "safety");
      const safetySummary = createBackupSummary(safetyBackup);
      downloadLedgerFlowBackup(safetyBackup, safetyFileName);
      recordActivity("safety", safetyFileName, safetySummary);
      setRestoreStep("confirm-restore");
      toast.info("Safety backup download started", {
        description:
          "Check that the pre-restore JSON file appears in your Downloads, then confirm the restore.",
      });
    } catch (error) {
      setRestoreStep("closed");
      toast.error("Restore stopped before making changes", {
        description: `LedgerFlow could not create the pre-restore safety backup. ${errorMessage(error)}`,
      });
    }
  }

  function confirmRestore() {
    if (!pendingBackup) return;

    const result = replaceWorkspace(pendingBackup.backup.data);
    if (!result.ok) {
      setRestoreStep("closed");
      toast.error("Nothing was restored", {
        description: result.error.message,
      });
      return;
    }

    const restoredFileName = pendingBackup.fileName;
    const restoredSummary = pendingBackup.summary;
    const historyResult = recordActivity(
      "restore",
      restoredFileName,
      restoredSummary,
    );

    clearPendingBackup();
    toast.success("LedgerFlow backup restored", {
      description: `${restoredSummary.counts.companies.toLocaleString("en-IN")} companies and all related data are now active.`,
    });

    if (!historyResult.ok) {
      toast.warning("Restore history was not saved", {
        description: historyResult.error,
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1450px]">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Data safety</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Backup &amp; Restore
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Protect every company, ledger record, company preference, and
            application appearance setting in one portable file.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-sm">
          Active company:{" "}
          <strong className="text-slate-950">{activeCompany.name}</strong>
        </div>
      </div>

      {historyState.error && (
        <div
          role="alert"
          className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
        >
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold">Backup history unavailable</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              {historyState.error} Your ledger workspace is unaffected.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-900">
                <DatabaseBackup size={23} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Full LedgerFlow backup
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Downloads all {companies.length.toLocaleString("en-IN")} companies,
                  their financial data, company settings, and global appearance.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <button
              type="button"
              onClick={handleCreateBackup}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto"
            >
              <Download size={17} aria-hidden="true" />
              Download full backup
            </button>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <Clock
                  size={18}
                  className="mt-0.5 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Last recorded full backup
                  </p>
                  {lastFullBackup ? (
                    <>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDateTime(lastFullBackup.occurredAt)}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        {lastFullBackup.fileName}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">
                      No backup has been recorded in this browser yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Upload size={23} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Restore a full backup
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  LedgerFlow validates the complete file before offering to replace
                  your current workspace.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-slate-400">
              <FileJson
                size={28}
                className="mx-auto text-slate-500"
                aria-hidden="true"
              />
              <span className="mt-3 block text-sm font-semibold text-slate-900">
                Choose a LedgerFlow JSON backup
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Full backups only, up to {formatFileSize(MAX_BACKUP_FILE_SIZE_BYTES)}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelected}
                disabled={isReadingFile}
                className="mt-4 block w-full cursor-pointer rounded-lg border border-slate-200 bg-white text-sm text-slate-600 file:mr-4 file:border-0 file:bg-slate-900 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white"
              />
            </label>

            {isReadingFile && (
              <p className="mt-3 text-sm text-slate-500" aria-live="polite">
                Reading and validating the selected backup…
              </p>
            )}

            {fileError && (
              <div
                role="alert"
                className="mt-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              >
                <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {pendingBackup && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-emerald-50 p-5 sm:flex-row sm:items-start sm:p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={22}
                className="mt-0.5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Valid backup ready for review
                </h2>
                <p className="mt-1 break-all text-sm text-slate-700">
                  {pendingBackup.fileName} · {formatFileSize(pendingBackup.fileSize)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Created {formatDateTime(pendingBackup.summary.createdAt)} · Active
                  company: {pendingBackup.summary.activeCompanyName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearPendingBackup}
              className="shrink-0 text-sm font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-slate-950"
            >
              Remove selected file
            </button>
          </div>

          <div className="p-5 sm:p-6">
            <CountSummary counts={pendingBackup.summary.counts} />
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">
                Companies in this backup
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingBackup.backup.data.companies
                  .slice(0, 6)
                  .map((company) => (
                    <span
                      key={company.id}
                      className="max-w-full break-words rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                    >
                      {company.name}
                    </span>
                  ))}
                {pendingBackup.backup.data.companies.length > 6 && (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                    +{pendingBackup.backup.data.companies.length - 6} more
                  </span>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3 text-amber-900">
                <AlertTriangle
                  size={19}
                  className="mt-0.5 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6">
                  Restore replaces the entire current workspace. LedgerFlow will
                  download a pre-restore safety backup first.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestoreStep("prepare-safety")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700"
              >
                <Upload size={16} aria-hidden="true" />
                Review restore
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
            <History size={20} className="text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Recent backup activity
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                The latest {BACKUP_HISTORY_LIMIT} actions recorded in this browser.
              </p>
            </div>
          </div>

          {historyState.entries.length === 0 ? (
            <div className="p-8 text-center">
              <History
                size={28}
                className="mx-auto text-slate-300"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-slate-700">
                No backup activity recorded
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Downloads and successful restores will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {historyState.entries.map((entry) => {
                const historyLabel = HISTORY_LABELS[entry.action];
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${historyLabel.className}`}
                        >
                          {historyLabel.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDateTime(entry.occurredAt)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium text-slate-800">
                        {entry.fileName}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">
                      {entry.counts.companies.toLocaleString("en-IN")} companies,{" "}
                      {entry.counts.transactions.toLocaleString("en-IN")} transactions
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-blue-200">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Keep backup files private</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Backup JSON is not encrypted. It contains company details, contacts,
            ledger amounts, descriptions, notes, and settings. Store it in a
            trusted location.
          </p>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-slate-100">
              Attachment limitation
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              LedgerFlow currently stores attachment names or references only.
              The underlying files are not part of this backup.
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={restoreStep !== "closed"}
        title={
          restoreStep === "confirm-restore"
            ? "Is the safety backup in your Downloads?"
            : "Prepare to restore this full backup?"
        }
        description={
          !pendingBackup
            ? "Choose and validate a backup file before restoring."
            : restoreStep === "confirm-restore"
              ? `Confirm that the pre-restore JSON file is visible in your Downloads. Restore will then replace the current workspace with the validated backup created ${formatDateTime(pendingBackup.summary.createdAt)}, containing ${pendingBackup.summary.counts.companies.toLocaleString("en-IN")} companies and ${pendingBackup.summary.counts.transactions.toLocaleString("en-IN")} transactions.`
              : "Restoring replaces every current company, region, party, transaction, and setting. LedgerFlow will first start a safety-backup download of the current workspace, then ask for final confirmation."
        }
        confirmLabel={
          restoreStep === "confirm-restore"
            ? "Restore now"
            : "Download safety backup"
        }
        cancelLabel={
          restoreStep === "confirm-restore" ? "Not yet" : "Cancel"
        }
        tone="danger"
        onCancel={() => setRestoreStep("closed")}
        onConfirm={
          restoreStep === "confirm-restore"
            ? confirmRestore
            : prepareSafetyBackup
        }
      />
    </div>
  );
}
