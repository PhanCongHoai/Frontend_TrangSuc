import { buildApiUrl } from "./api";

export const COMPARE_STORAGE_KEY = "productCompareItems";
export const COMPARE_UPDATED_EVENT = "product-compare-updated";
export const COMPARE_CONFIG_STORAGE_KEY = "productCompareConfig";

const DEFAULT_COMPARE_CONFIG = Object.freeze({
  maxItems: 2,
  requiredItems: 2,
  mode: "exact",
});

const API_BASE_URL = buildApiUrl("/api/products");

const normalizeProductId = (value) => {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) ? Math.max(0, Math.floor(normalized)) : 0;
};

const normalizeCompareItem = (item) => ({
  productId: normalizeProductId(item?.productId),
  name: String(item?.name || "").trim(),
  image: String(item?.image || "").trim(),
  price: String(item?.price || "").trim(),
  material: String(item?.material || "").trim(),
  category: String(item?.category || "").trim(),
});

const normalizeCompareConfig = (config) => {
  const maxItems = Math.max(
    2,
    Math.floor(Number(config?.maxItems || DEFAULT_COMPARE_CONFIG.maxItems))
  );

  return {
    maxItems,
    requiredItems: Math.max(2, Math.floor(Number(config?.requiredItems || maxItems))),
    mode: String(config?.mode || DEFAULT_COMPARE_CONFIG.mode),
  };
};

const emitCompareChange = () => {
  window.dispatchEvent(new CustomEvent(COMPARE_UPDATED_EVENT));
};

const saveCompareItems = (items) => {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map(normalizeCompareItem)
    .filter((item) => item.productId > 0 && item.name);

  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalizedItems));
  emitCompareChange();
  return normalizedItems;
};

export const getCompareItems = () => {
  try {
    const rawValue = localStorage.getItem(COMPARE_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    return (Array.isArray(parsedValue) ? parsedValue : [])
      .map(normalizeCompareItem)
      .filter((item) => item.productId > 0 && item.name);
  } catch (error) {
    console.error("Parse compare items error:", error);
    return [];
  }
};

export const getCompareCount = () => getCompareItems().length;

export const getCompareConfig = () => {
  try {
    const rawValue = localStorage.getItem(COMPARE_CONFIG_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : null;
    return normalizeCompareConfig(parsedValue || DEFAULT_COMPARE_CONFIG);
  } catch (error) {
    console.error("Parse compare config error:", error);
    return { ...DEFAULT_COMPARE_CONFIG };
  }
};

export const fetchCompareConfig = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/compare/config`);
    const data = await response.json();

    if (!response.ok || !data?.success || !data.config) {
      throw new Error(data?.message || "Cannot load compare config.");
    }

    const normalizedConfig = normalizeCompareConfig(data.config);
    localStorage.setItem(COMPARE_CONFIG_STORAGE_KEY, JSON.stringify(normalizedConfig));
    return normalizedConfig;
  } catch (error) {
    const fallbackConfig = getCompareConfig();
    localStorage.setItem(COMPARE_CONFIG_STORAGE_KEY, JSON.stringify(fallbackConfig));
    return fallbackConfig;
  }
};

export const addCompareItem = (nextItem, maxItems = getCompareConfig().maxItems) => {
  const normalizedItem = normalizeCompareItem(nextItem);

  if (!normalizedItem.productId || !normalizedItem.name) {
    return {
      status: "invalid",
      items: getCompareItems(),
    };
  }

  const items = getCompareItems();
  const existingIndex = items.findIndex(
    (item) => item.productId === normalizedItem.productId
  );

  if (existingIndex >= 0) {
    return {
      status: "exists",
      items,
    };
  }

  if (items.length >= maxItems) {
    return {
      status: "requires_replace",
      items,
      candidate: normalizedItem,
    };
  }

  const nextItems = saveCompareItems([...items, normalizedItem]);

  return {
    status: "added",
    items: nextItems,
    candidate: normalizedItem,
  };
};

export const replaceCompareItemAt = (
  index,
  nextItem,
  maxItems = getCompareConfig().maxItems
) => {
  const normalizedItem = normalizeCompareItem(nextItem);
  const normalizedIndex = Number(index);

  if (!normalizedItem.productId || !normalizedItem.name || !Number.isInteger(normalizedIndex)) {
    return {
      status: "invalid",
      items: getCompareItems(),
    };
  }

  const items = getCompareItems();

  if (normalizedIndex < 0 || normalizedIndex >= items.length) {
    return {
      status: "invalid",
      items,
    };
  }

  const duplicateIndex = items.findIndex(
    (item) => item.productId === normalizedItem.productId
  );

  if (duplicateIndex >= 0 && duplicateIndex !== normalizedIndex) {
    return {
      status: "exists",
      items,
    };
  }

  const nextItems = [...items];
  nextItems[normalizedIndex] = normalizedItem;

  return {
    status: "replaced",
    items: saveCompareItems(nextItems.slice(0, maxItems)),
    candidate: normalizedItem,
  };
};

export const removeCompareItem = (productId) => {
  const normalizedProductId = normalizeProductId(productId);
  const nextItems = getCompareItems().filter((item) => item.productId !== normalizedProductId);
  return saveCompareItems(nextItems);
};

export const clearCompareItems = () => saveCompareItems([]);

export const subscribeCompareChange = (callback) => {
  const handleChange = () => {
    callback(getCompareItems());
  };

  const handleStorage = (event) => {
    if (event.key === COMPARE_STORAGE_KEY) {
      handleChange();
    }
  };

  window.addEventListener(COMPARE_UPDATED_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(COMPARE_UPDATED_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
};
