import type { LedgerWorkspace } from "../types/workspace";

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
