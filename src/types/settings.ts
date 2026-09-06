import type {
  ReportOrientation,
  TransactionDisplayLimit,
} from "./reports";

export type BusinessCurrency = "INR";

export type PrintPaperSize = "A4";

export type PrintFontSize =
  | "small"
  | "normal"
  | "large";

export type AppFontFamily =
  | "inter"
  | "system"
  | "segoe-ui"
  | "arial";

export type BaseFontSize =
  | 13
  | 14
  | 15
  | 16;

export type UiScale =
  | 90
  | 100
  | 110
  | 125;

export type UiDensity =
  | "compact"
  | "comfortable"
  | "spacious";

export type TableDensity =
  | "compact"
  | "normal"
  | "comfortable";

export type AccentColor =
  | "blue"
  | "indigo"
  | "emerald"
  | "slate";

export type AppearanceTheme =
  | "light"
  | "dark"
  | "system";

export type ResolvedAppearanceTheme =
  | "light"
  | "dark";

export interface BusinessSettings {
  companyName: string;
  address: string;
  phone: string;
  gstin: string;
  email: string;
  statementHeader: string;
  statementFooter: string;
  currency: BusinessCurrency;
}

export interface PrintSettings {
  defaultTransactionLimit:
    TransactionDisplayLimit;
  showRunningBalance: boolean;
  showNotes: boolean;
  showAttachment: boolean;
  showTransactionTime: boolean;
  showBusinessAddress: boolean;
  showBusinessPhone: boolean;
  showBusinessGstin: boolean;
  showGeneratedDate: boolean;
  showPageNumbers: boolean;
  paperSize: PrintPaperSize;
  orientation: ReportOrientation;
  fontSize: PrintFontSize;
  customFooter: string;
}

export interface AppearanceSettings {
  fontFamily: AppFontFamily;
  baseFontSize: BaseFontSize;
  uiScale: UiScale;
  density: UiDensity;
  tableDensity: TableDensity;
  accentColor: AccentColor;
  theme: AppearanceTheme;
}

export interface AppSettings {
  business: BusinessSettings;
  print: PrintSettings;
  appearance: AppearanceSettings;
}

export interface AppSettingsPatch {
  business?: Partial<BusinessSettings>;
  print?: Partial<PrintSettings>;
  appearance?: Partial<AppearanceSettings>;
}

export type SettingsStorageErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "READ_FAILED"
  | "PARSE_FAILED"
  | "INVALID_DATA"
  | "UNSUPPORTED_VERSION"
  | "WRITE_FAILED";

export interface SettingsStorageError {
  code: SettingsStorageErrorCode;
  message: string;
  cause?: unknown;
}
