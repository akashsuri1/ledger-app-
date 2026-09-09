import {
  formatCurrency,
  roundCurrency,
} from "./currency";
import { parseReportDate } from "./reportCalculations";

const dateFormatter =
  new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );

const dateTimeFormatter =
  new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  );

export function formatBalanceLabel(
  balance: number,
) {
  const roundedBalance =
    roundCurrency(balance);

  if (roundedBalance === 0) {
    return "Settled";
  }

  return `${formatCurrency(
    Math.abs(roundedBalance),
  )} ${
    roundedBalance > 0
      ? "Receivable"
      : "Payable"
  }`;
}

export function formatReportDate(
  value: string,
) {
  const timestamp =
    parseReportDate(value);

  return timestamp === null
    ? value
    : dateFormatter.format(
        new Date(timestamp),
      );
}

export function formatReportTransactionDate(
  value: string,
) {
  const timestamp =
    parseReportDate(value);

  if (timestamp === null) {
    return value;
  }

  return dateFormatter.format(new Date(timestamp));
}

export function formatReportGeneratedDateTime(
  value: string,
) {
  const timestamp = parseReportDate(value);
  return timestamp === null
    ? value
    : dateTimeFormatter.format(new Date(timestamp));
}

export function formatReportDateRange(
  from?: string,
  to?: string,
) {
  if (from && to) {
    return `${formatReportDate(
      from,
    )} – ${formatReportDate(
      to,
    )}`;
  }

  if (from) {
    return `From ${formatReportDate(
      from,
    )}`;
  }

  if (to) {
    return `Through ${formatReportDate(
      to,
    )}`;
  }

  return "All dates";
}
