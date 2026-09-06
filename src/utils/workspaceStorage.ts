import {
  seedParties,
  seedRegions,
  seedTransactions,
} from "../data/seedData";

import type {
  Company,
  LedgerTransaction,
  Party,
  Region,
  TransactionType,
} from "../types";

import type {
  LedgerWorkspace,
} from "../types/workspace";

import type {
  AppearanceSettings,
  PrintSettings,
  SettingsStorageError,
} from "../types/settings";

import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_PRINT_SETTINGS,
  loadSettings,
} from "./settingsStorage";

import type {
  SettingsSaveResult,
  SettingsStorageLike,
} from "./settingsStorage";

import {
  normalizeForComparison,
  normalizeSpaces,
  toDisplayName,
} from "./text";

export const WORKSPACE_STORAGE_KEY =
  "ledgerflow-workspace";

export const WORKSPACE_STORAGE_VERSION = 1;

const WORKSPACE_STORAGE_FORMAT =
  "ledgerflow-workspace";

const LEGACY_LEDGER_STORAGE_KEY =
  "ledgerflow-data-v1";

export interface WorkspaceLoadResult {
  workspace: LedgerWorkspace;
  error: SettingsStorageError | null;
  source: "storage" | "legacy" | "defaults";
  migrated: boolean;
  shouldPersist: boolean;
}

export type WorkspaceValidationResult =
  | {
      ok: true;
      workspace: LedgerWorkspace;
    }
  | {
      ok: false;
      error: SettingsStorageError;
    };

interface WorkspaceStorageEnvelope {
  format: typeof WORKSPACE_STORAGE_FORMAT;
  version: typeof WORKSPACE_STORAGE_VERSION;
  savedAt: string;
  data: LedgerWorkspace;
}

class ValidationFailure extends Error {}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requireRecord(
  value: unknown,
  label: string,
) {
  if (!isRecord(value)) {
    throw new ValidationFailure(
      `${label} must be an object.`,
    );
  }

  return value;
}

function requireArray(
  value: unknown,
  label: string,
) {
  if (!Array.isArray(value)) {
    throw new ValidationFailure(
      `${label} must be a list.`,
    );
  }

  return value;
}

function requireString(
  value: unknown,
  label: string,
  allowEmpty = true,
) {
  if (typeof value !== "string") {
    throw new ValidationFailure(
      `${label} must be text.`,
    );
  }

  const trimmed = value.trim();

  if (!allowEmpty && !trimmed) {
    throw new ValidationFailure(
      `${label} is required.`,
    );
  }

  return trimmed;
}

function requireTimestamp(
  value: unknown,
  label: string,
) {
  const timestamp = requireString(value, label, false);

  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ValidationFailure(
      `${label} must contain a valid date and time.`,
    );
  }

  return timestamp;
}

function requireBoolean(
  value: unknown,
  label: string,
) {
  if (typeof value !== "boolean") {
    throw new ValidationFailure(
      `${label} must be true or false.`,
    );
  }

  return value;
}

function requirePositiveInteger(
  value: unknown,
  label: string,
) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new ValidationFailure(
      `${label} must be a positive integer.`,
    );
  }

  return value;
}

function requireOneOf<T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (!allowed.some((item) => item === value)) {
    throw new ValidationFailure(
      `${label} has an unsupported value.`,
    );
  }

  return value as T;
}

function parsePrintSettings(
  value: unknown,
  label: string,
): PrintSettings {
  const print = requireRecord(value, label);

  return {
    defaultTransactionLimit: requireOneOf(
      print.defaultTransactionLimit,
      [10, 25, 50, 100, "ALL"] as const,
      `${label}.defaultTransactionLimit`,
    ),
    showRunningBalance: requireBoolean(
      print.showRunningBalance,
      `${label}.showRunningBalance`,
    ),
    showNotes: requireBoolean(
      print.showNotes,
      `${label}.showNotes`,
    ),
    showAttachment: requireBoolean(
      print.showAttachment,
      `${label}.showAttachment`,
    ),
    showTransactionTime: requireBoolean(
      print.showTransactionTime,
      `${label}.showTransactionTime`,
    ),
    showBusinessAddress: requireBoolean(
      print.showBusinessAddress,
      `${label}.showBusinessAddress`,
    ),
    showBusinessPhone: requireBoolean(
      print.showBusinessPhone,
      `${label}.showBusinessPhone`,
    ),
    showBusinessGstin: requireBoolean(
      print.showBusinessGstin,
      `${label}.showBusinessGstin`,
    ),
    showGeneratedDate: requireBoolean(
      print.showGeneratedDate,
      `${label}.showGeneratedDate`,
    ),
    showPageNumbers: requireBoolean(
      print.showPageNumbers,
      `${label}.showPageNumbers`,
    ),
    paperSize: requireOneOf(
      print.paperSize,
      ["A4"] as const,
      `${label}.paperSize`,
    ),
    orientation: requireOneOf(
      print.orientation,
      ["portrait", "landscape"] as const,
      `${label}.orientation`,
    ),
    fontSize: requireOneOf(
      print.fontSize,
      ["small", "normal", "large"] as const,
      `${label}.fontSize`,
    ),
    customFooter: requireString(
      print.customFooter,
      `${label}.customFooter`,
    ),
  };
}

function parseAppearanceSettings(
  value: unknown,
): AppearanceSettings {
  const appearance = requireRecord(
    value,
    "applicationSettings.appearance",
  );

  return {
    fontFamily: requireOneOf(
      appearance.fontFamily,
      ["inter", "system", "segoe-ui", "arial"] as const,
      "appearance.fontFamily",
    ),
    baseFontSize: requireOneOf(
      appearance.baseFontSize,
      [13, 14, 15, 16] as const,
      "appearance.baseFontSize",
    ),
    uiScale: requireOneOf(
      appearance.uiScale,
      [90, 100, 110, 125] as const,
      "appearance.uiScale",
    ),
    density: requireOneOf(
      appearance.density,
      ["compact", "comfortable", "spacious"] as const,
      "appearance.density",
    ),
    tableDensity: requireOneOf(
      appearance.tableDensity,
      ["compact", "normal", "comfortable"] as const,
      "appearance.tableDensity",
    ),
    accentColor: requireOneOf(
      appearance.accentColor,
      ["blue", "indigo", "emerald", "slate"] as const,
      "appearance.accentColor",
    ),
    theme: requireOneOf(
      appearance.theme,
      ["light", "dark", "system"] as const,
      "appearance.theme",
    ),
  };
}

function parseCompany(
  value: unknown,
  index: number,
): Company {
  const label = `companies[${index}]`;
  const company = requireRecord(value, label);
  const settings = requireRecord(
    company.settings,
    `${label}.settings`,
  );
  const name = toDisplayName(
    requireString(company.name, `${label}.name`, false),
  );
  const phone = requireString(
    company.phone,
    `${label}.phone`,
  );
  const email = requireString(
    company.email,
    `${label}.email`,
  );

  return {
    id: requirePositiveInteger(
      company.id,
      `${label}.id`,
    ),
    name,
    address: requireString(
      company.address,
      `${label}.address`,
    ),
    phone,
    gstin: requireString(
      company.gstin,
      `${label}.gstin`,
    ).toUpperCase(),
    email,
    createdAt: requireTimestamp(
      company.createdAt,
      `${label}.createdAt`,
    ),
    settings: {
      statementHeader: requireString(
        settings.statementHeader,
        `${label}.settings.statementHeader`,
      ),
      statementFooter: requireString(
        settings.statementFooter,
        `${label}.settings.statementFooter`,
      ),
      print: parsePrintSettings(
        settings.print,
        `${label}.settings.print`,
      ),
    },
  };
}

function parseRegion(
  value: unknown,
  index: number,
): Region {
  const label = `regions[${index}]`;
  const region = requireRecord(value, label);

  return {
    id: requirePositiveInteger(region.id, `${label}.id`),
    companyId: requirePositiveInteger(
      region.companyId,
      `${label}.companyId`,
    ),
    name: toDisplayName(
      requireString(region.name, `${label}.name`, false),
    ),
  };
}

function parseParty(
  value: unknown,
  index: number,
): Party {
  const label = `parties[${index}]`;
  const party = requireRecord(value, label);
  const phone = requireString(
    party.phone,
    `${label}.phone`,
  );

  return {
    id: requirePositiveInteger(party.id, `${label}.id`),
    companyId: requirePositiveInteger(
      party.companyId,
      `${label}.companyId`,
    ),
    name: toDisplayName(
      requireString(party.name, `${label}.name`, false),
    ),
    phone,
    regionId: requirePositiveInteger(
      party.regionId,
      `${label}.regionId`,
    ),
    address: requireString(
      party.address,
      `${label}.address`,
    ),
    gstin: requireString(
      party.gstin,
      `${label}.gstin`,
    ).toUpperCase(),
    notes: requireString(
      party.notes,
      `${label}.notes`,
    ),
    createdAt: requireTimestamp(
      party.createdAt,
      `${label}.createdAt`,
    ),
  };
}

function parseTransaction(
  value: unknown,
  index: number,
): LedgerTransaction {
  const label = `transactions[${index}]`;
  const transaction = requireRecord(value, label);
  const amount = transaction.amount;

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new ValidationFailure(
      `${label}.amount must be greater than zero.`,
    );
  }

  const attachment = transaction.attachmentName;

  if (
    attachment !== undefined &&
    typeof attachment !== "string"
  ) {
    throw new ValidationFailure(
      `${label}.attachmentName must be text when present.`,
    );
  }

  return {
    id: requirePositiveInteger(
      transaction.id,
      `${label}.id`,
    ),
    companyId: requirePositiveInteger(
      transaction.companyId,
      `${label}.companyId`,
    ),
    partyId: requirePositiveInteger(
      transaction.partyId,
      `${label}.partyId`,
    ),
    type: requireOneOf<TransactionType>(
      transaction.type,
      ["CREDIT", "DEBIT"],
      `${label}.type`,
    ),
    amount,
    transactionDateTime: requireTimestamp(
      transaction.transactionDateTime,
      `${label}.transactionDateTime`,
    ),
    description: requireString(
      transaction.description,
      `${label}.description`,
      false,
    ),
    notes: requireString(
      transaction.notes,
      `${label}.notes`,
    ),
    ...(attachment === undefined || !attachment.trim()
      ? {}
      : { attachmentName: attachment.trim() }),
    createdAt: requireTimestamp(
      transaction.createdAt,
      `${label}.createdAt`,
    ),
  };
}

function assertUniqueIds(
  items: ReadonlyArray<{ id: number }>,
  label: string,
) {
  const seen = new Set<number>();

  for (const item of items) {
    if (seen.has(item.id)) {
      throw new ValidationFailure(
        `${label} contains duplicate id ${item.id}.`,
      );
    }

    seen.add(item.id);
  }
}

export function validateWorkspace(
  value: unknown,
): WorkspaceValidationResult {
  try {
    const workspace = requireRecord(value, "workspace");
    const applicationSettings = requireRecord(
      workspace.applicationSettings,
      "applicationSettings",
    );
    const companies = requireArray(
      workspace.companies,
      "companies",
    ).map(parseCompany);
    const regions = requireArray(
      workspace.regions,
      "regions",
    ).map(parseRegion);
    const parties = requireArray(
      workspace.parties,
      "parties",
    ).map(parseParty);
    const transactions = requireArray(
      workspace.transactions,
      "transactions",
    ).map(parseTransaction);
    const activeCompanyId = requirePositiveInteger(
      workspace.activeCompanyId,
      "activeCompanyId",
    );

    if (companies.length === 0) {
      throw new ValidationFailure(
        "At least one company is required.",
      );
    }

    assertUniqueIds(companies, "companies");
    assertUniqueIds(regions, "regions");
    assertUniqueIds(parties, "parties");
    assertUniqueIds(transactions, "transactions");

    const companyIds = new Set(
      companies.map((company) => company.id),
    );

    if (!companyIds.has(activeCompanyId)) {
      throw new ValidationFailure(
        "activeCompanyId does not reference an existing company.",
      );
    }

    const companyNames = new Set<string>();
    for (const company of companies) {
      const key = normalizeForComparison(company.name);
      if (companyNames.has(key)) {
        throw new ValidationFailure(
          `Duplicate company name: ${company.name}.`,
        );
      }
      companyNames.add(key);
    }

    const regionById = new Map<number, Region>();
    const regionNames = new Set<string>();
    for (const region of regions) {
      if (!companyIds.has(region.companyId)) {
        throw new ValidationFailure(
          `Region ${region.id} references a missing company.`,
        );
      }
      const key = `${region.companyId}:${normalizeForComparison(region.name)}`;
      if (regionNames.has(key)) {
        throw new ValidationFailure(
          `Duplicate region name in company ${region.companyId}: ${region.name}.`,
        );
      }
      regionNames.add(key);
      regionById.set(region.id, region);
    }

    const partyById = new Map<number, Party>();
    const partyNames = new Set<string>();
    const partyGstins = new Set<string>();
    for (const party of parties) {
      const region = regionById.get(party.regionId);
      if (
        !companyIds.has(party.companyId) ||
        !region ||
        region.companyId !== party.companyId
      ) {
        throw new ValidationFailure(
          `Party ${party.id} has a cross-company or missing region reference.`,
        );
      }
      const nameKey = `${party.companyId}:${party.regionId}:${normalizeForComparison(party.name)}`;
      if (partyNames.has(nameKey)) {
        throw new ValidationFailure(
          `Duplicate party name in region ${party.regionId}: ${party.name}.`,
        );
      }
      partyNames.add(nameKey);
      if (party.gstin) {
        const gstinKey = `${party.companyId}:${normalizeForComparison(party.gstin)}`;
        if (partyGstins.has(gstinKey)) {
          throw new ValidationFailure(
            `Duplicate party GSTIN in company ${party.companyId}: ${party.gstin}.`,
          );
        }
        partyGstins.add(gstinKey);
      }
      partyById.set(party.id, party);
    }

    for (const transaction of transactions) {
      const party = partyById.get(transaction.partyId);
      if (
        !companyIds.has(transaction.companyId) ||
        !party ||
        party.companyId !== transaction.companyId
      ) {
        throw new ValidationFailure(
          `Transaction ${transaction.id} has a cross-company or missing party reference.`,
        );
      }
    }

    return {
      ok: true,
      workspace: {
        companies,
        activeCompanyId,
        regions,
        parties,
        transactions,
        applicationSettings: {
          appearance: parseAppearanceSettings(
            applicationSettings.appearance,
          ),
        },
      },
    };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: "INVALID_DATA",
        message:
          cause instanceof Error
            ? cause.message
            : "The workspace has an invalid structure.",
        cause,
      },
    };
  }
}

export function cloneWorkspace(
  workspace: Readonly<LedgerWorkspace>,
): LedgerWorkspace {
  return {
    companies: workspace.companies.map((company) => ({
      ...company,
      settings: {
        ...company.settings,
        print: { ...company.settings.print },
      },
    })),
    activeCompanyId: workspace.activeCompanyId,
    regions: workspace.regions.map((region) => ({ ...region })),
    parties: workspace.parties.map((party) => ({ ...party })),
    transactions: workspace.transactions.map((transaction) => ({
      ...transaction,
    })),
    applicationSettings: {
      appearance: { ...workspace.applicationSettings.appearance },
    },
  };
}

function createInitialCompany(
  settings: ReturnType<typeof loadSettings>["settings"],
): Company {
  const phone = settings.business.phone.trim();
  const email = settings.business.email.trim();

  return {
    id: 1,
    name:
      toDisplayName(settings.business.companyName) ||
      "Your Company",
    address: settings.business.address.trim(),
    phone,
    gstin: settings.business.gstin.trim().toUpperCase(),
    email,
    createdAt: new Date().toISOString(),
    settings: {
      statementHeader: settings.business.statementHeader.trim(),
      statementFooter: settings.business.statementFooter.trim(),
      print: { ...settings.print },
    },
  };
}

function createDefaultWorkspace(
  settings: ReturnType<typeof loadSettings>["settings"],
): LedgerWorkspace {
  return {
    companies: [createInitialCompany(settings)],
    activeCompanyId: 1,
    regions: seedRegions.map((region) => ({ ...region, companyId: 1 })),
    parties: seedParties.map((party) => ({ ...party, companyId: 1 })),
    transactions: seedTransactions.map((transaction) => ({
      ...transaction,
      companyId: 1,
    })),
    applicationSettings: {
      appearance: { ...settings.appearance },
    },
  };
}

function migrateLegacyWorkspace(
  parsed: unknown,
  settings: ReturnType<typeof loadSettings>["settings"],
): WorkspaceValidationResult {
  const legacy = requireRecord(parsed, "legacy workspace");
  const regions = requireArray(legacy.regions, "legacy regions").map(
    (value, index) => {
      const region = requireRecord(value, `legacy regions[${index}]`);
      return {
        id: requirePositiveInteger(region.id, `legacy regions[${index}].id`),
        companyId: 1,
        name: toDisplayName(
          requireString(region.name, `legacy regions[${index}].name`, false),
        ),
      };
    },
  );
  const parties = requireArray(legacy.parties, "legacy parties").map(
    (value, index) => {
      const party = requireRecord(value, `legacy parties[${index}]`);
      return {
        id: requirePositiveInteger(party.id, `legacy parties[${index}].id`),
        companyId: 1,
        name: toDisplayName(
          requireString(party.name, `legacy parties[${index}].name`, false),
        ),
        phone: requireString(party.phone ?? "", `legacy parties[${index}].phone`),
        regionId: requirePositiveInteger(
          party.regionId,
          `legacy parties[${index}].regionId`,
        ),
        address: requireString(
          party.address ?? "",
          `legacy parties[${index}].address`,
        ),
        gstin: requireString(
          party.gstin ?? "",
          `legacy parties[${index}].gstin`,
        ).toUpperCase(),
        notes: requireString(
          party.notes ?? "",
          `legacy parties[${index}].notes`,
        ),
        createdAt: requireString(
          party.createdAt ?? new Date().toISOString(),
          `legacy parties[${index}].createdAt`,
          false,
        ),
      };
    },
  );
  const transactions = requireArray(
    legacy.transactions,
    "legacy transactions",
  ).map((value, index) => {
    const transaction = requireRecord(
      value,
      `legacy transactions[${index}]`,
    );
    const savedTransactionDate =
      typeof transaction.transactionDateTime === "string"
        ? transaction.transactionDateTime.trim()
        : "";
    const savedLegacyDate =
      typeof transaction.date === "string"
        ? transaction.date.trim()
        : "";
    const legacyDate = savedTransactionDate
      ? savedTransactionDate
      : savedLegacyDate
        ? `${savedLegacyDate}T00:00:00`
        : new Date().toISOString();

    return {
      id: requirePositiveInteger(
        transaction.id,
        `legacy transactions[${index}].id`,
      ),
      companyId: 1,
      partyId: requirePositiveInteger(
        transaction.partyId,
        `legacy transactions[${index}].partyId`,
      ),
      type: requireOneOf<TransactionType>(
        transaction.type,
        ["CREDIT", "DEBIT"],
        `legacy transactions[${index}].type`,
      ),
      amount: transaction.amount,
      transactionDateTime: legacyDate,
      description: transaction.description,
      notes: transaction.notes ?? "",
      attachmentName: transaction.attachmentName,
      createdAt: transaction.createdAt ?? new Date().toISOString(),
    };
  });

  return validateWorkspace({
    companies: [createInitialCompany(settings)],
    activeCompanyId: 1,
    regions,
    parties,
    transactions,
    applicationSettings: {
      appearance: { ...settings.appearance },
    },
  });
}

function resolveStorage(
  suppliedStorage?: SettingsStorageLike | null,
) {
  if (suppliedStorage) {
    return { storage: suppliedStorage, error: null };
  }

  if (suppliedStorage === null || typeof window === "undefined") {
    return {
      storage: null,
      error: {
        code: "STORAGE_UNAVAILABLE" as const,
        message:
          "Browser storage is unavailable. Workspace changes will only last for this session.",
      },
    };
  }

  try {
    return { storage: window.localStorage, error: null };
  } catch (cause) {
    return {
      storage: null,
      error: {
        code: "STORAGE_UNAVAILABLE" as const,
        message:
          "Browser storage is unavailable. Workspace changes will only last for this session.",
        cause,
      },
    };
  }
}

export function loadWorkspace(
  suppliedStorage?: SettingsStorageLike | null,
): WorkspaceLoadResult {
  const resolution = resolveStorage(suppliedStorage);
  const legacySettings = loadSettings(
    resolution.storage ?? suppliedStorage,
  );
  const fallback = createDefaultWorkspace(legacySettings.settings);

  if (!resolution.storage) {
    return {
      workspace: fallback,
      error: resolution.error,
      source: "defaults",
      migrated: false,
      shouldPersist: false,
    };
  }

  let canonical: string | null;
  try {
    canonical = resolution.storage.getItem(WORKSPACE_STORAGE_KEY);
  } catch (cause) {
    return {
      workspace: fallback,
      error: {
        code: "READ_FAILED",
        message:
          "LedgerFlow could not read the saved workspace. Safe demo data is being used for this session.",
        cause,
      },
      source: "defaults",
      migrated: false,
      shouldPersist: false,
    };
  }

  if (canonical !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(canonical);
    } catch (cause) {
      return {
        workspace: fallback,
        error: {
          code: "PARSE_FAILED",
          message:
            "The saved LedgerFlow workspace is corrupted. It was left untouched and safe demo data is active for this session.",
          cause,
        },
        source: "defaults",
        migrated: false,
        shouldPersist: false,
      };
    }

    if (!isRecord(parsed) || parsed.format !== WORKSPACE_STORAGE_FORMAT) {
      return {
        workspace: fallback,
        error: {
          code: "INVALID_DATA",
          message:
            "The saved workspace does not match the LedgerFlow format and was left untouched.",
        },
        source: "defaults",
        migrated: false,
        shouldPersist: false,
      };
    }

    if (parsed.version !== WORKSPACE_STORAGE_VERSION) {
      const newer =
        typeof parsed.version === "number" &&
        parsed.version > WORKSPACE_STORAGE_VERSION;
      return {
        workspace: fallback,
        error: {
          code: newer ? "UNSUPPORTED_VERSION" : "INVALID_DATA",
          message: newer
            ? "This workspace was created by a newer LedgerFlow version and was left untouched."
            : "The saved workspace version is invalid or unsupported.",
        },
        source: "defaults",
        migrated: false,
        shouldPersist: false,
      };
    }

    try {
      requireTimestamp(parsed.savedAt, "savedAt");
    } catch (cause) {
      return {
        workspace: fallback,
        error: {
          code: "INVALID_DATA",
          message:
            cause instanceof Error
              ? cause.message
              : "The saved workspace timestamp is invalid.",
          cause,
        },
        source: "defaults",
        migrated: false,
        shouldPersist: false,
      };
    }

    const validated = validateWorkspace(parsed.data);
    if (!validated.ok) {
      return {
        workspace: fallback,
        error: validated.error,
        source: "defaults",
        migrated: false,
        shouldPersist: false,
      };
    }

    return {
      workspace: validated.workspace,
      error: null,
      source: "storage",
      migrated: false,
      shouldPersist: false,
    };
  }

  let legacyValue: string | null;
  try {
    legacyValue = resolution.storage.getItem(
      LEGACY_LEDGER_STORAGE_KEY,
    );
  } catch (cause) {
    return {
      workspace: fallback,
      error: {
        code: "READ_FAILED",
        message:
          "LedgerFlow could not read legacy ledger data. It was left untouched.",
        cause,
      },
      source: "defaults",
      migrated: false,
      shouldPersist: false,
    };
  }

  if (legacyValue === null) {
    return {
      workspace: fallback,
      error: legacySettings.error,
      source: "defaults",
      migrated: true,
      shouldPersist: true,
    };
  }

  try {
    const migrated = migrateLegacyWorkspace(
      JSON.parse(legacyValue),
      legacySettings.settings,
    );

    if (!migrated.ok) {
      return {
        workspace: fallback,
        error: migrated.error,
        source: "defaults",
        migrated: false,
        shouldPersist: false,
      };
    }

    return {
      workspace: migrated.workspace,
      error: legacySettings.error,
      source: "legacy",
      migrated: true,
      shouldPersist: true,
    };
  } catch (cause) {
    return {
      workspace: fallback,
      error: {
        code: "PARSE_FAILED",
        message:
          "Legacy ledger data could not be migrated. It was left untouched and safe demo data is active for this session.",
        cause,
      },
      source: "defaults",
      migrated: false,
      shouldPersist: false,
    };
  }
}

export function saveWorkspace(
  workspace: Readonly<LedgerWorkspace>,
  suppliedStorage?: SettingsStorageLike | null,
): SettingsSaveResult {
  const validated = validateWorkspace(workspace);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.error,
    };
  }

  const resolution = resolveStorage(suppliedStorage);
  if (!resolution.storage) {
    return {
      ok: false,
      error:
        resolution.error ?? {
          code: "STORAGE_UNAVAILABLE",
          message:
            "Browser storage is unavailable. Workspace changes will only last for this session.",
        },
    };
  }

  const envelope: WorkspaceStorageEnvelope = {
    format: WORKSPACE_STORAGE_FORMAT,
    version: WORKSPACE_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    data: validated.workspace,
  };

  try {
    resolution.storage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(envelope),
    );
    return { ok: true, error: null };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: "WRITE_FAILED",
        message:
          "Changes are active for this session, but LedgerFlow could not save the workspace to this browser.",
        cause,
      },
    };
  }
}

export function createSafeDefaultWorkspace() {
  return createDefaultWorkspace({
    business: { ...DEFAULT_BUSINESS_SETTINGS },
    print: { ...DEFAULT_PRINT_SETTINGS },
    appearance: { ...DEFAULT_APPEARANCE_SETTINGS },
  });
}

export function normalizeCompanyName(value: string) {
  return toDisplayName(normalizeSpaces(value));
}
