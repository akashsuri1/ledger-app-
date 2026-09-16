export const MAX_TRANSACTION_AMOUNT = 1_000_000_000_000;

export function isValidTransactionAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TRANSACTION_AMOUNT;
}
