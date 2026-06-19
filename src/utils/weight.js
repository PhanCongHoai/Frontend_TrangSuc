export function formatWeightInGrams(value) {
  const normalizedValue = Number(value || 0);

  if (!Number.isFinite(normalizedValue)) {
    return "0 gam";
  }

  return `${Number(normalizedValue.toFixed(2))} gam`;
}
