import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  seedParties,
  seedRegions,
  seedTransactions,
} from "../data/seedData";

import type {
  LedgerTransaction,
  NewParty,
  NewRegion,
  NewTransaction,
  Party,
  Region,
  TransactionType,
  UpdateParty,
  UpdateTransaction,
} from "../types";

import {
  normalizeForComparison,
  toDisplayName,
} from "../utils/text";

interface LedgerState {
  parties: Party[];

  regions: Region[];

  transactions:
    LedgerTransaction[];
}

interface LegacyTransaction {
  id: number;

  partyId: number;

  type: TransactionType;

  amount: number;

  date?: string;

  transactionDateTime?: string;

  description: string;

  notes?: string;

  attachmentName?: string;

  createdAt?: string;
}

interface LedgerContextType {
  parties: Party[];

  regions: Region[];

  transactions:
    LedgerTransaction[];

  addParty: (
    party: NewParty,
  ) => Party;

  updateParty: (
    partyId: number,
    data: UpdateParty,
  ) => void;

  deleteParty: (
    partyId: number,
  ) => void;

  addRegion: (
    region: NewRegion,
  ) => Region;

  updateRegion: (
    regionId: number,
    name: string,
  ) => void;

  deleteRegion: (
    regionId: number,
  ) => void;

  addTransaction: (
    transaction: NewTransaction,
  ) => LedgerTransaction;

  updateTransaction: (
    transactionId: number,
    data: UpdateTransaction,
  ) => void;

  deleteTransaction: (
    transactionId: number,
  ) => void;

  getPartyBalance: (
    partyId: number,
  ) => number;

  getRegionById: (
    regionId: number,
  ) => Region | undefined;

  resetDemoData: () => void;
}

const STORAGE_KEY =
  "ledgerflow-data-v1";

const LedgerContext =
  createContext<
    LedgerContextType | undefined
  >(undefined);

function nextId(
  items: { id: number }[],
) {
  if (
    items.length === 0
  ) {
    return 1;
  }

  return (
    Math.max(
      ...items.map(
        (item) =>
          item.id,
      ),
    ) + 1
  );
}

function migrateTransaction(
  transaction:
    LegacyTransaction,
): LedgerTransaction {
  let transactionDateTime =
    transaction.transactionDateTime;

  /*
   * Old LedgerFlow transactions
   * only contained:
   *
   * date: "2026-08-22"
   *
   * Convert those into:
   *
   * "2026-08-22T00:00:00"
   */
  if (
    !transactionDateTime &&
    transaction.date
  ) {
    transactionDateTime =
      `${transaction.date}T00:00:00`;
  }

  /*
   * Safety fallback.
   */
  if (
    !transactionDateTime
  ) {
    transactionDateTime =
      new Date()
        .toISOString()
        .slice(0, 19);
  }

  return {
    id:
      transaction.id,

    partyId:
      transaction.partyId,

    type:
      transaction.type,

    amount:
      transaction.amount,

    transactionDateTime,

    description:
      transaction.description,

    notes:
      transaction.notes ?? "",

    attachmentName:
      transaction.attachmentName,

    createdAt:
      transaction.createdAt ??
      new Date().toISOString(),
  };
}

function migrateParty(
  party: Party,
): Party {
  return {
    ...party,
    name: toDisplayName(
      party.name ?? "",
    ),
    phone:
      (party.phone ?? "").trim(),
    address:
      party.address ?? "",
    gstin:
      (party.gstin ?? "")
        .trim()
        .toUpperCase(),
    notes:
      party.notes ?? "",
  };
}

function migrateRegion(
  region: Region,
): Region {
  return {
    ...region,
    name: toDisplayName(
      region.name ?? "",
    ),
  };
}

function getInitialState():
  LedgerState {
  try {
    const saved =
      localStorage.getItem(
        STORAGE_KEY,
      );

    if (saved) {
      const parsed =
        JSON.parse(saved);

      if (
        Array.isArray(
          parsed.parties,
        ) &&
        Array.isArray(
          parsed.regions,
        ) &&
        Array.isArray(
          parsed.transactions,
        )
      ) {
        const migratedTransactions =
          parsed.transactions.map(
            (
              transaction:
                LegacyTransaction,
            ) =>
              migrateTransaction(
                transaction,
              ),
          );

        return {
          parties:
            parsed.parties.map(
              (party: Party) =>
                migrateParty(
                  party,
                ),
            ),

          regions:
            parsed.regions.map(
              (region: Region) =>
                migrateRegion(
                  region,
                ),
            ),

          transactions:
            migratedTransactions,
        };
      }
    }
  } catch (error) {
    console.error(
      "Failed to load LedgerFlow data:",
      error,
    );
  }

  return {
    parties:
      seedParties,

    regions:
      seedRegions,

    transactions:
      seedTransactions,
  };
}

export function LedgerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    state,
    setState,
  ] =
    useState<LedgerState>(
      getInitialState,
    );

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,

        JSON.stringify(
          state,
        ),
      );
    } catch (error) {
      console.error(
        "Failed to save LedgerFlow data:",
        error,
      );
    }
  }, [state]);

  function addParty(
    data: NewParty,
  ) {
    const name =
      toDisplayName(
        data.name,
      );

    const phone =
      data.phone.trim();

    const gstin =
      data.gstin
        .trim()
        .toUpperCase();

    if (!name) {
      throw new Error(
        "Party name is required.",
      );
    }

    const regionExists =
      state.regions.some(
        (region) =>
          region.id ===
          data.regionId,
      );

    if (!regionExists) {
      throw new Error(
        "Selected region does not exist.",
      );
    }

    const duplicate =
      state.parties.some(
        (party) =>
          party.regionId ===
            data.regionId &&
          normalizeForComparison(
            party.name,
          ) ===
            normalizeForComparison(
              name,
            ),
      );

    if (duplicate) {
      throw new Error(
        "A party with this name already exists in the selected region.",
      );
    }

    if (
      gstin &&
      state.parties.some(
        (party) =>
          normalizeForComparison(
            party.gstin,
          ) ===
          normalizeForComparison(
            gstin,
          ),
      )
    ) {
      throw new Error(
        "A party with this GSTIN already exists.",
      );
    }

    if (
      phone &&
      !/^\d{10}$/.test(
        phone,
      )
    ) {
      throw new Error(
        "Phone number must contain exactly 10 digits.",
      );
    }

    const newParty: Party =
      {
        id: nextId(
          state.parties,
        ),

        name,

        phone,

        regionId:
          data.regionId,

        address:
          data.address.trim(),

        gstin,

        notes:
          data.notes.trim(),

        createdAt:
          new Date().toISOString(),
      };

    setState(
      (previous) => ({
        ...previous,

        parties: [
          ...previous.parties,

          newParty,
        ],
      }),
    );

    return newParty;
  }

  function updateParty(
    partyId: number,
    data: UpdateParty,
  ) {
    const existingParty =
      state.parties.find(
        (party) =>
          party.id ===
          partyId,
      );

    if (!existingParty) {
      throw new Error(
        "Party not found.",
      );
    }

    const name =
      data.name !== undefined
        ? toDisplayName(
            data.name,
          )
        : existingParty.name;

    const regionId =
      data.regionId ??
      existingParty.regionId;

    const phone =
      data.phone !== undefined
        ? data.phone.trim()
        : existingParty.phone;

    const gstin =
      data.gstin !== undefined
        ? data.gstin
            .trim()
            .toUpperCase()
        : existingParty.gstin;

    if (!name) {
      throw new Error(
        "Party name is required.",
      );
    }

    const regionExists =
      state.regions.some(
        (region) =>
          region.id ===
          regionId,
      );

    if (!regionExists) {
      throw new Error(
        "Selected region does not exist.",
      );
    }

    const duplicate =
      state.parties.some(
        (party) =>
          party.id !==
            partyId &&
          party.regionId ===
            regionId &&
          normalizeForComparison(
            party.name,
          ) ===
            normalizeForComparison(
              name,
            ),
      );

    if (duplicate) {
      throw new Error(
        "Another party in this region already uses this name.",
      );
    }

    if (
      gstin &&
      state.parties.some(
        (party) =>
          party.id !==
            partyId &&
          normalizeForComparison(
            party.gstin,
          ) ===
            normalizeForComparison(
              gstin,
            ),
      )
    ) {
      throw new Error(
        "Another party already uses this GSTIN.",
      );
    }

    if (
      phone &&
      !/^\d{10}$/.test(
        phone,
      )
    ) {
      throw new Error(
        "Phone number must contain exactly 10 digits.",
      );
    }

    const updatedParty: Party =
      {
        ...existingParty,
        ...data,
        name,
        regionId,
        phone,
        gstin,
        address:
          data.address !==
          undefined
            ? data.address.trim()
            : existingParty.address,
        notes:
          data.notes !==
          undefined
            ? data.notes.trim()
            : existingParty.notes,
      };

    setState(
      (previous) => ({
        ...previous,

        parties:
          previous.parties.map(
            (party) =>
              party.id ===
              partyId
                ? updatedParty
                : party,
          ),
      }),
    );
  }

  function deleteParty(
    partyId: number,
  ) {
    const hasTransactions =
      state.transactions.some(
        (transaction) =>
          transaction.partyId ===
          partyId,
      );

    if (
      hasTransactions
    ) {
      throw new Error(
        "This party has transactions and cannot be deleted yet.",
      );
    }

    setState(
      (previous) => ({
        ...previous,

        parties:
          previous.parties.filter(
            (party) =>
              party.id !==
              partyId,
          ),
      }),
    );
  }

  function addRegion(
    data: NewRegion,
  ) {
    const name =
      toDisplayName(
        data.name,
      );

    if (!name) {
      throw new Error(
        "Region name is required.",
      );
    }

    const duplicate =
      state.regions.some(
        (region) =>
          normalizeForComparison(
            region.name,
          ) ===
          normalizeForComparison(
            name,
          ),
      );

    if (duplicate) {
      throw new Error(
        "This region already exists.",
      );
    }

    const newRegion: Region =
      {
        id: nextId(
          state.regions,
        ),

        name,
      };

    setState(
      (previous) => ({
        ...previous,

        regions: [
          ...previous.regions,

          newRegion,
        ],
      }),
    );

    return newRegion;
  }

  function updateRegion(
    regionId: number,
    name: string,
  ) {
    const cleanName =
      toDisplayName(
        name,
      );

    if (!cleanName) {
      throw new Error(
        "Region name is required.",
      );
    }

    const regionExists =
      state.regions.some(
        (region) =>
          region.id ===
          regionId,
      );

    if (!regionExists) {
      throw new Error(
        "Region not found.",
      );
    }

    const duplicate =
      state.regions.some(
        (region) =>
          region.id !==
            regionId &&
          normalizeForComparison(
            region.name,
          ) ===
            normalizeForComparison(
              cleanName,
            ),
      );

    if (duplicate) {
      throw new Error(
        "Another region already uses this name.",
      );
    }

    setState(
      (previous) => ({
        ...previous,

        regions:
          previous.regions.map(
            (region) =>
              region.id ===
              regionId
                ? {
                    ...region,
                    name:
                      cleanName,
                  }
                : region,
          ),
      }),
    );
  }

  function deleteRegion(
    regionId: number,
  ) {
    const hasParties =
      state.parties.some(
        (party) =>
          party.regionId ===
          regionId,
      );

    if (
      hasParties
    ) {
      throw new Error(
        "This region contains parties. Move or delete those parties first.",
      );
    }

    setState(
      (previous) => ({
        ...previous,

        regions:
          previous.regions.filter(
            (region) =>
              region.id !==
              regionId,
          ),
      }),
    );
  }

  function addTransaction(
    data: NewTransaction,
  ) {
    const partyExists =
      state.parties.some(
        (party) =>
          party.id ===
          data.partyId,
      );

    if (
      !partyExists
    ) {
      throw new Error(
        "Selected party does not exist.",
      );
    }

    if (
      !Number.isFinite(
        data.amount,
      ) ||
      data.amount <= 0
    ) {
      throw new Error(
        "Transaction amount must be greater than zero.",
      );
    }

    if (
      !data.transactionDateTime
    ) {
      throw new Error(
        "Transaction date and time are required.",
      );
    }

    if (
      !data.description.trim()
    ) {
      throw new Error(
        "Transaction description is required.",
      );
    }

    const transaction:
      LedgerTransaction =
      {
        id: nextId(
          state.transactions,
        ),

        ...data,

        transactionDateTime:
          data.transactionDateTime,

        description:
          data.description.trim(),

        notes:
          data.notes.trim(),

        createdAt:
          new Date().toISOString(),
      };

    setState(
      (previous) => ({
        ...previous,

        transactions: [
          ...previous.transactions,

          transaction,
        ],
      }),
    );

    return transaction;
  }

  function updateTransaction(
    transactionId: number,
    data: UpdateTransaction,
  ) {
    const existing =
      state.transactions.find(
        (transaction) =>
          transaction.id ===
          transactionId,
      );

    if (!existing) {
      throw new Error(
        "Transaction not found.",
      );
    }

    if (
      data.partyId !==
      undefined
    ) {
      const partyExists =
        state.parties.some(
          (party) =>
            party.id ===
            data.partyId,
        );

      if (
        !partyExists
      ) {
        throw new Error(
          "Selected party does not exist.",
        );
      }
    }

    if (
      data.amount !==
      undefined &&
      (
        !Number.isFinite(
          data.amount,
        ) ||
        data.amount <= 0
      )
    ) {
      throw new Error(
        "Transaction amount must be greater than zero.",
      );
    }

    if (
      data.transactionDateTime !==
        undefined &&
      !data.transactionDateTime
    ) {
      throw new Error(
        "Transaction date and time are required.",
      );
    }

    if (
      data.description !==
        undefined &&
      !data.description.trim()
    ) {
      throw new Error(
        "Description cannot be empty.",
      );
    }

    setState(
      (previous) => ({
        ...previous,

        transactions:
          previous.transactions.map(
            (transaction) =>
              transaction.id ===
              transactionId
                ? {
                    ...transaction,
                    ...data,

                    description:
                      data.description !==
                      undefined
                        ? data.description.trim()
                        : transaction.description,

                    notes:
                      data.notes !==
                      undefined
                        ? data.notes.trim()
                        : transaction.notes,
                  }
                : transaction,
          ),
      }),
    );
  }

  function deleteTransaction(
    transactionId: number,
  ) {
    const exists =
      state.transactions.some(
        (transaction) =>
          transaction.id ===
          transactionId,
      );

    if (!exists) {
      throw new Error(
        "Transaction not found.",
      );
    }

    setState(
      (previous) => ({
        ...previous,

        transactions:
          previous.transactions.filter(
            (transaction) =>
              transaction.id !==
              transactionId,
          ),
      }),
    );
  }

  function getPartyBalance(
    partyId: number,
  ) {
    return state.transactions
      .filter(
        (transaction) =>
          transaction.partyId ===
          partyId,
      )
      .reduce(
        (
          balance,
          transaction,
        ) => {
          if (
            transaction.type ===
            "CREDIT"
          ) {
            return (
              balance +
              transaction.amount
            );
          }

          return (
            balance -
            transaction.amount
          );
        },

        0,
      );
  }

  function getRegionById(
    regionId: number,
  ) {
    return state.regions.find(
      (region) =>
        region.id ===
        regionId,
    );
  }

  function resetDemoData() {
    setState({
      parties:
        seedParties,

      regions:
        seedRegions,

      transactions:
        seedTransactions,
    });
  }

  return (
    <LedgerContext.Provider
      value={{
        parties:
          state.parties,

        regions:
          state.regions,

        transactions:
          state.transactions,

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
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const context =
    useContext(
      LedgerContext,
    );

  if (!context) {
    throw new Error(
      "useLedger must be used inside LedgerProvider.",
    );
  }

  return context;
}
