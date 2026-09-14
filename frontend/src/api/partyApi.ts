import { apiPaged, apiRequest, queryString } from "./apiClient";
import type { NewParty, UpdateParty } from "../types";
import type { PartyDto } from "./types";

export interface PartyFilters { search?: string; regionId?: number; page?: number; pageSize?: number }
export const partyApi = {
  list: (companyId: number, filters: PartyFilters = {}, signal?: AbortSignal) => apiPaged<PartyDto>(`/api/companies/${companyId}/parties${queryString({ ...filters })}`, { signal }),
  get: (companyId: number, partyId: number, signal?: AbortSignal) => apiRequest<PartyDto>(`/api/companies/${companyId}/parties/${partyId}`, { signal }),
  create: (companyId: number, input: NewParty) => apiRequest<PartyDto>(`/api/companies/${companyId}/parties`, { method: "POST", body: input }),
  update: (companyId: number, partyId: number, input: UpdateParty) => apiRequest<PartyDto>(`/api/companies/${companyId}/parties/${partyId}`, { method: "PATCH", body: input }),
  remove: (companyId: number, partyId: number) => apiRequest<{ message: string }>(`/api/companies/${companyId}/parties/${partyId}`, { method: "DELETE", body: {} }),
};
