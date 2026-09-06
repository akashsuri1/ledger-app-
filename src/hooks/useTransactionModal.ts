import { useContext } from "react";

import { TransactionModalContext } from "../context/transaction-modal-context";

export function useTransactionModal() {
  const context = useContext(TransactionModalContext);

  if (!context) {
    throw new Error(
      "useTransactionModal must be used inside TransactionModalProvider",
    );
  }

  return context;
}
