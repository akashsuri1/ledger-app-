export type TransactionType =
  | "CREDIT"
  | "DEBIT";

export interface Region {
  id: number;
  name: string;
}

export interface Party {
  id: number;
  name: string;
  phone: string;
  regionId: number;
  address: string;
  gstin: string;
  notes: string;
  createdAt: string;
}

export interface LedgerTransaction {
  id: number;

  partyId: number;

  type: TransactionType;

  amount: number;

  transactionDateTime: string;

  description: string;

  notes: string;

  attachmentName?: string;

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

  transactionDateTime: string;

  description: string;

  notes: string;

  attachmentName?: string;
}

export type UpdateTransaction =
  Partial<NewTransaction>;