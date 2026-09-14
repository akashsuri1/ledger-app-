import { apiRequest } from "./apiClient";
import type { NewCompany, UpdateCompany } from "../types";
import type { CompanyDto } from "./types";

export const companyApi = {
  list: () => apiRequest<CompanyDto[]>("/api/companies"),
  create: (input: NewCompany) => apiRequest<CompanyDto>("/api/companies", { method: "POST", body: input }),
  update: (companyId: number, input: UpdateCompany) => apiRequest<CompanyDto>(`/api/companies/${companyId}`, { method: "PATCH", body: input }),
  remove: (companyId: number) => apiRequest<{ message: string }>(`/api/companies/${companyId}`, { method: "DELETE", body: {} }),
};
