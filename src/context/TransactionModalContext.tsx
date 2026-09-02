import {
  createContext,
  useContext,
  useState,
} from "react";

import type { ReactNode } from "react";

import AddTransactionModal from "../components/dashboard/AddTransactionModal";

type TransactionType = "CREDIT" | "DEBIT";

interface TransactionModalContextType {
  openTransactionModal: (
    type?: TransactionType,
    partyId?: number,
  ) => void;
}

const TransactionModalContext =
  createContext<TransactionModalContextType | undefined>(
    undefined,
  );

export function TransactionModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const [type, setType] =
    useState<TransactionType>("CREDIT");

  const [selectedPartyId, setSelectedPartyId] =
    useState<number | undefined>(undefined);

  function openTransactionModal(
    selectedType: TransactionType = "CREDIT",
    partyId?: number,
  ) {
    setType(selectedType);
    setSelectedPartyId(partyId);
    setOpen(true);
  }

  function closeTransactionModal() {
    setOpen(false);
    setSelectedPartyId(undefined);
  }

  return (
    <TransactionModalContext.Provider
      value={{ openTransactionModal }}
    >
      {children}

      <AddTransactionModal
        key={`${type}-${selectedPartyId ?? "none"}-${open}`}
        open={open}
        defaultType={type}
        defaultPartyId={selectedPartyId}
        onClose={closeTransactionModal}
      />
    </TransactionModalContext.Provider>
  );
}

export function useTransactionModal() {
  const context = useContext(
    TransactionModalContext,
  );

  if (!context) {
    throw new Error(
      "useTransactionModal must be used inside TransactionModalProvider",
    );
  }

  return context;
}