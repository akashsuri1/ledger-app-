export function parseTransactionDate(
  value: string,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}

export function formatTransactionDate(
  value: string,
) {
  const date = parseTransactionDate(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",

    },
  ).format(date);
}

export function compareTransactionsNewestFirst(
  left: { id: number; transactionDate: string },
  right: { id: number; transactionDate: string },
) {
  return (
    right.transactionDate.localeCompare(left.transactionDate) ||
    right.id - left.id
  );
}
