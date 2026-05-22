import {
  formatCurrency,
  normalizePriceTiers,
  resolveTierPrice,
} from "./pricing";

export const CART_STORAGE_KEY = "shoppingCart";
export const CART_UPDATED_EVENT = "shopping-cart-updated";

function normalizePositiveInteger(value, fallback = 0) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsedValue));
}

function clampCartQuantity(quantity, maxQuantity) {
  const normalizedMaxQuantity = normalizePositiveInteger(maxQuantity, 0);
  const normalizedQuantity = normalizePositiveInteger(quantity, 1);

  if (normalizedMaxQuantity > 0) {
    return Math.min(Math.max(1, normalizedQuantity), normalizedMaxQuantity);
  }

  return Math.max(1, normalizedQuantity);
}

function normalizeCartItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const maxQuantity = normalizePositiveInteger(item.maxQuantity, 0);

      return {
        productId: Number(item.productId || 0),
        variantId: Number(item.variantId || 0),
        name: String(item.name || "").trim(),
        image: String(item.image || "").trim(),
        size: String(item.size || "").trim(),
        stockLabel: String(item.stockLabel || "").trim(),
        basePrice: Number((item.basePrice ?? item.price) || 0),
        baseSellPrice: Number(item.baseSellPrice || 0),
        laborCost: Number(item.laborCost || 0),
        stoneCost: Number(item.stoneCost || 0),
        baseWeight: Number(item.baseWeight || 0),
        weightModifier: Number(item.weightModifier || 0),
        shippingWeight: Number(item.shippingWeight || 0),
        priceTiers: normalizePriceTiers(item.priceTiers),
        quantity: clampCartQuantity(item.quantity, maxQuantity),
        maxQuantity,
      };
    })
    .map((item) => {
      const price = resolveTierPrice(item.priceTiers, item.quantity, item.basePrice, {
        baseSellPrice: item.baseSellPrice,
        baseWeight: item.baseWeight,
        weightModifier: item.weightModifier,
        laborCost: item.laborCost,
        stoneCost: item.stoneCost,
      });

      return {
        ...item,
        price,
        formattedPrice: formatCurrency(price),
      };
    })
    .filter(
      (item) =>
        item.productId > 0 &&
        item.variantId > 0 &&
        item.name &&
        (item.maxQuantity === 0 || item.quantity <= item.maxQuantity)
    );
}

function emitCartChange() {
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

export function getCartItems() {
  try {
    const rawValue = localStorage.getItem(CART_STORAGE_KEY);
    return normalizeCartItems(rawValue ? JSON.parse(rawValue) : []);
  } catch (error) {
    console.error("Parse cart items error:", error);
    return [];
  }
}

function saveCartItems(items) {
  const normalizedItems = normalizeCartItems(items);
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizedItems));
  emitCartChange();
  return normalizedItems;
}

export function getCartCount() {
  return new Set(getCartItems().map((item) => Number(item.productId || 0)).filter(Boolean)).size;
}

export function addCartItem(nextItem) {
  const items = getCartItems();
  const existingIndex = items.findIndex((item) => item.variantId === nextItem.variantId);
  const normalizedMaxQuantity = normalizePositiveInteger(nextItem.maxQuantity, 0);
  const requestedQuantity = clampCartQuantity(nextItem.quantity, normalizedMaxQuantity);

  if (existingIndex >= 0) {
    const existingItem = items[existingIndex];
    const nextQuantity =
      normalizedMaxQuantity > 0
        ? Math.min(existingItem.quantity + requestedQuantity, normalizedMaxQuantity)
        : existingItem.quantity + requestedQuantity;

    items[existingIndex] = {
      ...existingItem,
      ...nextItem,
      basePrice: Number((nextItem.basePrice ?? existingItem.basePrice ?? nextItem.price) || 0),
      baseSellPrice: Number((nextItem.baseSellPrice ?? existingItem.baseSellPrice) || 0),
      laborCost: Number((nextItem.laborCost ?? existingItem.laborCost) || 0),
      stoneCost: Number((nextItem.stoneCost ?? existingItem.stoneCost) || 0),
      baseWeight: Number((nextItem.baseWeight ?? existingItem.baseWeight) || 0),
      weightModifier: Number((nextItem.weightModifier ?? existingItem.weightModifier) || 0),
      shippingWeight: Number((nextItem.shippingWeight ?? existingItem.shippingWeight) || 0),
      priceTiers: normalizePriceTiers(nextItem.priceTiers || existingItem.priceTiers),
      maxQuantity: normalizedMaxQuantity,
      stockLabel: String(nextItem.stockLabel || existingItem.stockLabel || "").trim(),
      quantity: clampCartQuantity(nextQuantity, normalizedMaxQuantity),
    };
  } else {
    items.unshift({
      ...nextItem,
      basePrice: Number((nextItem.basePrice ?? nextItem.price) || 0),
      baseSellPrice: Number(nextItem.baseSellPrice || 0),
      laborCost: Number(nextItem.laborCost || 0),
      stoneCost: Number(nextItem.stoneCost || 0),
      baseWeight: Number(nextItem.baseWeight || 0),
      weightModifier: Number(nextItem.weightModifier || 0),
      shippingWeight: Number(nextItem.shippingWeight || 0),
      priceTiers: normalizePriceTiers(nextItem.priceTiers),
      quantity: clampCartQuantity(requestedQuantity, normalizedMaxQuantity),
      maxQuantity: normalizedMaxQuantity,
    });
  }

  const savedItems = saveCartItems(items);
  const savedItem = savedItems.find((item) => item.variantId === nextItem.variantId);

  return {
    items: savedItems,
    item: savedItem || null,
    reachedStockLimit:
      normalizedMaxQuantity > 0 && Number(savedItem?.quantity || 0) >= normalizedMaxQuantity,
  };
}

export function updateCartQuantity(variantId, quantity) {
  const normalizedVariantId = Number(variantId || 0);
  const normalizedQuantity = normalizePositiveInteger(quantity, 0);
  const items = getCartItems();

  const nextItems = items
    .map((item) => {
      if (item.variantId !== normalizedVariantId) {
        return item;
      }

      const clampedQuantity =
        normalizedQuantity <= 0
          ? 0
          : clampCartQuantity(normalizedQuantity, item.maxQuantity);

      return {
        ...item,
        quantity: clampedQuantity,
      };
    })
    .filter((item) => item.quantity > 0);

  return saveCartItems(nextItems);
}

export function removeCartItem(variantId) {
  const normalizedVariantId = Number(variantId || 0);
  const nextItems = getCartItems().filter((item) => item.variantId !== normalizedVariantId);
  return saveCartItems(nextItems);
}

export function clearCart() {
  return saveCartItems([]);
}

export function subscribeCartChange(callback) {
  const handleChange = () => {
    callback(getCartItems());
  };

  const handleStorage = (event) => {
    if (event.key === CART_STORAGE_KEY) {
      handleChange();
    }
  };

  window.addEventListener(CART_UPDATED_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}
