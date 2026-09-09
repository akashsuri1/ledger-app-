import { createContext } from "react";

export type TransactionModalType = "CREDIT" | "DEBIT";

export interface TransactionModalContextValue {
  openTransactionModal: (
    type?: TransactionModalType,
    partyId?: number,
  ) => void;
}

export const TransactionModalContext = createContext<
  TransactionModalContextValue | undefined
>(undefined);
