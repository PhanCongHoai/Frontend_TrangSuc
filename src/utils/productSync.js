const PRODUCT_VISIBILITY_EVENT = "product-visibility-change";
const BLOCKED_PRODUCTS_KEY = "blockedProductIds";
const PRODUCT_CATALOG_SYNC_KEY = "productCatalogSync";

function readBlockedProductIds() {
  try {
    const rawValue = localStorage.getItem(BLOCKED_PRODUCTS_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (error) {
    console.error("Read blocked product ids error:", error);
    return [];
  }
}

function writeBlockedProductIds(productIds) {
  localStorage.setItem(BLOCKED_PRODUCTS_KEY, JSON.stringify(productIds));
}

function dispatchProductSync(detail) {
  window.dispatchEvent(
    new CustomEvent(PRODUCT_VISIBILITY_EVENT, {
      detail,
    })
  );
}

export function getBlockedProductIds() {
  return readBlockedProductIds();
}

export function isProductBlocked(productId) {
  return readBlockedProductIds().includes(Number(productId));
}

export function markProductBlocked(productId, reason = "hidden") {
  const normalizedId = Number(productId);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    return;
  }

  const nextIds = Array.from(new Set([...readBlockedProductIds(), normalizedId]));
  writeBlockedProductIds(nextIds);

  dispatchProductSync({
    productId: normalizedId,
    reason,
    blockedIds: nextIds,
  });
}

export function unmarkProductBlocked(productId, reason = "shown") {
  const normalizedId = Number(productId);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    return;
  }

  const nextIds = readBlockedProductIds().filter((value) => value !== normalizedId);
  writeBlockedProductIds(nextIds);

  dispatchProductSync({
    productId: normalizedId,
    reason,
    blockedIds: nextIds,
  });
}

export function notifyProductCatalogChanged(reason = "updated", productId = null) {
  const detail = {
    productId: productId ? Number(productId) : null,
    reason,
    blockedIds: readBlockedProductIds(),
    changedAt: Date.now(),
  };

  localStorage.setItem(PRODUCT_CATALOG_SYNC_KEY, JSON.stringify(detail));
  dispatchProductSync(detail);
}

export function subscribeProductVisibilityChange(callback) {
  const handleCustomEvent = (event) => {
    callback(event.detail);
  };

  const handleStorageEvent = (event) => {
    if (event.key === PRODUCT_CATALOG_SYNC_KEY) {
      try {
        callback(
          event.newValue
            ? JSON.parse(event.newValue)
            : {
                productId: null,
                reason: "sync",
                blockedIds: readBlockedProductIds(),
              }
        );
      } catch (error) {
        callback({
          productId: null,
          reason: "sync",
          blockedIds: readBlockedProductIds(),
        });
      }
      return;
    }

    if (event.key !== BLOCKED_PRODUCTS_KEY) {
      return;
    }

    callback({
      productId: null,
      reason: "sync",
      blockedIds: readBlockedProductIds(),
    });
  };

  window.addEventListener(PRODUCT_VISIBILITY_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(PRODUCT_VISIBILITY_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
