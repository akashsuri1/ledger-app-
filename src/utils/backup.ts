import type {
  BackupCounts,
  BackupHistoryAction,
  BackupHistoryEntry,
  BackupHistoryLoadResult,
  BackupHistorySaveResult,
  BackupParseResult,
  BackupSummary,
  LedgerFlowBackupV1,
} from "../types/backup";

import type { LedgerWorkspace } from "../types/workspace";

import {
  cloneWorkspace,
  validateWorkspace,
} from "./workspaceStorage";

export const LEDGERFLOW_BACKUP_FORMAT = "ledgerflow-backup";
export const LEDGERFLOW_BACKUP_VERSION = 1;
export const LEDGERFLOW_BACKUP_SCOPE = "full";
export const MAX_BACKUP_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const BACKUP_HISTORY_STORAGE_KEY =
  "ledgerflow-backup-history";
export const BACKUP_HISTORY_LIMIT = 8;

const BACKUP_HISTORY_FORMAT = "ledgerflow-backup-history";
const BACKUP_HISTORY_VERSION = 1;

interface BackupMetadataStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface BackupHistoryEnvelope {
  format: typeof BACKUP_HISTORY_FORMAT;
  version: typeof BACKUP_HISTORY_VERSION;
  savedAt: string;
  entries: BackupHistoryEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;

  return new Date(milliseconds).toISOString() === value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function parseCounts(value: unknown): BackupCounts | null {
  if (!isRecord(value)) return null;

  const { companies, regions, parties, transactions } = value;
  if (
    !isNonNegativeInteger(companies) ||
    !isNonNegativeInteger(regions) ||
    !isNonNegativeInteger(parties) ||
    !isNonNegativeInteger(transactions)
  ) {
    return null;
  }

  return { companies, regions, parties, transactions };
}

function parseHistoryEntry(value: unknown): BackupHistoryEntry | null {
  if (!isRecord(value)) return null;

  const action = value.action;
  if (
    action !== "backup" &&
    action !== "safety" &&
    action !== "restore"
  ) {
    return null;
  }

  const counts = parseCounts(value.counts);
  if (
    typeof value.id !== "string" ||
    !value.id ||
    !isIsoTimestamp(value.occurredAt) ||
    typeof value.fileName !== "string" ||
    !value.fileName.trim() ||
    !isIsoTimestamp(value.backupCreatedAt) ||
    typeof value.activeCompanyName !== "string" ||
    !value.activeCompanyName.trim() ||
    !counts
  ) {
    return null;
  }

  return {
    id: value.id,
    action,
    occurredAt: value.occurredAt,
    fileName: value.fileName.trim(),
    backupCreatedAt: value.backupCreatedAt,
    activeCompanyName: value.activeCompanyName.trim(),
    counts,
  };
}

function resolveMetadataStorage(
  suppliedStorage?: BackupMetadataStorageLike | null,
) {
  if (suppliedStorage) {
    return { storage: suppliedStorage, error: null };
  }

  if (suppliedStorage === null || typeof window === "undefined") {
    return {
      storage: null,
      error:
        "Browser storage is unavailable, so backup activity history cannot be saved.",
    };
  }

  try {
    return { storage: window.localStorage, error: null };
  } catch {
    return {
      storage: null,
      error:
        "Browser storage is unavailable, so backup activity history cannot be saved.",
    };
  }
}

export function createBackupSummary(
  backup: Pick<LedgerFlowBackupV1, "createdAt" | "data">,
): BackupSummary {
  const activeCompany = backup.data.companies.find(
    (company) => company.id === backup.data.activeCompanyId,
  );

  if (!activeCompany) {
    throw new Error("The backup has no valid active company.");
  }

  return {
    createdAt: backup.createdAt,
    activeCompanyName: activeCompany.name,
    counts: {
      companies: backup.data.companies.length,
      regions: backup.data.regions.length,
      parties: backup.data.parties.length,
      transactions: backup.data.transactions.length,
    },
  };
}

export function createLedgerFlowBackup(
  workspace: Readonly<LedgerWorkspace>,
  createdAt = new Date(),
): LedgerFlowBackupV1 {
  const validated = validateWorkspace(workspace);
  if (!validated.ok) {
    throw new Error(validated.error.message);
  }

  return {
    format: LEDGERFLOW_BACKUP_FORMAT,
    version: LEDGERFLOW_BACKUP_VERSION,
    scope: LEDGERFLOW_BACKUP_SCOPE,
    createdAt: createdAt.toISOString(),
    data: cloneWorkspace(validated.workspace),
  };
}

export function parseLedgerFlowBackup(text: string): BackupParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "This file is not valid JSON and cannot be restored.",
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: "This file does not contain a LedgerFlow backup object.",
    };
  }

  if (parsed.format !== LEDGERFLOW_BACKUP_FORMAT) {
    return {
      ok: false,
      error: "This is not a recognized LedgerFlow backup file.",
    };
  }

  if (
    typeof parsed.version !== "number" ||
    !Number.isSafeInteger(parsed.version)
  ) {
    return {
      ok: false,
      error: "The backup version is missing or invalid.",
    };
  }

  if (parsed.version > LEDGERFLOW_BACKUP_VERSION) {
    return {
      ok: false,
      error:
        "This backup was created by a newer LedgerFlow version and cannot be restored safely here.",
    };
  }

  if (parsed.version !== LEDGERFLOW_BACKUP_VERSION) {
    return {
      ok: false,
      error: `Backup version ${parsed.version} is not supported.`,
    };
  }

  if (parsed.scope !== LEDGERFLOW_BACKUP_SCOPE) {
    return {
      ok: false,
      error: "Only full LedgerFlow backups can be restored.",
    };
  }

  if (!isIsoTimestamp(parsed.createdAt)) {
    return {
      ok: false,
      error: "The backup creation date is missing or invalid.",
    };
  }

  const validated = validateWorkspace(parsed.data);
  if (!validated.ok) {
    return {
      ok: false,
      error: `The backup data is invalid: ${validated.error.message}`,
    };
  }

  const backup: LedgerFlowBackupV1 = {
    format: LEDGERFLOW_BACKUP_FORMAT,
    version: LEDGERFLOW_BACKUP_VERSION,
    scope: LEDGERFLOW_BACKUP_SCOPE,
    createdAt: parsed.createdAt,
    data: cloneWorkspace(validated.workspace),
  };

  return {
    ok: true,
    backup,
    summary: createBackupSummary(backup),
  };
}

export function serializeLedgerFlowBackup(backup: LedgerFlowBackupV1) {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

function fileTimestamp(createdAt: string) {
  return createdAt
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
}

export function createBackupFileName(
  backup: LedgerFlowBackupV1,
  kind: "backup" | "safety" = "backup",
) {
  const prefix =
    kind === "safety"
      ? "ledgerflow-pre-restore"
      : "ledgerflow-full-backup";

  return `${prefix}-${fileTimestamp(backup.createdAt)}.json`;
}

export function downloadLedgerFlowBackup(
  backup: LedgerFlowBackupV1,
  fileName = createBackupFileName(backup),
) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("File downloads are unavailable in this environment.");
  }

  const blob = new Blob([serializeLedgerFlowBackup(backup)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function createBackupHistoryEntry(
  action: BackupHistoryAction,
  fileName: string,
  summary: BackupSummary,
  occurredAt = new Date(),
): BackupHistoryEntry {
  const timestamp = occurredAt.toISOString();

  return {
    id: `${timestamp}-${action}-${Math.random().toString(36).slice(2, 10)}`,
    action,
    occurredAt: timestamp,
    fileName,
    backupCreatedAt: summary.createdAt,
    activeCompanyName: summary.activeCompanyName,
    counts: { ...summary.counts },
  };
}

export function prependBackupHistory(
  entries: ReadonlyArray<BackupHistoryEntry>,
  entry: BackupHistoryEntry,
) {
  return [entry, ...entries]
    .slice(0, BACKUP_HISTORY_LIMIT)
    .map((item) => ({
      ...item,
      counts: { ...item.counts },
    }));
}

export function loadBackupHistory(
  suppliedStorage?: BackupMetadataStorageLike | null,
): BackupHistoryLoadResult {
  const resolution = resolveMetadataStorage(suppliedStorage);
  if (!resolution.storage) {
    return { entries: [], error: resolution.error };
  }

  let stored: string | null;
  try {
    stored = resolution.storage.getItem(BACKUP_HISTORY_STORAGE_KEY);
  } catch {
    return {
      entries: [],
      error: "LedgerFlow could not read the local backup activity history.",
    };
  }

  if (stored === null) {
    return { entries: [], error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return {
      entries: [],
      error:
        "The local backup activity history is corrupted. Backup files and ledger data are unaffected.",
    };
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== BACKUP_HISTORY_FORMAT ||
    parsed.version !== BACKUP_HISTORY_VERSION ||
    !isIsoTimestamp(parsed.savedAt) ||
    !Array.isArray(parsed.entries)
  ) {
    return {
      entries: [],
      error:
        "The local backup activity history has an unsupported format. Backup files and ledger data are unaffected.",
    };
  }

  const entries = parsed.entries.map(parseHistoryEntry);
  if (entries.some((entry) => entry === null)) {
    return {
      entries: [],
      error:
        "The local backup activity history contains invalid entries. Backup files and ledger data are unaffected.",
    };
  }

  return {
    entries: (entries as BackupHistoryEntry[]).slice(
      0,
      BACKUP_HISTORY_LIMIT,
    ),
    error: null,
  };
}

export function saveBackupHistory(
  entries: ReadonlyArray<BackupHistoryEntry>,
  suppliedStorage?: BackupMetadataStorageLike | null,
): BackupHistorySaveResult {
  const resolution = resolveMetadataStorage(suppliedStorage);
  if (!resolution.storage) {
    return {
      ok: false,
      error:
        resolution.error ??
        "Browser storage is unavailable, so backup activity history cannot be saved.",
    };
  }

  const envelope: BackupHistoryEnvelope = {
    format: BACKUP_HISTORY_FORMAT,
    version: BACKUP_HISTORY_VERSION,
    savedAt: new Date().toISOString(),
    entries: entries.slice(0, BACKUP_HISTORY_LIMIT).map((entry) => ({
      ...entry,
      counts: { ...entry.counts },
    })),
  };

  try {
    resolution.storage.setItem(
      BACKUP_HISTORY_STORAGE_KEY,
      JSON.stringify(envelope),
    );
    return { ok: true, error: null };
  } catch {
    return {
      ok: false,
      error:
        "The action completed, but LedgerFlow could not save its local backup activity history.",
    };
  }
}
