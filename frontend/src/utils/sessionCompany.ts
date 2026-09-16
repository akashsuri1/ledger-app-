import type { CompanyDto } from "../api/types";

const KEY = "ledgerflow-tab-active-company";

export function activeTabCompanyId(userId: number, companies: CompanyDto[]): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { userId?: number; companyId?: number };
    return value.userId === userId && companies.some(company => company.id === value.companyId)
      ? value.companyId! : null;
  } catch { return null; }
}

export function setActiveTabCompany(userId: number, companyId: number) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ userId, companyId })); }
  catch { /* tab persistence is optional */ }
}

export function clearActiveTabCompany() {
  try { sessionStorage.removeItem(KEY); }
  catch { /* tab persistence is optional */ }
}
