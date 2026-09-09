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

export type SettingsMutation = () =>
  SettingsSaveResult;

export type SettingsPatchMutation = (
  patch: AppSettingsPatch,
) => SettingsSaveResult;

export interface SettingsContextValue {
  settings: AppSettings;
  storageError:
    SettingsStorageError | null;
  isPersisted: boolean;
  updateSettings: SettingsPatchMutation;
  updateBusinessSettings: (
    patch: Partial<BusinessSettings>,
  ) => SettingsSaveResult;
  updatePrintSettings: (
    patch: Partial<PrintSettings>,
  ) => SettingsSaveResult;
  updateAppearanceSettings: (
    patch: Partial<AppearanceSettings>,
  ) => SettingsSaveResult;
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
