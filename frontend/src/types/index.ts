import type {
  PrintSettings,
} from "./settings";
import type { MembershipRole } from "../api/types";

export type TransactionType =
  | "CREDIT"
  | "DEBIT";

export interface CompanyLedgerSettings {
  statementHeader: string;
  statementFooter: string;
  print: PrintSettings;
}

export interface Company {
  id: number;
  name: string;
  address: string;
  phone: string;
  gstin: string;
  email: string;
  createdAt: string;
  settings: CompanyLedgerSettings;
  role?: MembershipRole;
}

export interface Region {
  id: number;
  companyId: number;
  name: string;
}

export interface Party {
  id: number;
  companyId: number;
  name: string;
  phone: string;
  regionId: number;
  address: string;
  gstin: string;
  notes: string;
  createdAt: string;
  regionName?: string;
  balance?: number;
  transactionCount?: number;
}

export interface LedgerTransaction {
  id: number;

  companyId: number;

  partyId: number;

  partyName?: string;

  regionName?: string;

  type: TransactionType;

  amount: number;

  transactionDate: string;

  description: string;

  notes: string;

  attachmentName?: string;
  attachmentId?: number;
  attachmentMimeType?: string;
  attachmentByteSize?: number;

  createdAt: string;
}

export interface NewParty {
  name: string;
  phone: string;
  regionId: number;
  address: string;
  gstin: string;
  notes: string;
}

export type UpdateParty =
  Partial<NewParty>;

export interface NewRegion {
  name: string;
}

export interface NewTransaction {
  partyId: number;

  type: TransactionType;

  amount: number;

  transactionDate: string;

  description: string;

  notes: string;

  attachmentName?: string;
  attachmentFile?: File;
}

export type UpdateTransaction =
  Partial<NewTransaction>;

export interface NewCompany {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  email?: string;
}

export type UpdateCompany =
  Partial<NewCompany>;
