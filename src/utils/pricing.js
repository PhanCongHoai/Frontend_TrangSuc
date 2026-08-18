export function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function normalizePriceTiers(priceTiers) {
  if (!Array.isArray(priceTiers)) {
    return [];
  }

  return priceTiers
    .map((tier) => {
      const minQuantity = Math.max(
        1,
        Math.floor(Number(tier?.minQuantity ?? tier?.min_quantity ?? 0))
      );
      const rawMaxQuantity = tier?.maxQuantity ?? tier?.max_quantity;
      const maxQuantity =
        rawMaxQuantity === null || rawMaxQuantity === undefined || rawMaxQuantity === ""
          ? null
          : Math.max(1, Math.floor(Number(rawMaxQuantity)));
      const markupRate = Math.max(0, Number(tier?.markupRate ?? tier?.markup_rate ?? 0));
      const price = Math.max(0, Number(tier?.price ?? tier?.tier_price ?? 0));

      return {
        id: tier?.id || `${minQuantity}-${maxQuantity ?? "plus"}`,
        minQuantity,
        maxQuantity,
        markupRate,
        price,
      };
    })
    .filter(
      (tier) =>
        tier.minQuantity > 0 &&
        tier.price > 0 &&
        (tier.maxQuantity === null || tier.maxQuantity >= tier.minQuantity)
    )
    .sort((left, right) => left.minQuantity - right.minQuantity);
}

export function computeSalePrice({
  baseSellPrice,
  baseWeight,
  weightModifier = 0,
  laborCost,
  stoneCost,
  markupRate,
}) {
  const materialWeight = Math.max(
    0,
    Number(baseWeight || 0) + Number(weightModifier || 0)
  );
  const materialCost = Number(baseSellPrice || 0) * materialWeight;
  const subtotal = materialCost + Number(laborCost || 0) + Number(stoneCost || 0);

  return Math.round(subtotal * (1 + Number(markupRate || 0)));
}

function resolveContextualTierPrice(tier, pricingContext) {
  if (!pricingContext || !tier) {
    return null;
  }

  const baseSellPrice = Number(pricingContext.baseSellPrice || 0);

  if (baseSellPrice <= 0) {
    return null;
  }

  return computeSalePrice({
    ...pricingContext,
    markupRate: tier.markupRate,
  });
}

export function applyPricingContextToTiers(priceTiers, pricingContext = null) {
  return normalizePriceTiers(priceTiers).map((tier) => ({
    ...tier,
    price: resolveContextualTierPrice(tier, pricingContext) ?? tier.price,
  }));
}

export function resolveTierPrice(
  priceTiers,
  quantity,
  fallbackPrice = 0,
  pricingContext = null
) {
  const normalizedQuantity = Math.max(1, Math.floor(Number(quantity || 1)));
  const tiers = applyPricingContextToTiers(priceTiers, pricingContext);

  if (!tiers || tiers.length === 0) {
    return Number(fallbackPrice || 0);
  }

  // 1. Tìm bậc giá khớp chính xác trong khoảng [minQuantity, maxQuantity]
  let matchedTier = tiers.find(
    (tier) =>
      normalizedQuantity >= tier.minQuantity &&
      (tier.maxQuantity === null || normalizedQuantity <= tier.maxQuantity)
  );

  // 2. Nếu số lượng mua vượt quá ngưỡng tối đa của tất cả các bậc (vd: 150 > 100),
  // tự động áp dụng bậc giá cao nhất (bậc có minQuantity lớn nhất / chiết khấu tốt nhất)
  if (!matchedTier && tiers.length > 0) {
    const highestTier = tiers[tiers.length - 1];
    if (normalizedQuantity >= highestTier.minQuantity) {
      matchedTier = highestTier;
    }
  }

  return Number(matchedTier?.price ?? fallbackPrice ?? 0);
}

export function formatTierRange(minQuantity, maxQuantity) {
  if (maxQuantity === null || maxQuantity === undefined) {
    return `Từ ${minQuantity} sp`;
  }

  if (Number(minQuantity) === Number(maxQuantity)) {
    return `${minQuantity} sp`;
  }

  return `${minQuantity} - ${maxQuantity} sp`;
}
