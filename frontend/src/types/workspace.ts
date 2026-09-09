import type {
  Company,
  LedgerTransaction,
  Party,
  Region,
} from ".";

import type {
  AppearanceSettings,
} from "./settings";

export interface LedgerWorkspace {
  companies: Company[];
  activeCompanyId: number;
  regions: Region[];
  parties: Party[];
  transactions: LedgerTransaction[];
  applicationSettings: {
    appearance: AppearanceSettings;
  };
}
