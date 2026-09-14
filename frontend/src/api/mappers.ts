import type { LedgerTransaction, Party } from "../types";
import type { PartyDto, TransactionDto } from "./types";

export function mapPartyDto(value: PartyDto): Party {
  return {
    id: value.id,
    companyId: value.companyId,
    regionId: value.regionId,
    regionName: value.regionName,
    name: value.name,
    phone: value.phone,
    address: value.address,
    gstin: value.gstin,
    notes: value.notes,
    createdAt: value.createdAt,
    balance: value.balance,
    transactionCount: value.transactionCount,
  };
}

export function mapTransactionDto(value: TransactionDto): LedgerTransaction {
  return {
    id: value.id,
    companyId: value.companyId,
    partyId: value.partyId,
    partyName: value.partyName,
    regionName: value.regionName,
    type: value.type,
    amount: value.amount,
    transactionDate: value.transactionDate,
    description: value.description,
    notes: value.notes,
    createdAt: value.createdAt,
    attachmentName: value.attachment?.originalName,
    attachmentId: value.attachment?.id,
    attachmentMimeType: value.attachment?.mimeType,
    attachmentByteSize: value.attachment?.byteSize,
  };
}
