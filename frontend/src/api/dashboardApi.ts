import { apiRequest } from "./apiClient";
import type { DashboardDto } from "./types";

export const dashboardApi = {
  get: (companyId: number, signal?: AbortSignal) =>
    apiRequest<DashboardDto>(`/api/companies/${companyId}/dashboard`, { signal }),
};
