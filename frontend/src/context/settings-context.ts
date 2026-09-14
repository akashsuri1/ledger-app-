import {
  createContext,
} from "react";

import type {
  AppSettings,
  AppSettingsPatch,
  AppearanceSettings,
  BusinessSettings,
  PrintSettings,
  SettingsStorageError,
} from "../types/settings";

import type {
  SettingsSaveResult,
} from "../utils/settingsStorage";

export type SettingsMutation = () => Promise<SettingsSaveResult>;

export type SettingsPatchMutation = (
  patch: AppSettingsPatch,
) => Promise<SettingsSaveResult>;

export interface SettingsContextValue {
  settings: AppSettings;
  storageError:
    SettingsStorageError | null;
  isPersisted: boolean;
  updateSettings: SettingsPatchMutation;
  updateBusinessSettings: (
    patch: Partial<BusinessSettings>,
  ) => Promise<SettingsSaveResult>;
  updatePrintSettings: (
    patch: Partial<PrintSettings>,
  ) => Promise<SettingsSaveResult>;
  updateAppearanceSettings: (
    patch: Partial<AppearanceSettings>,
  ) => Promise<SettingsSaveResult>;
  resetBusinessSettings: SettingsMutation;
  resetPrintSettings: SettingsMutation;
  resetAppearanceSettings: SettingsMutation;
  resetSettings: SettingsMutation;
  resetAllSettings: SettingsMutation;
  clearStorageError: () => void;
}

export const SettingsContext =
  createContext<
    SettingsContextValue | undefined
  >(undefined);
