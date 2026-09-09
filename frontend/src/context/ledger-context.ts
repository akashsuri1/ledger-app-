import { createContext } from "react";

import type {
  Company,
  LedgerTransaction,
  NewCompany,
  NewParty,
  NewRegion,
  NewTransaction,
  Party,
  Region,
  UpdateCompany,
  UpdateParty,
  UpdateTransaction,
} from "../types";
import type {
  AppearanceSettings,
  AppSettingsPatch,
  SettingsStorageError,
} from "../types/settings";
import type { LedgerWorkspace } from "../types/workspace";
import type { SettingsSaveResult } from "../utils/settingsStorage";

export interface LedgerContextValue {
  companies: Company[];
  activeCompanyId: number;
  activeCompany: Company;
  companySelectionRequired: boolean;
  appearance: AppearanceSettings;
  parties: Party[];
  regions: Region[];
  transactions: LedgerTransaction[];
  storageError: SettingsStorageError | null;
  isPersisted: boolean;
  createCompany: (company: NewCompany) => Company;
  updateCompany: (companyId: number, data: UpdateCompany) => void;
  canDeleteCompany: (companyId: number) => boolean;
  deleteCompany: (companyId: number) => void;
  switchCompany: (companyId: number) => void;
  addParty: (party: NewParty) => Party;
  updateParty: (partyId: number, data: UpdateParty) => void;
  deleteParty: (partyId: number) => void;
  addRegion: (region: NewRegion) => Region;
  updateRegion: (regionId: number, name: string) => void;
  deleteRegion: (regionId: number) => void;
  addTransaction: (transaction: NewTransaction) => LedgerTransaction;
  updateTransaction: (
    transactionId: number,
    data: UpdateTransaction,
  ) => void;
  deleteTransaction: (transactionId: number) => void;
  getPartyBalance: (partyId: number) => number;
  getRegionById: (regionId: number) => Region | undefined;
  resetDemoData: () => void;
  applySettingsPatch: (patch: AppSettingsPatch) => SettingsSaveResult;
  clearStorageError: () => void;
  getWorkspaceSnapshot: () => LedgerWorkspace;
  replaceWorkspace: (workspace: unknown) => SettingsSaveResult;
}

export const LedgerContext = createContext<LedgerContextValue | undefined>(
  undefined,
);
