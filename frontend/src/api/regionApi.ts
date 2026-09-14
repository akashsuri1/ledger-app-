import { apiRequest } from "./apiClient";
import type { RegionDto } from "./types";

export const regionApi = {
  list: (companyId: number, signal?: AbortSignal) => apiRequest<RegionDto[]>(`/api/companies/${companyId}/regions`, { signal }),
  create: (companyId: number, name: string) => apiRequest<RegionDto>(`/api/companies/${companyId}/regions`, { method: "POST", body: { name } }),
  update: (companyId: number, regionId: number, name: string) => apiRequest<RegionDto>(`/api/companies/${companyId}/regions/${regionId}`, { method: "PATCH", body: { name } }),
  remove: (companyId: number, regionId: number) => apiRequest<{ message: string }>(`/api/companies/${companyId}/regions/${regionId}`, { method: "DELETE", body: {} }),
};
