import type { LedgerWorkspace } from "./workspace";

export interface LedgerFlowBackupV1 {
  format: "ledgerflow-backup";
  version: 1;
  scope: "full";
  createdAt: string;
  data: LedgerWorkspace;
}

export interface BackupCounts {
  companies: number;
  regions: number;
  parties: number;
  transactions: number;
}

export interface BackupSummary {
  createdAt: string;
  activeCompanyName: string;
  counts: BackupCounts;
}

export type BackupParseResult =
  | {
      ok: true;
      backup: LedgerFlowBackupV1;
      summary: BackupSummary;
    }
  | {
      ok: false;
      error: string;
    };

export type BackupHistoryAction =
  | "backup"
  | "safety"
  | "restore";

export interface BackupHistoryEntry {
  id: string;
  action: BackupHistoryAction;
  occurredAt: string;
  fileName: string;
  backupCreatedAt: string;
  activeCompanyName: string;
  counts: BackupCounts;
}

export interface BackupHistoryLoadResult {
  entries: BackupHistoryEntry[];
  error: string | null;
}

export type BackupHistorySaveResult =
  | {
      ok: true;
      error: null;
    }
  | {
      ok: false;
      error: string;
    };
