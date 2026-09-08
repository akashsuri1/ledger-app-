export type TransactionDisplayLimit =
  | 10
  | 25
  | 50
  | 100
  | "ALL";

export type StatementTransactionLimit =
  | number
  | "ALL";

export type ReportOrientation =
  | "portrait"
  | "landscape";

export interface StatementPrintPreferences {
  transactionLimit: StatementTransactionLimit;
  showRunningBalance: boolean;
  showNotes: boolean;
  showAttachment: boolean;
  showTransactionTime: boolean;
  showBusinessAddress: boolean;
  showBusinessPhone: boolean;
  showBusinessGstin: boolean;
  showGeneratedDate: boolean;
  orientation: ReportOrientation;
  customFooter: string;
}

export interface DateRangePrintPreferences {
  showNotes: boolean;
  showAttachment: boolean;
  showTransactionTime: boolean;
  showBusinessAddress: boolean;
  showBusinessPhone: boolean;
  showBusinessGstin: boolean;
  showGeneratedDate: boolean;
  orientation: ReportOrientation;
  customFooter: string;
}

export interface ReportBusinessProfile {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  email: string;
  statementHeader: string;
  statementFooter: string;
}
