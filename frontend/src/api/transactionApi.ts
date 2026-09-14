import { apiPaged, apiRequest, queryString } from "./apiClient";
import type { NewTransaction, TransactionType, UpdateTransaction } from "../types";
import type { TransactionDto } from "./types";

export interface TransactionFilters {
  search?: string; partyId?: number; regionId?: number; type?: TransactionType;
  from?: string; to?: string; page?: number; pageSize?: number;
}
export const transactionApi = {
  list: (companyId: number, filters: TransactionFilters = {}, signal?: AbortSignal) => apiPaged<TransactionDto>(`/api/companies/${companyId}/transactions${queryString({ ...filters })}`, { signal }),
  get: (companyId: number, transactionId: number, signal?: AbortSignal) => apiRequest<TransactionDto>(`/api/companies/${companyId}/transactions/${transactionId}`, { signal }),
  create: (companyId: number, input: Omit<NewTransaction, "attachmentName">) => apiRequest<TransactionDto>(`/api/companies/${companyId}/transactions`, { method: "POST", body: input }),
  update: (companyId: number, transactionId: number, input: Omit<UpdateTransaction, "attachmentName">) => apiRequest<TransactionDto>(`/api/companies/${companyId}/transactions/${transactionId}`, { method: "PATCH", body: input }),
  remove: (companyId: number, transactionId: number) => apiRequest<{ message: string }>(`/api/companies/${companyId}/transactions/${transactionId}`, { method: "DELETE", body: {} }),
};
