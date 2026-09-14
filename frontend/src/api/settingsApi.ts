import { apiRequest } from "./apiClient";
import type { CompanySettingsDto, SettingsPatch } from "./types";

export const settingsApi = {
  get: (companyId: number, signal?: AbortSignal) =>
    apiRequest<CompanySettingsDto>(`/api/companies/${companyId}/settings`, { signal }),
  update: (companyId: number, patch: SettingsPatch) =>
    apiRequest<CompanySettingsDto>(`/api/companies/${companyId}/settings`, { method: "PATCH", body: patch }),
};
