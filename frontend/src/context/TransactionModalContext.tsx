import {
  useState,
} from "react";

import type { ReactNode } from "react";

import AddTransactionModal from "../components/dashboard/AddTransactionModal";
import {
  TransactionModalContext,
} from "./transaction-modal-context";
import type {
  TransactionModalType,
} from "./transaction-modal-context";

export function TransactionModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const [type, setType] =
    useState<TransactionModalType>("CREDIT");

  const [selectedPartyId, setSelectedPartyId] =
    useState<number | undefined>(undefined);

  function openTransactionModal(
    selectedType: TransactionModalType = "CREDIT",
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
