import assert from "node:assert/strict";

import {
  BACKUP_HISTORY_LIMIT,
  BACKUP_HISTORY_STORAGE_KEY,
  createBackupFileName,
  createBackupHistoryEntry,
  createBackupSummary,
  createLedgerFlowBackup,
  loadBackupHistory,
  parseLedgerFlowBackup,
  prependBackupHistory,
  saveBackupHistory,
  serializeLedgerFlowBackup,
} from "../src/utils/backup";
import { paginateItems } from "../src/utils/pagination";
import {
  calculateDateRangeReport,
  calculatePartyStatement,
  calculateRegionReport,
  validateReportDateRange,
} from "../src/utils/reportCalculations";
import type { SettingsStorageLike } from "../src/utils/settingsStorage";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "../src/utils/settingsStorage";
import {
  WORKSPACE_STORAGE_KEY,
  cloneWorkspace,
  loadWorkspace,
  saveWorkspace,
  validateWorkspace,
} from "../src/utils/workspaceStorage";

class MemoryStorage implements SettingsStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createLegacyStorage() {
  const storage = new MemoryStorage();
  const legacySettings = cloneValue(DEFAULT_SETTINGS);
  legacySettings.business.companyName = "  ACME   Traders  ";
  legacySettings.business.phone = "+91 legacy contact";
  legacySettings.business.email = "legacy-email-value";
  legacySettings.business.statementHeader = "ACME account statement";
  legacySettings.print.showNotes = false;
  legacySettings.appearance.theme = "dark";

  storage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      format: "ledgerflow-settings",
      version: 1,
      savedAt: "2026-09-01T10:00:00.000Z",
      settings: legacySettings,
    }),
  );
  storage.setItem(
    "ledgerflow-data-v1",
    JSON.stringify({
      regions: [{ id: 11, name: "Punjab" }],
      parties: [
        {
          id: 21,
          name: "ABC Traders",
          phone: "9876543210",
          regionId: 11,
          address: "Amritsar",
          gstin: "03ABCDE1234F1Z5",
          notes: "Legacy party",
          createdAt: "2026-08-01T10:00:00",
        },
      ],
      transactions: [
        {
          id: 31,
          partyId: 21,
          type: "CREDIT",
          amount: 1250,
          transactionDateTime: " ",
          date: "2026-08-15",
          description: "Legacy invoice",
          notes: "",
          createdAt: "2026-08-15T10:00:00",
        },
      ],
    }),
  );

  return storage;
}

function verifyLegacyMigration() {
  const storage = createLegacyStorage();
  const migrated = loadWorkspace(storage);

  assert.equal(migrated.source, "legacy");
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.shouldPersist, true);
  assert.equal(migrated.workspace.companies.length, 1);
  assert.equal(migrated.workspace.companies[0].name, "Acme Traders");
  assert.equal(
    migrated.workspace.companies[0].settings.statementHeader,
    "ACME account statement",
  );
  assert.equal(
    migrated.workspace.companies[0].phone,
    "+91 legacy contact",
  );
  assert.equal(
    migrated.workspace.companies[0].email,
    "legacy-email-value",
  );
  assert.equal(migrated.workspace.applicationSettings.appearance.theme, "dark");
  assert.ok(migrated.workspace.regions.every((region) => region.companyId === 1));
  assert.ok(migrated.workspace.parties.every((party) => party.companyId === 1));
  assert.ok(
    migrated.workspace.transactions.every(
      (transaction) => transaction.companyId === 1,
    ),
  );
  assert.equal(
    migrated.workspace.transactions[0].transactionDateTime,
    "2026-08-15T00:00:00",
  );

  const saved = saveWorkspace(migrated.workspace, storage);
  assert.equal(saved.ok, true);
  assert.notEqual(storage.getItem(WORKSPACE_STORAGE_KEY), null);
  assert.notEqual(storage.getItem("ledgerflow-data-v1"), null);

  const reloaded = loadWorkspace(storage);
  assert.equal(reloaded.source, "storage");
  assert.equal(reloaded.migrated, false);
  assert.equal(reloaded.shouldPersist, false);
  assert.equal(reloaded.workspace.companies.length, 1);

  return reloaded.workspace;
}

function verifyCompanyIsolation(baseWorkspace: ReturnType<typeof verifyLegacyMigration>) {
  const workspace = cloneWorkspace(baseWorkspace);
  workspace.companies.push({
    ...cloneValue(workspace.companies[0]),
    id: 2,
    name: "Beta Books",
    createdAt: "2026-09-02T10:00:00.000Z",
  });
  workspace.activeCompanyId = 2;
  workspace.regions.push({ id: 12, companyId: 2, name: "PUNJAB" });
  workspace.parties.push({
    ...cloneValue(workspace.parties[0]),
    id: 22,
    companyId: 2,
    regionId: 12,
  });
  workspace.transactions.push({
    ...cloneValue(workspace.transactions[0]),
    id: 32,
    companyId: 2,
    partyId: 22,
  });

  const isolated = validateWorkspace(workspace);
  assert.equal(isolated.ok, true);

  const crossCompanyParty = cloneWorkspace(workspace);
  crossCompanyParty.parties[1].regionId = 11;
  assert.equal(validateWorkspace(crossCompanyParty).ok, false);

  const crossCompanyTransaction = cloneWorkspace(workspace);
  crossCompanyTransaction.transactions[1].partyId = 21;
  assert.equal(validateWorkspace(crossCompanyTransaction).ok, false);

  const duplicateRegion = cloneWorkspace(workspace);
  duplicateRegion.regions.push({ id: 13, companyId: 2, name: " punjab " });
  assert.equal(validateWorkspace(duplicateRegion).ok, false);

  const invalidTimestamp = cloneWorkspace(workspace);
  invalidTimestamp.transactions[1].transactionDateTime = "not-a-date";
  assert.equal(validateWorkspace(invalidTimestamp).ok, false);
}

function verifyCorruptCanonicalProtection() {
  const storage = new MemoryStorage();
  const corruptValue = "{not valid json";
  storage.setItem(WORKSPACE_STORAGE_KEY, corruptValue);

  const loaded = loadWorkspace(storage);
  assert.equal(loaded.error?.code, "PARSE_FAILED");
  assert.equal(loaded.shouldPersist, false);
  assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY), corruptValue);
}

function verifyBackupRoundTrip(
  workspace: ReturnType<typeof verifyLegacyMigration>,
) {
  const createdAt = new Date("2026-09-06T08:30:15.000Z");
  const backup = createLedgerFlowBackup(workspace, createdAt);
  const summary = createBackupSummary(backup);

  assert.equal(backup.format, "ledgerflow-backup");
  assert.equal(backup.version, 1);
  assert.equal(backup.scope, "full");
  assert.equal(backup.createdAt, createdAt.toISOString());
  assert.equal(summary.counts.companies, workspace.companies.length);
  assert.equal(summary.counts.transactions, workspace.transactions.length);
  assert.match(
    createBackupFileName(backup),
    /^ledgerflow-full-backup-.*\.json$/,
  );

  const parsed = parseLedgerFlowBackup(serializeLedgerFlowBackup(backup));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error(parsed.error);
  assert.deepEqual(parsed.backup.data, workspace);

  const futureBackup = cloneValue(backup) as unknown as Record<string, unknown>;
  futureBackup.version = 2;
  const futureResult = parseLedgerFlowBackup(JSON.stringify(futureBackup));
  assert.equal(futureResult.ok, false);
  if (futureResult.ok) throw new Error("A future backup version was accepted.");
  assert.match(futureResult.error, /newer LedgerFlow version/i);

  const crossCompanyBackup = cloneValue(backup);
  crossCompanyBackup.data.companies.push({
    ...cloneValue(crossCompanyBackup.data.companies[0]),
    id: 2,
    name: "Backup Company B",
  });
  crossCompanyBackup.data.transactions[0].companyId = 2;
  const crossCompanyResult = parseLedgerFlowBackup(
    JSON.stringify(crossCompanyBackup),
  );
  assert.equal(crossCompanyResult.ok, false);

  const invalidTimestampBackup = cloneValue(backup);
  invalidTimestampBackup.createdAt = "2026-09-06";
  assert.equal(
    parseLedgerFlowBackup(JSON.stringify(invalidTimestampBackup)).ok,
    false,
  );

  return { backup, summary };
}

function verifyBackupHistory(
  backupResult: ReturnType<typeof verifyBackupRoundTrip>,
) {
  let entries = [] as ReturnType<typeof createBackupHistoryEntry>[];

  for (let index = 0; index < BACKUP_HISTORY_LIMIT + 3; index += 1) {
    const entry = createBackupHistoryEntry(
      "backup",
      `backup-${index}.json`,
      backupResult.summary,
      new Date(Date.UTC(2026, 8, 6, 9, index)),
    );
    entries = prependBackupHistory(entries, entry);
  }

  assert.equal(entries.length, BACKUP_HISTORY_LIMIT);

  const storage = new MemoryStorage();
  assert.equal(saveBackupHistory(entries, storage).ok, true);
  const loaded = loadBackupHistory(storage);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.entries, entries);

  storage.setItem(BACKUP_HISTORY_STORAGE_KEY, "{invalid");
  const corruptHistory = loadBackupHistory(storage);
  assert.equal(corruptHistory.entries.length, 0);
  assert.notEqual(corruptHistory.error, null);
}

function verifyPagination() {
  const values = Array.from({ length: 23 }, (_, index) => index + 1);
  const finalPage = paginateItems(values, 3, 10);
  assert.deepEqual(finalPage.items, [21, 22, 23]);
  assert.equal(finalPage.firstVisible, 21);
  assert.equal(finalPage.lastVisible, 23);
  assert.equal(finalPage.totalPages, 3);

  const clamped = paginateItems(values, 99, 10);
  assert.equal(clamped.page, 3);
  assert.deepEqual(clamped.items, [21, 22, 23]);

  const empty = paginateItems([], 4, 0);
  assert.equal(empty.page, 1);
  assert.equal(empty.pageSize, 10);
  assert.equal(empty.firstVisible, 0);
  assert.equal(empty.lastVisible, 0);
}

function verifyReportCalculations(
  workspace: ReturnType<typeof verifyLegacyMigration>,
) {
  const party = workspace.parties[0];
  const region = workspace.regions[0];
  const baseTransaction = workspace.transactions[0];
  const transactions = [
    {
      ...baseTransaction,
      id: 101,
      type: "CREDIT" as const,
      amount: 100,
      transactionDateTime: "2026-08-10T09:00:00",
    },
    {
      ...baseTransaction,
      id: 102,
      type: "DEBIT" as const,
      amount: 40,
      transactionDateTime: "2026-08-20T09:00:00",
    },
  ];

  const statement = calculatePartyStatement({
    partyId: party.id,
    transactions,
    from: "2026-08-15",
    to: "2026-08-31",
  });
  assert.equal(statement.isValid, true);
  assert.equal(statement.openingBalance, 100);
  assert.equal(statement.totalDebit, 40);
  assert.equal(statement.closingBalance, 60);
  assert.equal(statement.rows.length, 1);

  const dateRange = calculateDateRangeReport({ transactions });
  assert.equal(dateRange.totalCredit, 100);
  assert.equal(dateRange.totalDebit, 40);
  assert.equal(dateRange.netMovement, 60);

  const regionReport = calculateRegionReport({
    regions: [region],
    parties: [party],
    transactions,
  });
  assert.equal(regionReport.isValid, true);
  assert.equal(regionReport.totals.regionCount, 1);
  assert.equal(regionReport.totals.partyCount, 1);
  assert.equal(regionReport.totals.closingBalance, 60);

  const invalidRange = validateReportDateRange({
    from: "2026-09-01",
    to: "2026-08-01",
  });
  assert.equal(invalidRange.isValid, false);
  assert.equal(invalidRange.issues[0]?.code, "INVALID_DATE_RANGE");
}

const migratedWorkspace = verifyLegacyMigration();
verifyCompanyIsolation(migratedWorkspace);
verifyCorruptCanonicalProtection();
const backupResult = verifyBackupRoundTrip(migratedWorkspace);
verifyBackupHistory(backupResult);
verifyPagination();
verifyReportCalculations(migratedWorkspace);

console.log(
  "Migration, company isolation, backup, pagination, and report checks passed.",
);
