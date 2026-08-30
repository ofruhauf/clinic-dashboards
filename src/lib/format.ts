export function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  }
  return formatCurrency(value);
}
