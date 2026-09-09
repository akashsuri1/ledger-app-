import type {
  LedgerTransaction,
  Party,
  Region,
} from "../types";

export const seedRegions: Region[] = [
  {
    id: 1,
    companyId: 1,
    name: "Punjab",
  },
  {
    id: 2,
    companyId: 1,
    name: "Delhi",
  },
  {
    id: 3,
    companyId: 1,
    name: "Haryana",
  },
  {
    id: 4,
    companyId: 1,
    name: "Himachal Pradesh",
  },
];

export const seedParties: Party[] = [
  {
    id: 1,
    companyId: 1,
    name: "ABC Traders",
    phone: "9876543210",
    regionId: 1,
    address: "Pathankot, Punjab",
    gstin: "03ABCDE1234F1Z5",
    notes: "Regular wholesale customer.",
    createdAt: "2026-08-01T10:00:00",
  },

  {
    id: 2,
    companyId: 1,
    name: "Sharma & Co.",
    phone: "9812345678",
    regionId: 3,
    address: "Ambala, Haryana",
    gstin: "",
    notes: "",
    createdAt: "2026-08-02T10:00:00",
  },

  {
    id: 3,
    companyId: 1,
    name: "XYZ Suppliers",
    phone: "9898989898",
    regionId: 2,
    address: "New Delhi",
    gstin: "07AAAAA0000A1Z5",
    notes: "Primary supplier.",
    createdAt: "2026-08-03T10:00:00",
  },

  {
    id: 4,
    companyId: 1,
    name: "Kapoor Enterprises",
    phone: "9877000000",
    regionId: 1,
    address: "Ludhiana, Punjab",
    gstin: "",
    notes: "",
    createdAt: "2026-08-04T10:00:00",
  },

  {
    id: 5,
    companyId: 1,
    name: "Modern Agencies",
    phone: "9800000000",
    regionId: 4,
    address: "Kangra, Himachal Pradesh",
    gstin: "",
    notes: "",
    createdAt: "2026-08-05T10:00:00",
  },
];

export const seedTransactions: LedgerTransaction[] = [
  {
    id: 101,
    companyId: 1,
    partyId: 1,
    type: "CREDIT",
    amount: 25000,

    transactionDate:
      "2026-08-22",

    description: "Goods supplied",
    notes: "August wholesale order.",
    attachmentName: "INV-1024.pdf",

    createdAt: "2026-08-22T10:30:00",
  },

  {
    id: 102,
    companyId: 1,
    partyId: 1,
    type: "DEBIT",
    amount: 10000,

    transactionDate:
      "2026-08-18",

    description: "Payment received",
    notes: "",

    createdAt: "2026-08-18T14:15:00",
  },

  {
    id: 103,
    companyId: 1,
    partyId: 1,
    type: "CREDIT",
    amount: 30000,

    transactionDate:
      "2026-08-12",

    description: "Material supplied",
    notes: "",
    attachmentName: "INV-1017.pdf",

    createdAt: "2026-08-12T11:00:00",
  },

  {
    id: 201,
    companyId: 1,
    partyId: 2,
    type: "CREDIT",
    amount: 44500,

    transactionDate:
      "2026-08-19",

    description: "Product delivery",
    notes: "",
    attachmentName: "INV-201.pdf",

    createdAt: "2026-08-19T12:30:00",
  },

  {
    id: 202,
    companyId: 1,
    partyId: 2,
    type: "DEBIT",
    amount: 12500,

    transactionDate:
      "2026-08-21",

    description: "Payment received",
    notes: "",

    createdAt: "2026-08-21T16:45:00",
  },

  {
    id: 301,
    companyId: 1,
    partyId: 3,
    type: "DEBIT",
    amount: 18500,

    transactionDate:
      "2026-08-17",

    description: "Supplier payment due",
    notes: "Pending supplier payment.",
    attachmentName: "BILL-342.pdf",

    createdAt: "2026-08-17T09:30:00",
  },

  {
    id: 401,
    companyId: 1,
    partyId: 4,
    type: "CREDIT",
    amount: 90000,

    transactionDate:
      "2026-08-15",

    description: "Goods supplied",
    notes: "",
    attachmentName: "INV-405.pdf",

    createdAt: "2026-08-15T13:00:00",
  },

  {
    id: 402,
    companyId: 1,
    partyId: 4,
    type: "DEBIT",
    amount: 18000,

    transactionDate:
      "2026-08-19",

    description: "Payment settlement",
    notes: "",

    createdAt: "2026-08-19T15:20:00",
  },

  {
    id: 501,
    companyId: 1,
    partyId: 5,
    type: "DEBIT",
    amount: 12500,

    transactionDate:
      "2026-08-18",

    description: "Purchase payment",
    notes: "",
    attachmentName: "BILL-501.pdf",

    createdAt: "2026-08-18T17:10:00",
  },
];
