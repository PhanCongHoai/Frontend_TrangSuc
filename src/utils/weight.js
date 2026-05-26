const CHI_TO_GRAMS = 3.75;

export function convertChiToGrams(value) {
  const normalizedValue = Number(value || 0);

  if (!Number.isFinite(normalizedValue)) {
    return 0;
  }

  return normalizedValue * CHI_TO_GRAMS;
}

export function formatWeightInGrams(value) {
  const grams = convertChiToGrams(value);

  return `${Number(grams.toFixed(2))} gam`;
}
