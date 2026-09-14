import type { CompanyDto, PreferencesDto } from "../api/types";

export type CompanyDestination = "setup" | "select" | "dashboard";
export function companyDestination(companies: CompanyDto[], preferences: PreferencesDto | null): CompanyDestination {
  if (companies.length === 0) return "setup";
  if (companies.length === 1) return "dashboard";
  const remembered = preferences?.rememberLastCompany && companies.some((item) => item.id === preferences.lastActiveCompanyId);
  return remembered ? "dashboard" : "select";
}

export function initialCompanyId(companies: CompanyDto[], preferences: PreferencesDto | null) {
  if (companies.length === 0) return 0;
  const last = preferences?.lastActiveCompanyId;
  return last && companies.some((item) => item.id === last) ? last : companies[0].id;
}
