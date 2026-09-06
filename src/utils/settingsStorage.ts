import type {
  AccentColor,
  AppFontFamily,
  AppearanceSettings,
  AppearanceTheme,
  AppSettings,
  AppSettingsPatch,
  BaseFontSize,
  BusinessSettings,
  PrintFontSize,
  PrintSettings,
  SettingsStorageError,
  TableDensity,
  UiDensity,
  UiScale,
} from "../types/settings";

import type {
  ReportOrientation,
  TransactionDisplayLimit,
} from "../types/reports";

export const SETTINGS_STORAGE_KEY =
  "ledgerflow-settings";

export const SETTINGS_STORAGE_VERSION = 1;

const SETTINGS_STORAGE_FORMAT =
  "ledgerflow-settings";

const LEGACY_STORAGE_KEYS = [
  "ledgerflow-settings-v1",
] as const;

export const DEFAULT_BUSINESS_SETTINGS:
  Readonly<BusinessSettings> =
  Object.freeze({
    companyName: "",
    address: "",
    phone: "",
    gstin: "",
    email: "",
    statementHeader:
      "Statement of Account",
    statementFooter: "",
    currency: "INR",
  });

export const DEFAULT_PRINT_SETTINGS:
  Readonly<PrintSettings> =
  Object.freeze({
    defaultTransactionLimit: 25,
    showRunningBalance: true,
    showNotes: false,
    showAttachment: true,
    showTransactionTime: true,
    showBusinessAddress: true,
    showBusinessPhone: true,
    showBusinessGstin: true,
    showGeneratedDate: true,
    showPageNumbers: true,
    paperSize: "A4",
    orientation: "portrait",
    fontSize: "normal",
    customFooter: "",
  });

export const DEFAULT_APPEARANCE_SETTINGS:
  Readonly<AppearanceSettings> =
  Object.freeze({
    fontFamily: "inter",
    baseFontSize: 16,
    uiScale: 100,
    density: "comfortable",
    tableDensity: "normal",
    accentColor: "blue",
    theme: "light",
  });

export const DEFAULT_SETTINGS:
  Readonly<AppSettings> =
  Object.freeze({
    business:
      DEFAULT_BUSINESS_SETTINGS,
    print: DEFAULT_PRINT_SETTINGS,
    appearance:
      DEFAULT_APPEARANCE_SETTINGS,
  });

export interface SettingsStorageLike {
  getItem: (key: string) =>
    string | null;
  setItem: (
    key: string,
    value: string,
  ) => void;
}

export interface SettingsLoadResult {
  settings: AppSettings;
  error: SettingsStorageError | null;
  source: "defaults" | "storage";
  migrated: boolean;
}

export type SettingsSaveResult =
  | {
      ok: true;
      error: null;
    }
  | {
      ok: false;
      error: SettingsStorageError;
    };

interface StoredSettingsEnvelope {
  format: typeof SETTINGS_STORAGE_FORMAT;
  version: typeof SETTINGS_STORAGE_VERSION;
  savedAt: string;
  settings: AppSettings;
}

interface StorageResolution {
  storage: SettingsStorageLike | null;
  error: SettingsStorageError | null;
}

function cloneSettings(
  settings: Readonly<AppSettings>,
): AppSettings {
  return {
    business: {
      ...settings.business,
    },
    print: {
      ...settings.print,
    },
    appearance: {
      ...settings.appearance,
    },
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(
  value: unknown,
  fallback: string,
) {
  return typeof value === "string"
    ? value
    : fallback;
}

function readBoolean(
  value: unknown,
  fallback: boolean,
) {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function isOneOf<T extends string | number>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return allowed.some(
    (item) => item === value,
  );
}

function normalizeTransactionLimit(
  value: unknown,
  fallback: TransactionDisplayLimit,
): TransactionDisplayLimit {
  if (
    typeof value === "string" &&
    value.toUpperCase() === "ALL"
  ) {
    return "ALL";
  }

  const numericValue =
    typeof value === "string" &&
    value.trim() !== ""
      ? Number(value)
      : value;

  return isOneOf(
    numericValue,
    [10, 25, 50, 100] as const,
  )
    ? numericValue
    : fallback;
}

function normalizeUiScale(
  value: unknown,
  fallback: UiScale,
): UiScale {
  const legacyPercentage =
    typeof value === "number" &&
    value > 0 &&
    value <= 2
      ? Math.round(value * 100)
      : value;

  return isOneOf(
    legacyPercentage,
    [90, 100, 110, 125] as const,
  )
    ? legacyPercentage
    : fallback;
}

function normalizeBusinessSettings(
  value: unknown,
  fallback: BusinessSettings,
): BusinessSettings {
  const business = isRecord(value)
    ? value
    : {};

  return {
    companyName: readString(
      business.companyName ??
        business.name,
      fallback.companyName,
    ),
    address: readString(
      business.address,
      fallback.address,
    ),
    phone: readString(
      business.phone,
      fallback.phone,
    ),
    gstin: readString(
      business.gstin,
      fallback.gstin,
    ),
    email: readString(
      business.email,
      fallback.email,
    ),
    statementHeader: readString(
      business.statementHeader,
      fallback.statementHeader,
    ),
    statementFooter: readString(
      business.statementFooter,
      fallback.statementFooter,
    ),
    currency: "INR",
  };
}

function normalizePrintSettings(
  value: unknown,
  fallback: PrintSettings,
): PrintSettings {
  const print = isRecord(value)
    ? value
    : {};

  const orientation =
    print.orientation;
  const fontSize =
    print.fontSize;

  return {
    defaultTransactionLimit:
      normalizeTransactionLimit(
        print.defaultTransactionLimit ??
          print.transactionLimit,
        fallback.defaultTransactionLimit,
      ),
    showRunningBalance: readBoolean(
      print.showRunningBalance,
      fallback.showRunningBalance,
    ),
    showNotes: readBoolean(
      print.showNotes,
      fallback.showNotes,
    ),
    showAttachment: readBoolean(
      print.showAttachment ??
        print.showAttachments,
      fallback.showAttachment,
    ),
    showTransactionTime: readBoolean(
      print.showTransactionTime,
      fallback.showTransactionTime,
    ),
    showBusinessAddress: readBoolean(
      print.showBusinessAddress,
      fallback.showBusinessAddress,
    ),
    showBusinessPhone: readBoolean(
      print.showBusinessPhone,
      fallback.showBusinessPhone,
    ),
    showBusinessGstin: readBoolean(
      print.showBusinessGstin,
      fallback.showBusinessGstin,
    ),
    showGeneratedDate: readBoolean(
      print.showGeneratedDate,
      fallback.showGeneratedDate,
    ),
    showPageNumbers: readBoolean(
      print.showPageNumbers ??
        print.showPageNumber,
      fallback.showPageNumbers,
    ),
    paperSize: "A4",
    orientation: isOneOf<
      ReportOrientation
    >(
      orientation,
      ["portrait", "landscape"],
    )
      ? orientation
      : fallback.orientation,
    fontSize: isOneOf<
      PrintFontSize
    >(
      fontSize,
      ["small", "normal", "large"],
    )
      ? fontSize
      : fallback.fontSize,
    customFooter: readString(
      print.customFooter,
      fallback.customFooter,
    ),
  };
}

function normalizeAppearanceSettings(
  value: unknown,
  fallback: AppearanceSettings,
): AppearanceSettings {
  const appearance = isRecord(value)
    ? value
    : {};

  const fontFamily =
    appearance.fontFamily;
  const baseFontSize =
    appearance.baseFontSize;
  const density =
    appearance.density;
  const tableDensity =
    appearance.tableDensity;
  const accentColor =
    appearance.accentColor ??
    appearance.accent;
  const theme =
    appearance.theme ??
    appearance.mode;

  return {
    fontFamily: isOneOf<
      AppFontFamily
    >(
      fontFamily,
      [
        "inter",
        "system",
        "segoe-ui",
        "arial",
      ],
    )
      ? fontFamily
      : fallback.fontFamily,
    baseFontSize: isOneOf<
      BaseFontSize
    >(
      baseFontSize,
      [13, 14, 15, 16],
    )
      ? baseFontSize
      : fallback.baseFontSize,
    uiScale: normalizeUiScale(
      appearance.uiScale,
      fallback.uiScale,
    ),
    density: isOneOf<
      UiDensity
    >(
      density,
      [
        "compact",
        "comfortable",
        "spacious",
      ],
    )
      ? density
      : fallback.density,
    tableDensity: isOneOf<
      TableDensity
    >(
      tableDensity,
      [
        "compact",
        "normal",
        "comfortable",
      ],
    )
      ? tableDensity
      : fallback.tableDensity,
    accentColor: isOneOf<
      AccentColor
    >(
      accentColor,
      [
        "blue",
        "indigo",
        "emerald",
        "slate",
      ],
    )
      ? accentColor
      : fallback.accentColor,
    theme: isOneOf<
      AppearanceTheme
    >(
      theme,
      ["light", "dark", "system"],
    )
      ? theme
      : fallback.theme,
  };
}

export function normalizeSettings(
  value: unknown,
  fallback: Readonly<AppSettings> =
    DEFAULT_SETTINGS,
): AppSettings {
  const settings = isRecord(value)
    ? value
    : {};

  return {
    business:
      normalizeBusinessSettings(
        settings.business,
        fallback.business,
      ),
    print: normalizePrintSettings(
      settings.print ??
        settings.statements,
      fallback.print,
    ),
    appearance:
      normalizeAppearanceSettings(
        settings.appearance,
        fallback.appearance,
      ),
  };
}

export function mergeSettings(
  settings: Readonly<AppSettings>,
  patch: AppSettingsPatch,
): AppSettings {
  return normalizeSettings(
    patch,
    settings,
  );
}

function resolveStorage(
  suppliedStorage?:
    SettingsStorageLike | null,
): StorageResolution {
  if (suppliedStorage) {
    return {
      storage: suppliedStorage,
      error: null,
    };
  }

  if (suppliedStorage === null) {
    return {
      storage: null,
      error: {
        code: "STORAGE_UNAVAILABLE",
        message:
          "Browser storage is unavailable. Settings will only last for this session.",
      },
    };
  }

  if (typeof window === "undefined") {
    return {
      storage: null,
      error: null,
    };
  }

  try {
    return {
      storage: window.localStorage,
      error: null,
    };
  } catch (cause) {
    return {
      storage: null,
      error: {
        code: "STORAGE_UNAVAILABLE",
        message:
          "Browser storage is unavailable. Settings will only last for this session.",
        cause,
      },
    };
  }
}

function getStoredValue(
  storage: SettingsStorageLike,
) {
  const currentValue =
    storage.getItem(
      SETTINGS_STORAGE_KEY,
    );

  if (currentValue !== null) {
    return {
      value: currentValue,
      isLegacyKey: false,
    };
  }

  for (const key of
    LEGACY_STORAGE_KEYS) {
    const legacyValue =
      storage.getItem(key);

    if (legacyValue !== null) {
      return {
        value: legacyValue,
        isLegacyKey: true,
      };
    }
  }

  return {
    value: null,
    isLegacyKey: false,
  };
}

function hasSettingsShape(
  value: Record<string, unknown>,
) {
  return (
    "business" in value ||
    "print" in value ||
    "statements" in value ||
    "appearance" in value
  );
}

function parseStoredSettings(
  parsed: unknown,
): Omit<
  SettingsLoadResult,
  "source"
> {
  if (!isRecord(parsed)) {
    return {
      settings:
        cloneSettings(DEFAULT_SETTINGS),
      error: {
        code: "INVALID_DATA",
        message:
          "Saved settings have an invalid structure. Safe defaults are being used.",
      },
      migrated: false,
    };
  }

  if (
    parsed.format ===
    SETTINGS_STORAGE_FORMAT
  ) {
    const version = parsed.version;

    if (
      typeof version !== "number" ||
      !Number.isInteger(version) ||
      version < 0
    ) {
      return {
        settings:
          cloneSettings(DEFAULT_SETTINGS),
        error: {
          code: "INVALID_DATA",
          message:
            "Saved settings have an invalid version. Safe defaults are being used.",
        },
        migrated: false,
      };
    }

    if (
      version >
      SETTINGS_STORAGE_VERSION
    ) {
      return {
        settings:
          cloneSettings(DEFAULT_SETTINGS),
        error: {
          code: "UNSUPPORTED_VERSION",
          message:
            "These settings were created by a newer LedgerFlow version and were not changed.",
        },
        migrated: false,
      };
    }

    const storedSettings =
      parsed.settings ?? parsed.data;

    if (
      !isRecord(storedSettings) ||
      !hasSettingsShape(storedSettings)
    ) {
      return {
        settings:
          cloneSettings(DEFAULT_SETTINGS),
        error: {
          code: "INVALID_DATA",
          message:
            "Saved settings are incomplete or invalid. Safe defaults are being used.",
        },
        migrated: false,
      };
    }

    const settings =
      normalizeSettings(
        storedSettings,
      );

    return {
      settings,
      error: null,
      migrated:
        version !==
          SETTINGS_STORAGE_VERSION ||
        JSON.stringify(settings) !==
          JSON.stringify(storedSettings),
    };
  }

  if (!hasSettingsShape(parsed)) {
    return {
      settings:
        cloneSettings(DEFAULT_SETTINGS),
      error: {
        code: "INVALID_DATA",
        message:
          "Saved settings do not match LedgerFlow's settings format. Safe defaults are being used.",
      },
      migrated: false,
    };
  }

  return {
    settings: normalizeSettings(parsed),
    error: null,
    migrated: true,
  };
}

export function loadSettings(
  suppliedStorage?:
    SettingsStorageLike | null,
): SettingsLoadResult {
  const resolution =
    resolveStorage(suppliedStorage);

  if (!resolution.storage) {
    return {
      settings:
        cloneSettings(DEFAULT_SETTINGS),
      error: resolution.error,
      source: "defaults",
      migrated: false,
    };
  }

  let storedValue: ReturnType<
    typeof getStoredValue
  >;

  try {
    storedValue = getStoredValue(
      resolution.storage,
    );
  } catch (cause) {
    return {
      settings:
        cloneSettings(DEFAULT_SETTINGS),
      error: {
        code: "READ_FAILED",
        message:
          "LedgerFlow could not read saved settings. Safe defaults are being used for this session.",
        cause,
      },
      source: "defaults",
      migrated: false,
    };
  }

  if (storedValue.value === null) {
    return {
      settings:
        cloneSettings(DEFAULT_SETTINGS),
      error: null,
      source: "defaults",
      migrated: false,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      storedValue.value,
    );
  } catch (cause) {
    return {
      settings:
        cloneSettings(DEFAULT_SETTINGS),
      error: {
        code: "PARSE_FAILED",
        message:
          "Saved settings are corrupted. They were left untouched and safe defaults are being used.",
        cause,
      },
      source: "defaults",
      migrated: false,
    };
  }

  const result =
    parseStoredSettings(parsed);

  return {
    ...result,
    source: result.error
      ? "defaults"
      : "storage",
    migrated:
      result.migrated ||
      storedValue.isLegacyKey,
  };
}

export function saveSettings(
  settings: Readonly<AppSettings>,
  suppliedStorage?:
    SettingsStorageLike | null,
): SettingsSaveResult {
  const resolution =
    resolveStorage(suppliedStorage);

  if (!resolution.storage) {
    return {
      ok: false,
      error:
        resolution.error ?? {
          code: "STORAGE_UNAVAILABLE",
          message:
            "Browser storage is unavailable. Settings will only last for this session.",
        },
    };
  }

  const envelope:
    StoredSettingsEnvelope = {
    format: SETTINGS_STORAGE_FORMAT,
    version: SETTINGS_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    settings:
      normalizeSettings(settings),
  };

  try {
    resolution.storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(envelope),
    );

    return {
      ok: true,
      error: null,
    };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: "WRITE_FAILED",
        message:
          "Settings changed in this session, but LedgerFlow could not save them to this browser.",
        cause,
      },
    };
  }
}
