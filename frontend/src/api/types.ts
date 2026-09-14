import type { AppearanceSettings, PrintSettings } from "../types/settings";
import type { TransactionType } from "../types";

export interface ApiFieldErrors { [field: string]: string }

export interface ApiErrorShape {
  code: string;
  message: string;
  fields?: ApiFieldErrors;
  status?: number;
}

export interface ApiEnvelope<T> { data: T }
export interface ApiErrorEnvelope { error: ApiErrorShape }
export interface PageMeta { page: number; pageSize: number; total: number; totalPages: number }
export interface PagedEnvelope<T> { data: T[]; meta: PageMeta }

export type MembershipRole = "OWNER" | "ADMIN" | "ACCOUNTANT" | "VIEWER";
export interface UserDto { id: number; name: string; email: string }
export interface CompanyDto {
  id: number; name: string; address: string; phone: string; gstin: string;
  email: string; role: MembershipRole; createdAt: string; updatedAt?: string;
}
export interface PreferencesDto {
  rememberLastCompany: boolean;
  lastActiveCompanyId: number | null;
  appearance: AppearanceSettings;
}
export interface BootstrapDto { user: UserDto; companies: CompanyDto[]; preferences: PreferencesDto }

export interface RegionDto { id: number; companyId: number; name: string; createdAt: string; updatedAt: string }
export interface PartyDto {
  id: number; companyId: number; regionId: number; regionName: string; name: string;
  phone: string; address: string; gstin: string; notes: string; createdAt: string;
  updatedAt: string; balance: number; transactionCount: number;
}
export interface AttachmentDto { id: number; originalName: string; mimeType: string; byteSize: number }
export interface TransactionDto {
  id: number; companyId: number; partyId: number; partyName: string; regionId: number;
  regionName: string; type: TransactionType; amount: number; transactionDate: string;
  description: string; notes: string; createdAt: string; updatedAt: string;
  attachment: AttachmentDto | null;
}

export interface CompanySettingsDto {
  companyId: number; statementHeader: string; statementFooter: string;
  defaultTransactionLimit: 10 | 25 | 50 | 100 | "ALL";
  showRunningBalance: boolean; showNotes: boolean; showAttachment: boolean;
  showBusinessAddress: boolean; showBusinessPhone: boolean; showBusinessGstin: boolean;
  showGeneratedDate: boolean; showPageNumbers: boolean; paperSize: "A4";
  orientation: "portrait" | "landscape"; fontSize: "small" | "normal" | "large";
  customFooter: string; updatedAt: string;
}

export interface DashboardDto {
  partyCount: number; transactionCount: number; totalReceivable: number;
  totalPayable: number; netBalance: number;
  recentTransactions: Array<Omit<TransactionDto, "companyId" | "createdAt" | "updatedAt">>;
  regions: Array<{ id: number; name: string; partyCount: number; receivable: number; payable: number; net: number }>;
  chart: Array<{ key: string; month: string; credit: number; debit: number }>;
}

export interface BackupCounts { companies: number; regions: number; parties: number; transactions: number; attachments: number }
export interface RestorePreviewDto {
  valid: boolean; formatVersion: number; createdAt: string;
  company: { name: string }; counts: BackupCounts; warnings: string[]; conflicts: string[];
}
export interface RestoreResultDto { companyId: number; companyName: string; counts: BackupCounts; warnings: string[] }
export interface LegacyPreviewDto { valid: boolean; formatVersion: number; counts: BackupCounts; warnings: string[]; conflicts: string[] }
export interface LegacyResultDto { companyIds: number[]; counts: BackupCounts; warnings: string[] }

export interface CompanyWithSettings extends CompanyDto { settings: CompanySettingsDto }
export interface PreferencePatch {
  rememberLastCompany?: boolean;
  lastActiveCompanyId?: number | null;
  appearance?: Partial<AppearanceSettings>;
}
export type SettingsPatch = Partial<Omit<CompanySettingsDto, "companyId" | "updatedAt">>;
export type PrintSettingsDto = PrintSettings;
