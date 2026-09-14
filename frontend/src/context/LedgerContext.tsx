import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { attachmentApi } from "../api/attachmentApi";
import { companyApi } from "../api/companyApi";
import { dashboardApi } from "../api/dashboardApi";
import { partyApi } from "../api/partyApi";
import { regionApi } from "../api/regionApi";
import { settingsApi } from "../api/settingsApi";
import { transactionApi } from "../api/transactionApi";
import type { CompanyDto, CompanySettingsDto, DashboardDto, RegionDto } from "../api/types";
import { mapPartyDto, mapTransactionDto } from "../api/mappers";
import { useAuth } from "../hooks/useAuth";
import type { Company, LedgerTransaction, NewCompany, NewParty, NewRegion, NewTransaction, Party, Region, UpdateCompany, UpdateParty, UpdateTransaction } from "../types";
import type { AppSettingsPatch } from "../types/settings";
import type { LedgerWorkspace } from "../types/workspace";
import { DEFAULT_APPEARANCE_SETTINGS, DEFAULT_PRINT_SETTINGS } from "../utils/settingsStorage";
import type { SettingsSaveResult } from "../utils/settingsStorage";
import { companyDestination, initialCompanyId } from "../utils/companyRouting";
import { LedgerContext } from "./ledger-context";

const defaultLedgerSettings = () => ({ statementHeader: "Statement of Account", statementFooter: "", print: { ...DEFAULT_PRINT_SETTINGS } });

function mapCompany(value: CompanyDto, settings?: CompanySettingsDto): Company {
  return {
    id: value.id, name: value.name, address: value.address, phone: value.phone,
    gstin: value.gstin, email: value.email, createdAt: value.createdAt, role: value.role,
    settings: settings ? {
      statementHeader: settings.statementHeader,
      statementFooter: settings.statementFooter,
      print: {
        defaultTransactionLimit: settings.defaultTransactionLimit,
        showRunningBalance: settings.showRunningBalance, showNotes: settings.showNotes,
        showAttachment: settings.showAttachment, showBusinessAddress: settings.showBusinessAddress,
        showBusinessPhone: settings.showBusinessPhone, showBusinessGstin: settings.showBusinessGstin,
        showGeneratedDate: settings.showGeneratedDate, showPageNumbers: settings.showPageNumbers,
        paperSize: settings.paperSize, orientation: settings.orientation, fontSize: settings.fontSize,
        customFooter: settings.customFooter,
      },
    } : defaultLedgerSettings(),
  };
}

function mapRegion(value: RegionDto): Region { return { id: value.id, companyId: value.companyId, name: value.name }; }
async function allParties(companyId: number, signal: AbortSignal) {
  const first = await partyApi.list(companyId, { page: 1, pageSize: 100 }, signal);
  return first.data.map(mapPartyDto);
}
async function allTransactions(companyId: number, signal: AbortSignal) {
  const first = await transactionApi.list(companyId, { page: 1, pageSize: 100 }, signal);
  return first.data.map(mapTransactionDto);
}

function failed(cause: unknown): SettingsSaveResult {
  return { ok: false, error: { code: "WRITE_FAILED", message: cause instanceof Error ? cause.message : "Unable to save settings." } };
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [activeCompanyId, setActiveCompanyId] = useState(() => initialCompanyId(auth.companies, auth.preferences));
  const [selectionRequired, setSelectionRequired] = useState(() => companyDestination(auth.companies, auth.preferences) === "select");
  const [companySettings, setCompanySettings] = useState<CompanySettingsDto | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestNumber = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const refreshCompanyData = useCallback(async () => {
    if (!activeCompanyId) return;
    controller.current?.abort();
    const currentController = new AbortController();
    controller.current = currentController;
    const request = ++requestNumber.current;
    setIsLoading(true); setError(null);
    try {
      const [settings, regionValues, partyValues, transactionValues, dashboardValue] = await Promise.all([
        settingsApi.get(activeCompanyId, currentController.signal), regionApi.list(activeCompanyId, currentController.signal),
        allParties(activeCompanyId, currentController.signal), allTransactions(activeCompanyId, currentController.signal),
        dashboardApi.get(activeCompanyId, currentController.signal),
      ]);
      if (request !== requestNumber.current) return;
      setCompanySettings(settings); setRegions(regionValues.map(mapRegion)); setParties(partyValues);
      setTransactions(transactionValues); setDashboard(dashboardValue);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (request === requestNumber.current) setError(cause instanceof Error ? cause.message : "Unable to load this company.");
    } finally { if (request === requestNumber.current) setIsLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { queueMicrotask(() => void refreshCompanyData()); return () => controller.current?.abort(); }, [refreshCompanyData]);

  const companies = useMemo(() => auth.companies.map((item) => mapCompany(item, item.id === activeCompanyId ? companySettings ?? undefined : undefined)), [activeCompanyId, auth.companies, companySettings]);
  const activeCompany = companies.find((item) => item.id === activeCompanyId) ?? companies[0];
  const activeRole = activeCompany?.role ?? "VIEWER";
  const canWrite = activeRole !== "VIEWER";

  const createCompany = useCallback(async (input: NewCompany) => {
    const created = await companyApi.create(input);
    await auth.refreshBootstrap();
    setActiveCompanyId(created.id); setSelectionRequired(false);
    return mapCompany(created);
  }, [auth]);
  const updateCompany = useCallback(async (companyId: number, input: UpdateCompany) => {
    await companyApi.update(companyId, input); await auth.refreshBootstrap();
  }, [auth]);
  const deleteCompany = useCallback(async (companyId: number) => {
    await companyApi.remove(companyId);
    const next = await auth.refreshBootstrap();
    if (companyId === activeCompanyId && next) {
      setActiveCompanyId(initialCompanyId(next.companies, next.preferences));
      setSelectionRequired(companyDestination(next.companies, next.preferences) === "select");
    }
  }, [activeCompanyId, auth]);
  const switchCompany = useCallback(async (companyId: number) => {
    if (!auth.companies.some((item) => item.id === companyId)) throw new Error("You do not have access to that company.");
    requestNumber.current += 1; controller.current?.abort();
    setRegions([]); setParties([]); setTransactions([]); setDashboard(null); setCompanySettings(null);
    setActiveCompanyId(companyId); setSelectionRequired(false);
    if (auth.preferences?.rememberLastCompany) await auth.updatePreferences({ lastActiveCompanyId: companyId });
  }, [auth]);

  const addParty = useCallback(async (input: NewParty) => { const value = mapPartyDto(await partyApi.create(activeCompanyId, input)); await refreshCompanyData(); return value; }, [activeCompanyId, refreshCompanyData]);
  const updateParty = useCallback(async (id: number, input: UpdateParty) => { await partyApi.update(activeCompanyId, id, input); await refreshCompanyData(); }, [activeCompanyId, refreshCompanyData]);
  const deleteParty = useCallback(async (id: number) => { await partyApi.remove(activeCompanyId, id); await refreshCompanyData(); }, [activeCompanyId, refreshCompanyData]);
  const addRegion = useCallback(async (input: NewRegion) => { const value = mapRegion(await regionApi.create(activeCompanyId, input.name)); await refreshCompanyData(); return value; }, [activeCompanyId, refreshCompanyData]);
  const updateRegion = useCallback(async (id: number, name: string) => { await regionApi.update(activeCompanyId, id, name); await refreshCompanyData(); }, [activeCompanyId, refreshCompanyData]);
  const deleteRegion = useCallback(async (id: number) => { await regionApi.remove(activeCompanyId, id); await refreshCompanyData(); }, [activeCompanyId, refreshCompanyData]);
  const addTransaction = useCallback(async (input: NewTransaction) => {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("Amount must be a positive whole rupee value.");
    const attachmentFile=input.attachmentFile;
    const body={partyId:input.partyId,type:input.type,amount:input.amount,transactionDate:input.transactionDate,description:input.description,notes:input.notes};
    let value = await transactionApi.create(activeCompanyId, body);
    if (attachmentFile) {
      const attachment = await attachmentApi.upload(activeCompanyId, value.id, attachmentFile);
      value = { ...value, attachment };
    }
    await refreshCompanyData(); return mapTransactionDto(value);
  }, [activeCompanyId, refreshCompanyData]);
  const updateTransaction = useCallback(async (id: number, input: UpdateTransaction) => {
    if (input.amount !== undefined && (!Number.isSafeInteger(input.amount) || input.amount <= 0)) throw new Error("Amount must be a positive whole rupee value.");
    const attachmentFile=input.attachmentFile;
    const body={...(input.partyId===undefined?{}:{partyId:input.partyId}),...(input.type===undefined?{}:{type:input.type}),...(input.amount===undefined?{}:{amount:input.amount}),...(input.transactionDate===undefined?{}:{transactionDate:input.transactionDate}),...(input.description===undefined?{}:{description:input.description}),...(input.notes===undefined?{}:{notes:input.notes})};
    await transactionApi.update(activeCompanyId, id, body);
    if (attachmentFile) await attachmentApi.upload(activeCompanyId, id, attachmentFile);
    await refreshCompanyData();
  }, [activeCompanyId, refreshCompanyData]);
  const deleteTransaction = useCallback(async (id: number) => { await transactionApi.remove(activeCompanyId, id); await refreshCompanyData(); }, [activeCompanyId, refreshCompanyData]);
  const deleteAttachment = useCallback(async (id: number) => { await attachmentApi.remove(activeCompanyId, id); await refreshCompanyData(); }, [activeCompanyId, refreshCompanyData]);
  const downloadAttachment = useCallback(async (id: number) => {
    const file = await attachmentApi.download(activeCompanyId, id); const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.fileName; anchor.click(); URL.revokeObjectURL(url);
  }, [activeCompanyId]);

  const applySettingsPatch = useCallback(async (patch: AppSettingsPatch): Promise<SettingsSaveResult> => {
    try {
      if (patch.business) {
        const { statementHeader, statementFooter, companyName } = patch.business;
        const companyPatch = { ...(companyName === undefined || companyName===activeCompany.name ? {} : { name: companyName }), ...(patch.business.address===undefined||patch.business.address===activeCompany.address?{}:{address:patch.business.address}), ...(patch.business.phone===undefined||patch.business.phone===activeCompany.phone?{}:{phone:patch.business.phone}), ...(patch.business.gstin===undefined||patch.business.gstin===activeCompany.gstin?{}:{gstin:patch.business.gstin}), ...(patch.business.email===undefined||patch.business.email===activeCompany.email?{}:{email:patch.business.email}) };
        if ((activeRole === "OWNER" || activeRole === "ADMIN") && Object.keys(companyPatch).length) await companyApi.update(activeCompanyId, companyPatch);
        const settingsPatch = { ...(statementHeader === undefined ? {} : { statementHeader }), ...(statementFooter === undefined ? {} : { statementFooter }) };
        if (canWrite && Object.keys(settingsPatch).length) await settingsApi.update(activeCompanyId, settingsPatch);
      }
      if (canWrite && patch.print) await settingsApi.update(activeCompanyId, patch.print);
      if (patch.appearance) await auth.updatePreferences({ appearance: patch.appearance });
      await auth.refreshBootstrap(); await refreshCompanyData(); return { ok: true, error: null };
    } catch (cause) { return failed(cause); }
  }, [activeCompany, activeCompanyId, activeRole, auth, canWrite, refreshCompanyData]);

  const appearance = useMemo(() => ({ ...DEFAULT_APPEARANCE_SETTINGS, ...(auth.preferences?.appearance ?? {}) }), [auth.preferences?.appearance]);
  const getWorkspaceSnapshot = useCallback((): LedgerWorkspace => ({ companies, activeCompanyId, regions, parties, transactions, applicationSettings: { appearance } }), [activeCompanyId, appearance, companies, parties, regions, transactions]);
  const replaceWorkspace = useCallback((workspace: unknown): SettingsSaveResult => { void workspace; return { ok: false, error: { code: "INVALID_DATA", message: "Use encrypted restore or the legacy import screen for server data." } }; }, []);

  if (!activeCompany) return null;
  return <LedgerContext.Provider value={{
    companies, activeCompanyId, activeCompany, companySelectionRequired: selectionRequired, appearance,
    parties, regions, transactions, storageError: null, isPersisted: true, isLoading, error,
    activeRole, canWrite, isOwner: activeRole === "OWNER", dashboard, refreshCompanyData,
    createCompany, updateCompany, canDeleteCompany: (id) => id === activeCompanyId && activeRole === "OWNER" && regions.length === 0 && parties.length === 0 && transactions.length === 0,
    deleteCompany, switchCompany, addParty, updateParty, deleteParty, addRegion, updateRegion, deleteRegion,
    addTransaction, updateTransaction, deleteTransaction, downloadAttachment, deleteAttachment,
    getPartyBalance: (id) => parties.find((item) => item.id === id)?.balance ?? 0,
    getRegionById: (id) => regions.find((item) => item.id === id), resetDemoData: () => undefined,
    applySettingsPatch, clearStorageError: () => undefined, getWorkspaceSnapshot, replaceWorkspace,
  }}>{children}</LedgerContext.Provider>;
}
