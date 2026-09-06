import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { seedParties, seedRegions, seedTransactions } from "../data/seedData";
import type {
  Company,
  LedgerTransaction,
  NewCompany,
  NewParty,
  NewRegion,
  NewTransaction,
  Party,
  Region,
  UpdateCompany,
  UpdateParty,
  UpdateTransaction,
} from "../types";
import type {
  AppSettingsPatch,
  SettingsStorageError,
} from "../types/settings";
import type { LedgerWorkspace } from "../types/workspace";
import {
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_PRINT_SETTINGS,
} from "../utils/settingsStorage";
import type { SettingsSaveResult } from "../utils/settingsStorage";
import { LedgerContext } from "./ledger-context";
import {
  cloneWorkspace,
  loadWorkspace,
  normalizeCompanyName,
  saveWorkspace,
  validateWorkspace,
} from "../utils/workspaceStorage";
import { normalizeForComparison, toDisplayName } from "../utils/text";
import { roundCurrency } from "../utils/currency";

interface ProviderState {
  workspace: LedgerWorkspace;
  storageError: SettingsStorageError | null;
  isPersisted: boolean;
  protectStoredData: boolean;
}

function nextId(items: ReadonlyArray<{ id: number }>) {
  const id =
    items.length === 0
      ? 1
      : Math.max(...items.map((item) => item.id)) + 1;

  if (!Number.isSafeInteger(id)) {
    throw new Error("LedgerFlow cannot allocate another numeric identifier.");
  }

  return id;
}

function invalidResult(message: string): SettingsSaveResult {
  return {
    ok: false,
    error: { code: "INVALID_DATA", message },
  };
}

function getInitialState(): ProviderState {
  const loaded = loadWorkspace();

  if (loaded.shouldPersist) {
    const saved = saveWorkspace(loaded.workspace);
    return {
      workspace: loaded.workspace,
      storageError: saved.error ?? loaded.error,
      isPersisted: saved.ok,
      protectStoredData: false,
    };
  }

  const protectStoredData = Boolean(
    loaded.error &&
      [
        "READ_FAILED",
        "PARSE_FAILED",
        "INVALID_DATA",
        "UNSUPPORTED_VERSION",
      ].includes(loaded.error.code),
  );

  return {
    workspace: loaded.workspace,
    storageError: loaded.error,
    isPersisted: loaded.source === "storage" && loaded.error === null,
    protectStoredData,
  };
}

function cleanCompanyFields(current: Company, data: UpdateCompany): Company {
  return {
    ...current,
    name:
      data.name === undefined
        ? current.name
        : normalizeCompanyName(data.name),
    address:
      data.address === undefined ? current.address : data.address.trim(),
    phone: data.phone === undefined ? current.phone : data.phone.trim(),
    gstin:
      data.gstin === undefined
        ? current.gstin
        : data.gstin.trim().toUpperCase(),
    email: data.email === undefined ? current.email : data.email.trim(),
  };
}

function assertValidCompanyContact(
  phone: string,
  email: string,
) {
  if (phone && !/^\d{10}$/.test(phone)) {
    throw new Error("Phone number must contain exactly 10 digits.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid company email address.");
  }
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProviderState>(getInitialState);
  const workspaceRef = useRef(state.workspace);
  const protectedErrorRef = useRef<SettingsStorageError | null>(
    state.protectStoredData ? state.storageError : null,
  );

  function commitWorkspace(candidate: LedgerWorkspace): SettingsSaveResult {
    const validated = validateWorkspace(candidate);

    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    const nextWorkspace = validated.workspace;
    workspaceRef.current = nextWorkspace;

    if (protectedErrorRef.current) {
      const error = protectedErrorRef.current;
      setState({
        workspace: nextWorkspace,
        storageError: error,
        isPersisted: false,
        protectStoredData: true,
      });
      return { ok: false, error };
    }

    const result = saveWorkspace(nextWorkspace);
    setState({
      workspace: nextWorkspace,
      storageError: result.error,
      isPersisted: result.ok,
      protectStoredData: false,
    });
    return result;
  }

  function commitOrThrow(candidate: LedgerWorkspace) {
    const result = commitWorkspace(candidate);
    if (!result.ok && result.error.code === "INVALID_DATA") {
      throw new Error(result.error.message);
    }
  }

  function getCurrent() {
    return workspaceRef.current;
  }

  function createCompany(data: NewCompany) {
    const current = getCurrent();
    const name = normalizeCompanyName(data.name);

    if (!name) {
      throw new Error("Company name is required.");
    }

    if (
      current.companies.some(
        (company) =>
          normalizeForComparison(company.name) ===
          normalizeForComparison(name),
      )
    ) {
      throw new Error("A company with this name already exists.");
    }

    assertValidCompanyContact(
      data.phone?.trim() ?? "",
      data.email?.trim() ?? "",
    );

    const company: Company = {
      id: nextId(current.companies),
      name,
      address: data.address?.trim() ?? "",
      phone: data.phone?.trim() ?? "",
      gstin: data.gstin?.trim().toUpperCase() ?? "",
      email: data.email?.trim() ?? "",
      createdAt: new Date().toISOString(),
      settings: {
        statementHeader: DEFAULT_BUSINESS_SETTINGS.statementHeader,
        statementFooter: DEFAULT_BUSINESS_SETTINGS.statementFooter,
        print: { ...DEFAULT_PRINT_SETTINGS },
      },
    };

    commitOrThrow({
      ...current,
      companies: [...current.companies, company],
      activeCompanyId: company.id,
    });
    return company;
  }

  function updateCompany(companyId: number, data: UpdateCompany) {
    const current = getCurrent();
    const company = current.companies.find((item) => item.id === companyId);

    if (!company) {
      throw new Error("Company not found.");
    }

    const updatedCompany = cleanCompanyFields(company, data);
    if (!updatedCompany.name) {
      throw new Error("Company name is required.");
    }

    if (
      current.companies.some(
        (item) =>
          item.id !== companyId &&
          normalizeForComparison(item.name) ===
            normalizeForComparison(updatedCompany.name),
      )
    ) {
      throw new Error("Another company already uses this name.");
    }

    if (data.phone !== undefined || data.email !== undefined) {
      assertValidCompanyContact(
        updatedCompany.phone,
        updatedCompany.email,
      );
    }

    commitOrThrow({
      ...current,
      companies: current.companies.map((item) =>
        item.id === companyId ? updatedCompany : item,
      ),
    });
  }

  function switchCompany(companyId: number) {
    const current = getCurrent();
    if (!current.companies.some((company) => company.id === companyId)) {
      throw new Error("Company not found.");
    }
    if (current.activeCompanyId === companyId) return;
    commitOrThrow({ ...current, activeCompanyId: companyId });
  }

  function addParty(data: NewParty) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    const name = toDisplayName(data.name);
    const phone = data.phone.trim();
    const gstin = data.gstin.trim().toUpperCase();

    if (!name) throw new Error("Party name is required.");
    if (
      !current.regions.some(
        (region) =>
          region.id === data.regionId && region.companyId === companyId,
      )
    ) {
      throw new Error("Selected region does not exist in the active company.");
    }
    if (
      current.parties.some(
        (party) =>
          party.companyId === companyId &&
          party.regionId === data.regionId &&
          normalizeForComparison(party.name) === normalizeForComparison(name),
      )
    ) {
      throw new Error(
        "A party with this name already exists in the selected region.",
      );
    }
    if (
      gstin &&
      current.parties.some(
        (party) =>
          party.companyId === companyId &&
          normalizeForComparison(party.gstin) ===
            normalizeForComparison(gstin),
      )
    ) {
      throw new Error(
        "A party with this GSTIN already exists in the active company.",
      );
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      throw new Error("Phone number must contain exactly 10 digits.");
    }

    const party: Party = {
      id: nextId(current.parties),
      companyId,
      name,
      phone,
      regionId: data.regionId,
      address: data.address.trim(),
      gstin,
      notes: data.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    commitOrThrow({ ...current, parties: [...current.parties, party] });
    return party;
  }

  function updateParty(partyId: number, data: UpdateParty) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    const existing = current.parties.find(
      (party) => party.id === partyId && party.companyId === companyId,
    );
    if (!existing) throw new Error("Party not found in the active company.");

    const name =
      data.name === undefined ? existing.name : toDisplayName(data.name);
    const regionId = data.regionId ?? existing.regionId;
    const phone = data.phone === undefined ? existing.phone : data.phone.trim();
    const gstin =
      data.gstin === undefined
        ? existing.gstin
        : data.gstin.trim().toUpperCase();

    if (!name) throw new Error("Party name is required.");
    if (
      !current.regions.some(
        (region) => region.id === regionId && region.companyId === companyId,
      )
    ) {
      throw new Error("Selected region does not exist in the active company.");
    }
    if (
      current.parties.some(
        (party) =>
          party.id !== partyId &&
          party.companyId === companyId &&
          party.regionId === regionId &&
          normalizeForComparison(party.name) === normalizeForComparison(name),
      )
    ) {
      throw new Error("Another party in this region already uses this name.");
    }
    if (
      gstin &&
      current.parties.some(
        (party) =>
          party.id !== partyId &&
          party.companyId === companyId &&
          normalizeForComparison(party.gstin) ===
            normalizeForComparison(gstin),
      )
    ) {
      throw new Error(
        "Another party in the active company already uses this GSTIN.",
      );
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      throw new Error("Phone number must contain exactly 10 digits.");
    }

    const updated: Party = {
      ...existing,
      ...data,
      name,
      regionId,
      phone,
      gstin,
      address: data.address === undefined ? existing.address : data.address.trim(),
      notes: data.notes === undefined ? existing.notes : data.notes.trim(),
    };
    commitOrThrow({
      ...current,
      parties: current.parties.map((party) =>
        party.id === partyId && party.companyId === companyId ? updated : party,
      ),
    });
  }

  function deleteParty(partyId: number) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    if (
      !current.parties.some(
        (party) => party.id === partyId && party.companyId === companyId,
      )
    ) {
      throw new Error("Party not found in the active company.");
    }
    if (
      current.transactions.some(
        (transaction) =>
          transaction.partyId === partyId &&
          transaction.companyId === companyId,
      )
    ) {
      throw new Error("This party has transactions and cannot be deleted yet.");
    }
    commitOrThrow({
      ...current,
      parties: current.parties.filter(
        (party) => party.id !== partyId || party.companyId !== companyId,
      ),
    });
  }

  function addRegion(data: NewRegion) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    const name = toDisplayName(data.name);
    if (!name) throw new Error("Region name is required.");
    if (
      current.regions.some(
        (region) =>
          region.companyId === companyId &&
          normalizeForComparison(region.name) === normalizeForComparison(name),
      )
    ) {
      throw new Error("This region already exists in the active company.");
    }
    const region: Region = { id: nextId(current.regions), companyId, name };
    commitOrThrow({ ...current, regions: [...current.regions, region] });
    return region;
  }

  function updateRegion(regionId: number, name: string) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    const cleanName = toDisplayName(name);
    if (!cleanName) throw new Error("Region name is required.");
    if (
      !current.regions.some(
        (region) => region.id === regionId && region.companyId === companyId,
      )
    ) {
      throw new Error("Region not found in the active company.");
    }
    if (
      current.regions.some(
        (region) =>
          region.id !== regionId &&
          region.companyId === companyId &&
          normalizeForComparison(region.name) ===
            normalizeForComparison(cleanName),
      )
    ) {
      throw new Error("Another region in this company already uses this name.");
    }
    commitOrThrow({
      ...current,
      regions: current.regions.map((region) =>
        region.id === regionId && region.companyId === companyId
          ? { ...region, name: cleanName }
          : region,
      ),
    });
  }

  function deleteRegion(regionId: number) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    if (
      !current.regions.some(
        (region) => region.id === regionId && region.companyId === companyId,
      )
    ) {
      throw new Error("Region not found in the active company.");
    }
    if (
      current.parties.some(
        (party) => party.regionId === regionId && party.companyId === companyId,
      )
    ) {
      throw new Error(
        "This region contains parties. Move or delete those parties first.",
      );
    }
    commitOrThrow({
      ...current,
      regions: current.regions.filter(
        (region) => region.id !== regionId || region.companyId !== companyId,
      ),
    });
  }

  function addTransaction(data: NewTransaction) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    if (
      !current.parties.some(
        (party) => party.id === data.partyId && party.companyId === companyId,
      )
    ) {
      throw new Error("Selected party does not exist in the active company.");
    }
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new Error("Transaction amount must be greater than zero.");
    }
    if (!data.transactionDateTime) {
      throw new Error("Transaction date and time are required.");
    }
    if (!data.description.trim()) {
      throw new Error("Transaction description is required.");
    }

    const transaction: LedgerTransaction = {
      id: nextId(current.transactions),
      companyId,
      ...data,
      transactionDateTime: data.transactionDateTime,
      description: data.description.trim(),
      notes: data.notes.trim(),
      attachmentName: data.attachmentName?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    commitOrThrow({
      ...current,
      transactions: [...current.transactions, transaction],
    });
    return transaction;
  }

  function updateTransaction(transactionId: number, data: UpdateTransaction) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    const existing = current.transactions.find(
      (transaction) =>
        transaction.id === transactionId && transaction.companyId === companyId,
    );
    if (!existing) {
      throw new Error("Transaction not found in the active company.");
    }

    const partyId = data.partyId ?? existing.partyId;
    if (
      !current.parties.some(
        (party) => party.id === partyId && party.companyId === companyId,
      )
    ) {
      throw new Error("Selected party does not exist in the active company.");
    }
    if (
      data.amount !== undefined &&
      (!Number.isFinite(data.amount) || data.amount <= 0)
    ) {
      throw new Error("Transaction amount must be greater than zero.");
    }
    if (
      data.transactionDateTime !== undefined &&
      !data.transactionDateTime
    ) {
      throw new Error("Transaction date and time are required.");
    }
    if (data.description !== undefined && !data.description.trim()) {
      throw new Error("Description cannot be empty.");
    }

    const updated: LedgerTransaction = {
      ...existing,
      ...data,
      partyId,
      description:
        data.description === undefined
          ? existing.description
          : data.description.trim(),
      notes: data.notes === undefined ? existing.notes : data.notes.trim(),
      attachmentName:
        data.attachmentName === undefined
          ? existing.attachmentName
          : data.attachmentName.trim() || undefined,
    };
    commitOrThrow({
      ...current,
      transactions: current.transactions.map((transaction) =>
        transaction.id === transactionId && transaction.companyId === companyId
          ? updated
          : transaction,
      ),
    });
  }

  function deleteTransaction(transactionId: number) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    if (
      !current.transactions.some(
        (transaction) =>
          transaction.id === transactionId &&
          transaction.companyId === companyId,
      )
    ) {
      throw new Error("Transaction not found in the active company.");
    }
    commitOrThrow({
      ...current,
      transactions: current.transactions.filter(
        (transaction) =>
          transaction.id !== transactionId ||
          transaction.companyId !== companyId,
      ),
    });
  }

  function getPartyBalance(partyId: number) {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    return roundCurrency(
      current.transactions
        .filter(
          (transaction) =>
            transaction.companyId === companyId &&
            transaction.partyId === partyId,
        )
        .reduce(
          (balance, transaction) =>
            transaction.type === "CREDIT"
              ? balance + transaction.amount
              : balance - transaction.amount,
          0,
        ),
    );
  }

  function getRegionById(regionId: number) {
    const current = getCurrent();
    return current.regions.find(
      (region) =>
        region.id === regionId && region.companyId === current.activeCompanyId,
    );
  }

  function resetDemoData() {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    const regions = current.regions.filter(
      (region) => region.companyId !== companyId,
    );
    const parties = current.parties.filter(
      (party) => party.companyId !== companyId,
    );
    const transactions = current.transactions.filter(
      (transaction) => transaction.companyId !== companyId,
    );
    const regionIds = new Map<number, number>();
    const partyIds = new Map<number, number>();
    let nextRegionId = nextId(regions);
    let nextPartyId = nextId(parties);
    let nextTransactionId = nextId(transactions);

    const demoRegions: Region[] = seedRegions.map((seed) => {
      const region = { ...seed, id: nextRegionId, companyId };
      regionIds.set(seed.id, nextRegionId);
      nextRegionId += 1;
      return region;
    });
    const demoParties: Party[] = seedParties.map((seed) => {
      const regionId = regionIds.get(seed.regionId);
      if (regionId === undefined) {
        throw new Error("Demo party references an unknown demo region.");
      }
      const party = { ...seed, id: nextPartyId, companyId, regionId };
      partyIds.set(seed.id, nextPartyId);
      nextPartyId += 1;
      return party;
    });
    const demoTransactions: LedgerTransaction[] = seedTransactions.map(
      (seed) => {
        const partyId = partyIds.get(seed.partyId);
        if (partyId === undefined) {
          throw new Error("Demo transaction references an unknown demo party.");
        }
        const transaction = {
          ...seed,
          id: nextTransactionId,
          companyId,
          partyId,
        };
        nextTransactionId += 1;
        return transaction;
      },
    );

    commitOrThrow({
      ...current,
      regions: [...regions, ...demoRegions],
      parties: [...parties, ...demoParties],
      transactions: [...transactions, ...demoTransactions],
    });
  }

  function applySettingsPatch(patch: AppSettingsPatch): SettingsSaveResult {
    const current = getCurrent();
    const companyId = current.activeCompanyId;
    const company = current.companies.find((item) => item.id === companyId);
    if (!company) return invalidResult("The active company no longer exists.");
    if (
      patch.business?.currency !== undefined &&
      patch.business.currency !== "INR"
    ) {
      return invalidResult("Only INR is currently supported.");
    }

    const business = patch.business;
    const updatedCompany: Company = {
      ...company,
      name:
        business?.companyName === undefined
          ? company.name
          : normalizeCompanyName(business.companyName),
      address:
        business?.address === undefined
          ? company.address
          : business.address.trim(),
      phone:
        business?.phone === undefined ? company.phone : business.phone.trim(),
      gstin:
        business?.gstin === undefined
          ? company.gstin
          : business.gstin.trim().toUpperCase(),
      email:
        business?.email === undefined ? company.email : business.email.trim(),
      settings: {
        statementHeader:
          business?.statementHeader === undefined
            ? company.settings.statementHeader
            : business.statementHeader.trim(),
        statementFooter:
          business?.statementFooter === undefined
            ? company.settings.statementFooter
            : business.statementFooter.trim(),
        print: { ...company.settings.print, ...patch.print },
      },
    };

    if (business?.phone !== undefined || business?.email !== undefined) {
      try {
        assertValidCompanyContact(
          updatedCompany.phone,
          updatedCompany.email,
        );
      } catch (cause) {
        return invalidResult(
          cause instanceof Error
            ? cause.message
            : "Company contact details are invalid.",
        );
      }
    }
    const next: LedgerWorkspace = {
      ...current,
      companies: current.companies.map((item) =>
        item.id === companyId ? updatedCompany : item,
      ),
      applicationSettings: {
        appearance: {
          ...current.applicationSettings.appearance,
          ...patch.appearance,
        },
      },
    };
    return commitWorkspace(next);
  }

  function clearStorageError() {
    setState((current) => ({ ...current, storageError: null }));
  }

  function getWorkspaceSnapshot() {
    return cloneWorkspace(getCurrent());
  }

  function replaceWorkspace(workspace: unknown): SettingsSaveResult {
    const validated = validateWorkspace(workspace);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    const result = saveWorkspace(validated.workspace);
    if (!result.ok) {
      setState((current) => ({ ...current, storageError: result.error }));
      return result;
    }

    const next = cloneWorkspace(validated.workspace);
    protectedErrorRef.current = null;
    workspaceRef.current = next;
    setState({
      workspace: next,
      storageError: null,
      isPersisted: true,
      protectStoredData: false,
    });
    return result;
  }

  const workspace = state.workspace;
  const activeCompanyId = workspace.activeCompanyId;
  const activeCompany = workspace.companies.find(
    (company) => company.id === activeCompanyId,
  );
  if (!activeCompany) {
    throw new Error("LedgerFlow workspace has no active company.");
  }

  const parties = workspace.parties.filter(
    (party) => party.companyId === activeCompanyId,
  );
  const regions = workspace.regions.filter(
    (region) => region.companyId === activeCompanyId,
  );
  const transactions = workspace.transactions.filter(
    (transaction) => transaction.companyId === activeCompanyId,
  );

  return (
    <LedgerContext.Provider
      value={{
        companies: workspace.companies,
        activeCompanyId,
        activeCompany,
        appearance: workspace.applicationSettings.appearance,
        parties,
        regions,
        transactions,
        storageError: state.storageError,
        isPersisted: state.isPersisted,
        createCompany,
        updateCompany,
        switchCompany,
        addParty,
        updateParty,
        deleteParty,
        addRegion,
        updateRegion,
        deleteRegion,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        getPartyBalance,
        getRegionById,
        resetDemoData,
        applySettingsPatch,
        clearStorageError,
        getWorkspaceSnapshot,
        replaceWorkspace,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}
