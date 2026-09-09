import type { LedgerWorkspace } from "../types/workspace";

export function isCompanyLedgerEmpty(
  workspace: LedgerWorkspace,
  companyId: number,
) {
  return (
    !workspace.regions.some((region) => region.companyId === companyId) &&
    !workspace.parties.some((party) => party.companyId === companyId) &&
    !workspace.transactions.some(
      (transaction) => transaction.companyId === companyId,
    )
  );
}

export function deleteEmptyCompany(
  workspace: LedgerWorkspace,
  companyId: number,
): LedgerWorkspace {
  if (!workspace.companies.some((company) => company.id === companyId)) {
    throw new Error("Company not found.");
  }

  if (!isCompanyLedgerEmpty(workspace, companyId)) {
    throw new Error(
      "Only an empty company can be deleted. Remove its regions, parties, and transactions first.",
    );
  }

  const companies = workspace.companies.filter(
    (company) => company.id !== companyId,
  );
  const activeCompanyId =
    workspace.activeCompanyId === companyId
      ? companies[0]?.id ?? 0
      : workspace.activeCompanyId;

  return {
    ...workspace,
    companies,
    activeCompanyId,
  };
}

export function cascadeDeleteParty(
  workspace: LedgerWorkspace,
  partyId: number,
): LedgerWorkspace {
  const companyId = workspace.activeCompanyId;
  const partyExists = workspace.parties.some(
    (party) =>
      party.id === partyId &&
      party.companyId === companyId,
  );

  if (!partyExists) {
    throw new Error("Party not found in the active company.");
  }

  return {
    ...workspace,
    transactions: workspace.transactions.filter(
      (transaction) =>
        transaction.companyId !== companyId ||
        transaction.partyId !== partyId,
    ),
    parties: workspace.parties.filter(
      (party) =>
        party.companyId !== companyId ||
        party.id !== partyId,
    ),
  };
}
