import type { StatementTransactionLimit } from "../types/reports";

export const PRESET_TRANSACTION_LIMITS = [10, 25, 50, 100] as const;
export const MAX_CUSTOM_TRANSACTION_LIMIT = 10_000;

export function parseTransactionLimit(
  value: string | null,
): StatementTransactionLimit | undefined {
  if (value === null) return undefined;

  const normalized = value.trim().toUpperCase();
  if (normalized === "ALL") return "ALL";
  if (!/^\d+$/.test(normalized)) return undefined;

  const limit = Number(normalized);
  return Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_CUSTOM_TRANSACTION_LIMIT
    ? limit
    : undefined;
}

export function isPresetTransactionLimit(limit: StatementTransactionLimit) {
  return limit === "ALL" || PRESET_TRANSACTION_LIMITS.some((preset) => preset === limit);
}
