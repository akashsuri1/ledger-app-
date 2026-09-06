export function formatCurrency(amount: number) {
  const roundedAmount =
    roundCurrency(amount);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits:
      Number.isInteger(
        roundedAmount,
      )
        ? 0
        : 2,
    maximumFractionDigits: 2,
  }).format(roundedAmount);
}

export function roundCurrency(
  amount: number,
) {
  if (!Number.isFinite(amount)) {
    return amount;
  }

  return (
    Math.round(
      (
        amount +
        Math.sign(amount) *
          Number.EPSILON
      ) * 100,
    ) / 100
  );
}
