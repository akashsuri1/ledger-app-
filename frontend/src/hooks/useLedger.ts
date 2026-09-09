import { useContext } from "react";

import { LedgerContext } from "../context/ledger-context";

export function useLedger() {
  const context = useContext(LedgerContext);

  if (!context) {
    throw new Error("useLedger must be used inside LedgerProvider.");
  }

  return context;
}
