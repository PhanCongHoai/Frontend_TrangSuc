import { useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl, buildAssetUrl, normalizeApiMessage } from "../../../utils/api";
import ConfirmModal from "../components/ConfirmModal";
import {
  markProductBlocked,
  notifyProductCatalogChanged,
  subscribeProductVisibilityChange,
  unmarkProductBlocked,
} from "../../../utils/productSync";

const ADMIN_PAGE_SIZE = 10;
const initialForm = { categoryId: "", name: "", description: "", materialType: "", baseWeight: "", status: "ACTIVE", variants: [], mainImageUrl: "", laborCost: "", stoneCost: "", markupRate: "", priceTiers: [] };

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
}

function computeEstimatedPrice({ baseSellPrice, baseWeight, laborCost, stoneCost, markupRate }) {
  const materialCost = Number(baseSellPrice || 0) * Number(baseWeight || 0);
  const subtotal = materialCost + Number(laborCost || 0) + Number(stoneCost || 0);
  return Math.round(subtotal * (1 + Number(markupRate || 0)));
}

function createEmptyPriceTier() {
  return { minQuantity: "", maxQuantity: "", markupRate: "" };
}

function createEmptyVariant() {
  return {
    id: null,
    sku: "",
    size: "",
    weightModifier: "",
    stockQuantity: "",
    warehouseLocation: "",
  };
}

function sanitizeIntegerInput(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function sanitizeDecimalInput(value) {
  const digitsAndDots = String(value || "").replace(/[^\d.]/g, "");

  if (!digitsAndDots) {
    return "";
  }

  const [integerPart, ...fractionParts] = digitsAndDots.split(".");
  const normalizedIntegerPart = integerPart || "0";
  const normalizedFractionPart = fractionParts.join("");

  return fractionParts.length
    ? `${normalizedIntegerPart}.${normalizedFractionPart}`
    : normalizedIntegerPart;
}

function normalizeFormVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((variant) => ({
      id: variant.id || null,
      sku: String(variant.sku || "").trim(),
      size: String(variant.size || "").trim(),
      weight_modifier: Number(variant.weightModifier || 0),
      stock_quantity: Number(variant.stockQuantity || 0),
      warehouse_location: String(variant.warehouseLocation || "").trim(),
    }))
    .filter(
      (variant) =>
        variant.sku ||
        variant.size ||
        variant.weight_modifier > 0 ||
        variant.stock_quantity > 0 ||
        variant.warehouse_location
    );
}

function normalizeFormPriceTiers(priceTiers) {
  if (!Array.isArray(priceTiers)) return [];
  return priceTiers
    .map((tier) => ({
      min_quantity: Number(tier.minQuantity || 0),
      max_quantity: tier.maxQuantity === "" ? null : Number(tier.maxQuantity || 0),
      markup_rate: Number(tier.markupRate || 0),
    }))
    .filter(
      (tier) =>
        tier.min_quantity > 0 &&
        tier.markup_rate >= 0 &&
        (tier.max_quantity === null || tier.max_quantity >= tier.min_quantity)
    );
}

function validatePriceTiers(priceTiers) {
  if (!Array.isArray(priceTiers) || priceTiers.length === 0) {
    return null;
  }

  const normalized = [];

  for (let i = 0; i < priceTiers.length; i++) {
    const tier = priceTiers[i];

    const rawMin = tier.minQuantity;
    const rawMax = tier.maxQuantity;
    const rawRate = tier.markupRate;

    const minQty = rawMin === "" || rawMin === null || rawMin === undefined ? NaN : Number(rawMin);
    const maxQty = rawMax === "" || rawMax === null || rawMax === undefined ? null : Number(rawMax);
    const markupRate = rawRate === "" || rawRate === null || rawRate === undefined ? NaN : Number(rawRate);

    if (Number.isNaN(minQty) || minQty < 1 || !Number.isInteger(minQty)) {
      return `Bậc số lượng thứ ${i + 1}: Số lượng bắt đầu ("Từ SL") phải là số nguyên lớn hơn hoặc bằng 1.`;
    }
    if (Number.isNaN(markupRate) || markupRate < 0) {
      return `Bậc số lượng thứ ${i + 1}: Tỷ lệ markup phải là số lớn hơn hoặc bằng 0.`;
    }
    if (maxQty !== null) {
      if (Number.isNaN(maxQty) || maxQty < 1 || !Number.isInteger(maxQty)) {
        return `Bậc số lượng thứ ${i + 1}: Số lượng kết thúc ("Đến SL") phải là số nguyên lớn hơn hoặc bằng 1.`;
      }
      if (maxQty < minQty) {
        return `Bậc số lượng thứ ${i + 1}: Số lượng kết thúc ("Đến SL": ${maxQty}) không được nhỏ hơn số lượng bắt đầu ("Từ SL": ${minQty}).`;
      }
    }

    normalized.push({
      min: minQty,
      max: maxQty,
      originalIndex: i
    });
  }

  // Sắp xếp các bậc theo số lượng bắt đầu (min)
  normalized.sort((a, b) => a.min - b.min);

  for (let i = 0; i < normalized.length - 1; i++) {
    const current = normalized[i];
    const next = normalized[i + 1];

    if (current.max === null) {
      return `Bậc số lượng từ ${current.min} đến vô cùng phải là bậc cuối cùng. Không thể có thêm bậc khác sau nó.`;
    }
    if (next.min <= current.max) {
      return `Các bậc số lượng bị chồng chéo nhau: Bậc từ ${current.min} đến ${current.max} chồng chéo với bậc từ ${next.min} đến ${next.max !== null ? next.max : "vô cùng"}.`;
    }
  }

  return null;
}



function getMainImage(product) {
  const selectedImage =
    product.images.find((image) => image.is_main) || product.images[0] || null;

  return selectedImage
    ? {
        ...selectedImage,
        url: buildAssetUrl(selectedImage.url),
      }
    : null;
}

function getPrimaryVariant(product) {
  return product.variants[0] || { sku: "Chưa có SKU", size: "Free size", weight_modifier: 0, stock: { quantity: 0, warehouse_location: "Chưa cập nhật" } };
}

function normalizeStatusLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ACTIVE") return "Đang bán";
  if (normalized === "HIDDEN") return "Ẩn";
  if (normalized === "DRAFT") return "Ẩn";
  return value || "Chưa cập nhật";
}

function buildFormFromProduct(product) {
  const variant = getPrimaryVariant(product);
  const mainImage = getMainImage(product);
  const variants = (product.variants || []).map((item) => ({
    id: item.id || null,
    sku: item.sku || "",
    size: item.size === "Free size" ? "" : item.size || "",
    weightModifier: String(item.weight_modifier || ""),
    stockQuantity: String(item.stock?.quantity || ""),
    warehouseLocation:
      item.stock?.warehouse_location === "Chưa cập nhật"
        ? ""
        : item.stock?.warehouse_location || "",
  }));

  return {
    categoryId: product.category_id ? String(product.category_id) : "",
    name: product.name || "",
    description: product.description || "",
    materialType: product.material_type || "",
    baseWeight: String(product.base_weight || ""),
    status: String(product.status || "ACTIVE").toUpperCase(),
    variants: variants.length
      ? variants
      : [{
          id: variant.id || null,
          sku: variant.sku || "",
          size: variant.size === "Free size" ? "" : variant.size || "",
          weightModifier: String(variant.weight_modifier || ""),
          stockQuantity: String(variant.stock?.quantity || ""),
          warehouseLocation:
            variant.stock?.warehouse_location === "Chưa cập nhật"
              ? ""
              : variant.stock?.warehouse_location || "",
        }],
    mainImageUrl: buildAssetUrl(mainImage?.url || ""),
    laborCost: String(product.pricing?.labor_cost || ""),
    stoneCost: String(product.pricing?.stone_cost || ""),
    markupRate: String(product.pricing?.markup_rate || ""),
    priceTiers: (product.price_tiers || product.pricing?.priceTiers || []).map((tier) => ({
      minQuantity: String(tier.minQuantity || tier.min_quantity || ""),
      maxQuantity:
        tier.maxQuantity === null || tier.max_quantity === null
          ? ""
          : String(tier.maxQuantity || tier.max_quantity || ""),
      markupRate: String(tier.markupRate ?? tier.markup_rate ?? ""),
    })),
  };
}

function ProductsPage() {
  const [productList, setProductList] = useState([]);
  const [categoryRecords, setCategoryRecords] = useState([]);
  const [materialOptions, setMaterialOptions] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productModalMode, setProductModalMode] = useState("create");
  const [form, setForm] = useState({ ...initialForm, variants: [createEmptyVariant()] });
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingProductId, setProcessingProductId] = useState(null);
  const [isDeletingAllProducts, setIsDeletingAllProducts] = useState(false);
  const [isHidingAllProducts, setIsHidingAllProducts] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
  });

  const loadPageData = async () => {
    try {
      setStatus("loading");
      setError("");
      const [categoriesResponse, productsResponse, materialsResponse] = await Promise.all([
        fetch(buildApiUrl("/api/categories?all=true"), { headers: getAuthHeaders() }),
        fetch(buildApiUrl("/api/products/admin/list"), { headers: getAuthHeaders() }),
        fetch(buildApiUrl("/api/gold-rates/materials"), { headers: getAuthHeaders() }),
      ]);
      const categoriesData = await categoriesResponse.json();
      const productsData = await productsResponse.json();
      const materialsData = await materialsResponse.json();
      if (!categoriesResponse.ok || !categoriesData.success) throw new Error(normalizeApiMessage(categoriesData.message, "Không thể tải danh mục."));
      if (!productsResponse.ok || !productsData.success) throw new Error(normalizeApiMessage(productsData.message, "Không thể tải sản phẩm."));
      if (!materialsResponse.ok || !materialsData.success) throw new Error(normalizeApiMessage(materialsData.message, "Không thể tải chất liệu."));
      setCategoryRecords(Array.isArray(categoriesData.categories) ? categoriesData.categories : []);
      setProductList(Array.isArray(productsData.products) ? productsData.products : []);
      setMaterialOptions(Array.isArray(materialsData.materials) ? materialsData.materials : []);
      setStatus("connected");
    } catch (fetchError) {
      console.error("Fetch admin products page error:", fetchError);
      setCategoryRecords([]);
      setProductList([]);
      setMaterialOptions([]);
      setStatus("error");
      setError(normalizeApiMessage(fetchError.message, "Không thể tải dữ liệu sản phẩm."));
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    return subscribeProductVisibilityChange(() => {
      loadPageData();
    });
  }, []);

  useEffect(() => {
    if (!form.materialType && materialOptions.length) {
      setForm((prev) => ({ ...prev, materialType: materialOptions[0].material_type }));
    }
  }, [materialOptions, form.materialType]);

  const selectedMaterialOption = useMemo(() => materialOptions.find((material) => material.material_type === form.materialType) || null, [materialOptions, form.materialType]);
  const estimatedSalePrice = useMemo(() => computeEstimatedPrice({ baseSellPrice: selectedMaterialOption?.base_sell_price, baseWeight: form.baseWeight, laborCost: form.laborCost, stoneCost: form.stoneCost, markupRate: form.markupRate }), [form.baseWeight, form.laborCost, form.markupRate, form.stoneCost, selectedMaterialOption]);

  const categoryTree = useMemo(() => {
    const parentCategories = categoryRecords.filter((category) => category.parent_id === null);
    const childCategories = categoryRecords.filter((category) => category.parent_id !== null);
    return parentCategories.map((parent) => ({ ...parent, children: childCategories.filter((child) => child.parent_id === parent.id) }));
  }, [categoryRecords]);

  const selectableCategoryOptions = useMemo(() => categoryTree.flatMap((parent) => (parent.children.length ? parent.children.map((child) => ({ id: String(child.id), name: `${parent.name} / ${child.name}` })) : [{ id: String(parent.id), name: parent.name }])), [categoryTree]);

  useEffect(() => {
    if (!selectableCategoryOptions.length) return;
    const hasValidCategory = selectableCategoryOptions.some((category) => category.id === String(form.categoryId));
    if (!form.categoryId || !hasValidCategory) setForm((prev) => ({ ...prev, categoryId: selectableCategoryOptions[0].id }));
  }, [form.categoryId, selectableCategoryOptions]);

  const selectedCategoryIds = useMemo(() => {
    if (activeCategory === "all") return null;
    const selectedId = Number(activeCategory);
    const selectedCategory = categoryRecords.find((category) => category.id === selectedId);
    if (!selectedCategory) return new Set([selectedId]);
    if (selectedCategory.parent_id === null) {
      const childIds = categoryRecords.filter((category) => category.parent_id === selectedCategory.id).map((category) => category.id);
      return new Set([selectedCategory.id, ...childIds]);
    }
    return new Set([selectedCategory.id]);
  }, [activeCategory, categoryRecords]);

  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === "all") return "Tất cả";
    const selectedCategory = categoryRecords.find((category) => String(category.id) === String(activeCategory));
    return selectedCategory?.name || "Danh mục";
  }, [activeCategory, categoryRecords]);

  const filteredProducts = useMemo(() => productList.filter((product) => {
    const matchCategory = !selectedCategoryIds || selectedCategoryIds.has(Number(product.category_id));
    const keyword = searchKeyword.trim().toLowerCase();
    const matchKeyword =
      !keyword ||
      String(product.name || "").toLowerCase().includes(keyword) ||
      (product.variants || []).some((variant) =>
        String(variant.sku || "").toLowerCase().includes(keyword)
      );
    const prodStatus = String(product.status || "").toUpperCase();
    const matchStatus =
      activeStatusFilter === "all" ||
      (activeStatusFilter === "active" && prodStatus === "ACTIVE") ||
      (activeStatusFilter === "hidden" && (prodStatus === "HIDDEN" || prodStatus === "DRAFT"));
    return matchCategory && matchKeyword && matchStatus;
  }), [productList, searchKeyword, selectedCategoryIds, activeStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ADMIN_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchKeyword, activeStatusFilter, productList.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const visibleProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ADMIN_PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  const summary = useMemo(() => {
    const totalStock = productList.reduce(
      (sum, product) =>
        sum +
        (product.variants || []).reduce(
          (variantSum, variant) => variantSum + Number(variant.stock?.quantity || 0),
          0
        ),
      0
    );
    const activeCount = productList.filter((product) => String(product.status || "").toUpperCase() === "ACTIVE").length;
    const hiddenCount = productList.filter((product) => {
      const normalizedStatus = String(product.status || "").toUpperCase();
      return normalizedStatus === "HIDDEN" || normalizedStatus === "DRAFT";
    }).length;
    return { totalProducts: productList.length, totalStock, activeCount, hiddenCount };
  }, [productList]);

  const getCategoryName = (categoryId) => categoryRecords.find((category) => category.id === categoryId)?.name || "Chưa phân loại";
  const handleChange = (field, value) => {
    const integerFields = new Set(["laborCost", "stoneCost"]);
    const decimalFields = new Set(["baseWeight", "markupRate"]);
    let nextValue = value;

    if (integerFields.has(field)) {
      nextValue = sanitizeIntegerInput(value);
    } else if (decimalFields.has(field)) {
      nextValue = sanitizeDecimalInput(value);
    }

    setForm((prev) => ({ ...prev, [field]: nextValue }));
  };
  const handleVariantChange = (index, field, value) => {
    const integerFields = new Set(["stockQuantity"]);
    const decimalFields = new Set(["weightModifier"]);
    let nextValue = value;

    if (integerFields.has(field)) {
      nextValue = sanitizeIntegerInput(value);
    } else if (decimalFields.has(field)) {
      nextValue = sanitizeDecimalInput(value);
    }

    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: nextValue } : variant
      ),
    }));
  };
  const addVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, createEmptyVariant()],
    }));
  };
  const removeVariant = (index) => {
    setForm((prev) => ({
      ...prev,
      variants:
        prev.variants.length > 1
          ? prev.variants.filter((_, variantIndex) => variantIndex !== index)
          : [createEmptyVariant()],
    }));
  };
  const handlePriceTierChange = (index, field, value) => {
    const integerFields = new Set(["minQuantity", "maxQuantity"]);
    const decimalFields = new Set(["markupRate"]);
    let nextValue = value;

    if (integerFields.has(field)) {
      nextValue = sanitizeIntegerInput(value);
    } else if (decimalFields.has(field)) {
      nextValue = sanitizeDecimalInput(value);
    }

    setForm((prev) => ({
      ...prev,
      priceTiers: prev.priceTiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: nextValue } : tier
      ),
    }));
  };
  const addPriceTier = () => {
    setForm((prev) => ({
      ...prev,
      priceTiers: [...prev.priceTiers, createEmptyPriceTier()],
    }));
  };
  const removePriceTier = (index) => {
    setForm((prev) => ({
      ...prev,
      priceTiers: prev.priceTiers.filter((_, tierIndex) => tierIndex !== index),
    }));
  };



  const resetForm = (clearMessage = true) => {
    setForm({
      ...initialForm,
      variants: [createEmptyVariant()],
      categoryId: selectableCategoryOptions[0]?.id || "",
      materialType: materialOptions[0]?.material_type || "",
    });
    if (clearMessage) {
      setSubmitMessage("");
      setSubmitError("");
    }
  };

  const openCreateModal = () => {
    setEditingProductId(null);
    setProductModalMode("create");
    resetForm();
    setSubmitMessage("");
    setSubmitError("");
    setIsCreateModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProductId(product.id);
    setProductModalMode("edit");
    setForm(buildFormFromProduct(product));
    setSubmitMessage("");
    setSubmitError("");
    setIsCreateModalOpen(true);
  };

  const openViewModal = (product) => {
    setEditingProductId(product.id);
    setProductModalMode("view");
    setForm(buildFormFromProduct(product));
    setSubmitMessage("");
    setSubmitError("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setEditingProductId(null);
    setProductModalMode("create");
    setIsCreateModalOpen(false);
  };

  const handleHideProduct = async (productId) => {
    try {
      setProcessingProductId(productId);
      setError("");
      const response = await fetch(buildApiUrl(`/api/products/admin/${productId}/hide`), { method: "PATCH", headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(normalizeApiMessage(data.message, "Không thể ẩn sản phẩm."));
      setProductList((prev) => prev.map((product) => product.id === productId ? { ...product, status: "HIDDEN", status_label: normalizeStatusLabel("HIDDEN") } : product));
      markProductBlocked(productId, "hidden");
      notifyProductCatalogChanged("hidden", productId);
    } catch (hideError) {
      console.error("Hide product error:", hideError);
      setError(normalizeApiMessage(hideError.message, "Không thể ẩn sản phẩm."));
    } finally {
      setProcessingProductId(null);
    }
  };

  const handleShowProduct = async (productId) => {
    try {
      setProcessingProductId(productId);
      setError("");
      const response = await fetch(buildApiUrl(`/api/products/admin/${productId}/show`), { method: "PATCH", headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(normalizeApiMessage(data.message, "Không thể hiện sản phẩm."));
      setProductList((prev) => prev.map((product) => product.id === productId ? { ...product, status: "ACTIVE", status_label: normalizeStatusLabel("ACTIVE") } : product));
      unmarkProductBlocked(productId, "shown");
      notifyProductCatalogChanged("shown", productId);
    } catch (showError) {
      console.error("Show product error:", showError);
      setError(normalizeApiMessage(showError.message, "Không thể hiện sản phẩm."));
    } finally {
      setProcessingProductId(null);
    }
  };

  const handleDeleteProduct = (productId) => {
    const targetProduct = productList.find((product) => product.id === productId);
    const productName = targetProduct?.name || `#${productId}`;
    setConfirmModal({
      isOpen: true,
      message: `Bạn có chắc muốn xóa sản phẩm ${productName}?`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          setProcessingProductId(productId);
          setError("");
          const response = await fetch(buildApiUrl(`/api/products/admin/${productId}`), { method: "DELETE", headers: getAuthHeaders() });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(normalizeApiMessage(data.message, "Không thể xóa sản phẩm."));
          setProductList((prev) => prev.filter((product) => product.id !== productId));
          unmarkProductBlocked(productId, "deleted");
          notifyProductCatalogChanged("deleted", productId);
        } catch (deleteError) {
          console.error("Delete product error:", deleteError);
          setError(normalizeApiMessage(deleteError.message, "Không thể xóa sản phẩm."));
        } finally {
          setProcessingProductId(null);
        }
      }
    });
  };

  const handleHideAllProducts = () => {
    if (!productList.length) {
      setError("Không có sản phẩm để ẩn.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      message: "Bạn có chắc muốn ẩn TẤT CẢ sản phẩm? Sản phẩm sẽ không hiện ở trang khách hàng nhưng vẫn còn trong admin.",
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          setIsHidingAllProducts(true);
          setError("");
          setSubmitMessage("");
          setSubmitError("");
          const response = await fetch(buildApiUrl("/api/products/admin/all/hide"), {
            method: "PATCH",
            headers: getAuthHeaders(),
          });
          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(normalizeApiMessage(data.message, "Không thể ẩn tất cả sản phẩm."));
          }

          const productIds = productList.map((product) => Number(product.id)).filter(Boolean);
          productIds.forEach((productId) => markProductBlocked(productId, "bulk-hidden"));
          notifyProductCatalogChanged("bulk-hidden", null);

          setProductList((prev) =>
            prev.map((product) => ({
              ...product,
              status: "HIDDEN",
              status_label: normalizeStatusLabel("HIDDEN"),
            }))
          );
          setSubmitMessage(`Đã ẩn tất cả sản phẩm (${Number(data.totalProducts || productIds.length)}).`);
          setSubmitError("");
        } catch (hideError) {
          console.error("Hide all products error:", hideError);
          setSubmitMessage("");
          setError(normalizeApiMessage(hideError.message, "Không thể ẩn tất cả sản phẩm."));
        } finally {
          setIsHidingAllProducts(false);
        }
      }
    });
  };

  const handleDeleteAllProducts = () => {
    if (!productList.length) {
      setError("Không có sản phẩm để xóa.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      message: "Bạn có chắc muốn xóa TẤT CẢ sản phẩm? Hành động này không thể hoàn tác.",
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          setIsDeletingAllProducts(true);
          setError("");
          setSubmitMessage("");
          setSubmitError("");
          const response = await fetch(buildApiUrl("/api/products/admin/all"), {
            method: "DELETE",
            headers: getAuthHeaders(),
          });
          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(normalizeApiMessage(data.message, "Không thể xóa tất cả sản phẩm."));
          }

          const deletedIds = productList.map((product) => Number(product.id)).filter(Boolean);
          deletedIds.forEach((productId) => unmarkProductBlocked(productId, "bulk-deleted"));
          notifyProductCatalogChanged("bulk-deleted", null);

          setProductList([]);
          setSubmitMessage(`Đã xóa tất cả sản phẩm (${Number(data.deletedProducts || 0)}).`);
          setSubmitError("");
        } catch (deleteError) {
          console.error("Delete all products error:", deleteError);
          setSubmitMessage("");
          setError(normalizeApiMessage(deleteError.message, "Không thể xóa tất cả sản phẩm."));
        } finally {
          setIsDeletingAllProducts(false);
        }
      }
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (productModalMode === "view") return;
    const normalizedVariants = normalizeFormVariants(form.variants);
    if (
      !form.name.trim() ||
      !form.materialType.trim() ||
      !normalizedVariants.length ||
      normalizedVariants.some((variant) => !variant.sku)
    ) {
      setSubmitMessage("");
      setSubmitError("Vui lòng nhập đầy đủ tên sản phẩm, chất liệu và ít nhất một biến thể có SKU.");
      return;
    }
    const tierValidationError = validatePriceTiers(form.priceTiers);
    if (tierValidationError) {
      setSubmitMessage("");
      setSubmitError(tierValidationError);
      return;
    }
    try {
      setIsSubmitting(true);
      setSubmitMessage("");
      setSubmitError("");
      const isEditMode = productModalMode === "edit" && Boolean(editingProductId);
      const response = await fetch(isEditMode ? buildApiUrl(`/api/products/admin/${editingProductId}`) : buildApiUrl("/api/products/admin"), {
        method: isEditMode ? "PATCH" : "POST",
        headers: { ...getAuthHeaders({ "Content-Type": "application/json" }) },
        body: JSON.stringify({
          category_id: form.categoryId ? Number(form.categoryId) : null,
          name: form.name.trim(),
          description: form.description.trim(),
          material_type: form.materialType.trim(),
          base_weight: Number(form.baseWeight || 0),
          status: form.status,
          variants: normalizedVariants,
          main_image_url: form.mainImageUrl.trim(),
          labor_cost: Number(form.laborCost || 0),
          stone_cost: Number(form.stoneCost || 0),
          markup_rate: Number(form.markupRate || 0),
          price_tiers: normalizeFormPriceTiers(form.priceTiers),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(normalizeApiMessage(data.message, "Không thể lưu sản phẩm."));
      const changedProductId = editingProductId || data.productId || data.product?.id || null;
      setSubmitMessage(isEditMode ? `Đã cập nhật sản phẩm: ${form.name.trim()}.` : `Đã thêm sản phẩm mới: ${form.name.trim()}.`);
      if (form.status === "HIDDEN") markProductBlocked(changedProductId, "hidden");
      else unmarkProductBlocked(changedProductId, "shown");
      notifyProductCatalogChanged(isEditMode ? "updated" : "created", changedProductId);
      await loadPageData();
      setEditingProductId(null);
      setProductModalMode("create");
      resetForm(false);
      setIsCreateModalOpen(false);
    } catch (submitErrorValue) {
      console.error("Save admin product error:", submitErrorValue);
      setSubmitMessage("");
      setSubmitError(submitErrorValue.message || "Không thể lưu sản phẩm.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isViewMode = productModalMode === "view";
  const modalTitle = isViewMode ? "Xem sản phẩm" : editingProductId ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới";
  const modalCopy = isViewMode
    ? "Toàn bộ thông tin sản phẩm được hiển thị theo đúng bố cục form thêm sản phẩm."
    : editingProductId
    ? "Cập nhật thông tin sản phẩm, biến thể, tồn kho và giá tính toán ngay trong hộp này."
    : "Nhập thông tin sản phẩm trong hộp này, sau đó lưu để cập nhật trực tiếp vào database.";
  const isBulkProductAction = isDeletingAllProducts || isHidingAllProducts;

  return (
    <section className="panel-page">
      <div className="page-head">
        <h1>Quản lý sản phẩm</h1>
        <p>Dữ liệu danh sách, tồn kho, giá bán và hình ảnh đang đọc trực tiếp từ database.</p>
      </div>
      <div className="product-summary-grid">
        <article className="category-summary-card"><span>Tổng sản phẩm</span><strong>{summary.totalProducts}</strong></article>
        <article className="category-summary-card"><span>Tổng tồn kho</span><strong>{summary.totalStock}</strong></article>
        <article className="category-summary-card"><span>Đang kinh doanh</span><strong>{summary.activeCount}</strong></article>
        <article className="category-summary-card"><span>Đang ẩn</span><strong>{summary.hiddenCount}</strong></article>
      </div>
      {status === "error" ? <div className="admin-notice admin-notice-error"><strong>Không thể tải dữ liệu sản phẩm.</strong><p>{error}</p></div> : null}
      {status !== "error" && error ? <div className="admin-notice admin-notice-error"><strong>Không thể thực hiện thao tác.</strong><p>{error}</p></div> : null}
      {!isCreateModalOpen && submitMessage ? <div className="admin-notice admin-notice-success"><strong>Thao tác thành công.</strong><p>{submitMessage}</p></div> : null}
      <div className="products-admin-layout">
        <section className="product-list-panel product-list-panel-full">
          <div className="section-title"><h3>Danh sách sản phẩm</h3><div className="section-actions"><button type="button" className="section-action" onClick={openCreateModal}>Thêm sản phẩm</button><button type="button" className="section-action" onClick={handleHideAllProducts} disabled={isBulkProductAction || !productList.length}>{isHidingAllProducts ? "Đang ẩn tất cả..." : "Ẩn tất cả sản phẩm"}</button><button type="button" className="danger-action" onClick={handleDeleteAllProducts} disabled={isBulkProductAction || !productList.length}>{isDeletingAllProducts ? "Đang xóa tất cả..." : "Xóa tất cả sản phẩm"}</button></div></div>
          <div className="product-toolbar product-toolbar-compact">
            <div className="product-category-dropdown">
              <button type="button" className="product-category-dropdown-trigger"><span>Danh mục</span><strong>{activeCategoryLabel}</strong></button>
              <div className="product-category-dropdown-menu">
                <button type="button" className={`product-category-dropdown-item ${activeCategory === "all" ? "active" : ""}`} onClick={() => setActiveCategory("all")}>Tất cả</button>
                {categoryTree.map((parent) => (
                  <div key={parent.id} className="product-category-dropdown-group">
                    <button type="button" className={`product-category-dropdown-item product-category-parent ${activeCategory === String(parent.id) ? "active" : ""}`} onClick={() => setActiveCategory(String(parent.id))}>{parent.name}</button>
                    {parent.children.length ? <div className="product-category-submenu">{parent.children.map((child) => <button key={child.id} type="button" className={`product-category-dropdown-item product-category-child ${activeCategory === String(child.id) ? "active" : ""}`} onClick={() => setActiveCategory(String(child.id))}>{child.name}</button>)}</div> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="product-category-dropdown">
              <button type="button" className="product-category-dropdown-trigger"><span>Trạng thái</span><strong>{activeStatusFilter === "all" ? "Tất cả" : activeStatusFilter === "active" ? "Đang hiện" : "Đang ẩn"}</strong></button>
              <div className="product-category-dropdown-menu">
                <button type="button" className={`product-category-dropdown-item ${activeStatusFilter === "all" ? "active" : ""}`} onClick={() => setActiveStatusFilter("all")}>Tất cả</button>
                <button type="button" className={`product-category-dropdown-item ${activeStatusFilter === "active" ? "active" : ""}`} onClick={() => setActiveStatusFilter("active")}>Đang hiện</button>
                <button type="button" className={`product-category-dropdown-item ${activeStatusFilter === "hidden" ? "active" : ""}`} onClick={() => setActiveStatusFilter("hidden")}>Đang ẩn</button>
              </div>
            </div>
            <label className="product-search"><span>Tìm theo tên / SKU</span><input type="search" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="VD: Nhẫn vàng hoặc RING-24K-001" /></label>
          </div>
          {status === "loading" ? <div className="admin-notice"><strong>Đang tải dữ liệu sản phẩm...</strong><p>Hệ thống đang đọc danh sách thật từ backend.</p></div> : null}
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Variant</th><th>Giá bán</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const variant = getPrimaryVariant(product);
                  const isHidden = String(product.status || "").toUpperCase() === "HIDDEN";
                  const isProcessing = processingProductId === product.id;
                  return (
                    <tr key={product.id}>
                      <td><div className="product-table-name"><strong>{product.name}</strong><small>{product.material_type}</small></div></td>
                      <td>{getCategoryName(product.category_id)}</td>
                      <td>{variant.sku}<br /><small>{variant.size}</small></td>
                      <td>{formatCurrency(product.pricing.current_sale_price_cache)}</td>
                      <td>{variant.stock.quantity}</td>
                      <td><span className="status-pill">{product.status_label || normalizeStatusLabel(product.status)}</span></td>
                      <td><div className="product-action-group"><button type="button" className="product-view-button" disabled={isProcessing} onClick={() => openViewModal(product)}>Xem</button><button type="button" className="product-edit-button" disabled={isProcessing} onClick={() => openEditModal(product)}>Sửa</button><button type="button" className="product-hide-button" disabled={isProcessing} onClick={() => isHidden ? handleShowProduct(product.id) : handleHideProduct(product.id)}>{isProcessing ? "..." : isHidden ? "Hiện" : "Ẩn"}</button><button type="button" className="product-delete-button" disabled={isProcessing} onClick={() => handleDeleteProduct(product.id)}>Xóa</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {status === "connected" && filteredProducts.length === 0 ? <div className="admin-notice"><strong>Không có sản phẩm nào khớp bộ lọc.</strong><p>Thử đổi danh mục hoặc từ khóa tìm kiếm.</p></div> : null}
          <div className="products-grid">
            {visibleProducts.map((product) => {
              const variant = getPrimaryVariant(product);
              const image = getMainImage(product);
              const isHidden = String(product.status || "").toUpperCase() === "HIDDEN";
              const isProcessing = processingProductId === product.id;
              return (
                <article key={product.id} className="product-card product-card-rich">
                  {image ? <div className="product-card-image"><img src={image.url} alt={product.name} /></div> : <div className="product-card-image product-card-image-empty">Không có ảnh</div>}
                  <div className="product-card-body">
                    <div className="product-card-top"><div><h4>{product.name}</h4><p className="product-meta">Danh mục: {getCategoryName(product.category_id)}</p></div><span className="status-pill">{product.status_label || normalizeStatusLabel(product.status)}</span></div>
                    <p className="product-copy">{product.description || "Chưa có mô tả sản phẩm."}</p>
                    <div className="product-meta-grid"><p className="product-meta">SKU: {variant.sku}</p><p className="product-meta">Size: {variant.size}</p><p className="product-meta">Kho: {variant.stock.warehouse_location}</p><p className="product-meta">Tồn: {variant.stock.quantity}</p><p className="product-meta">Khối lượng gốc: {product.base_weight} g</p><p className="product-meta">Giá: {formatCurrency(product.pricing.current_sale_price_cache)}</p></div>
                    <div className="product-card-actions"><button type="button" className="product-view-button" disabled={isProcessing} onClick={() => openViewModal(product)}>Xem</button><button type="button" className="product-edit-button" disabled={isProcessing} onClick={() => openEditModal(product)}>Sửa</button><button type="button" className="product-hide-button" disabled={isProcessing} onClick={() => isHidden ? handleShowProduct(product.id) : handleHideProduct(product.id)}>{isProcessing ? "..." : isHidden ? "Hiện" : "Ẩn"}</button><button type="button" className="product-delete-button" disabled={isProcessing} onClick={() => handleDeleteProduct(product.id)}>Xóa</button></div>
                  </div>
                </article>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                type="button"
                className="admin-pagination-arrow"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                &laquo; Trước
              </button>
              {Array.from({ length: totalPages }, (_, idx) => {
                const pageNumber = idx + 1;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`admin-pagination-number ${currentPage === pageNumber ? "active" : ""}`}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                type="button"
                className="admin-pagination-arrow"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau &raquo;
              </button>
            </div>
          )}
        </section>
      </div>
      {isCreateModalOpen ? (
        <div className="product-modal-backdrop" onClick={closeCreateModal}>
          <section className="product-modal" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
            <div className="product-modal-header">
              <div><p className="product-modal-kicker">Sản phẩm quản trị</p><h3>{modalTitle}</h3><p className="product-modal-copy">{modalCopy}</p></div>
              <button type="button" className="product-modal-close" onClick={closeCreateModal}>Đóng</button>
            </div>
            <form className={`product-form product-form-modal${isViewMode ? " view-mode" : ""}`} onSubmit={handleSubmit}>
              <div className="product-form-grid">
                <label className="category-form-field"><span>Danh mục</span><select value={form.categoryId} onChange={(event) => handleChange("categoryId", event.target.value)} disabled={!selectableCategoryOptions.length}>{selectableCategoryOptions.length ? selectableCategoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>) : <option value="">Không có danh mục hợp lệ</option>}</select></label>
                <label className="category-form-field"><span>Trạng thái</span><select value={form.status} onChange={(event) => handleChange("status", event.target.value)}><option value="ACTIVE">Đang bán</option><option value="HIDDEN">Ẩn</option></select></label>
                <label className="category-form-field category-form-field-wide"><span>Tên sản phẩm</span><input type="text" value={form.name} onChange={(event) => handleChange("name", event.target.value)} placeholder="VD: Nhẫn vàng 24K đính đá" /></label>
                <label className="category-form-field category-form-field-wide"><span>Mô tả</span><textarea value={form.description} onChange={(event) => handleChange("description", event.target.value)} placeholder="VD: Thiết kế thanh lịch, phù hợp dùng hằng ngày" /></label>
                <label className="category-form-field"><span>Chất liệu</span><select value={form.materialType} onChange={(event) => handleChange("materialType", event.target.value)} disabled={!materialOptions.length}>{materialOptions.length ? materialOptions.map((material) => <option key={material.material_type} value={material.material_type}>{material.material_type}</option>) : <option value="">Chưa có chất liệu trong hệ thống</option>}</select></label>
                <label className="category-form-field"><span>Khối lượng gốc</span><input type="text" inputMode="decimal" value={form.baseWeight} onChange={(event) => handleChange("baseWeight", event.target.value.replace(/[^\d.]/g, ""))} placeholder="VD: 3.25" /></label>
                <div className="product-variant-editor category-form-field category-form-field-wide">
                  <div className="product-tier-editor-head">
                    <span>Biến thể sản phẩm</span>
                    {!isViewMode ? <button type="button" onClick={addVariant}>Thêm biến thể</button> : null}
                  </div>
                  <div className="product-variant-editor-list">
                    {form.variants.map((variant, index) => (
                      <div className="product-variant-editor-row" key={variant.id || `variant-${index}`}>
                        <label>
                          <small>SKU</small>
                          <input type="text" value={variant.sku} onChange={(event) => handleVariantChange(index, "sku", event.target.value)} placeholder="VD: RING-24K-001" />
                        </label>
                        <label>
                          <small>Size</small>
                          <input type="text" value={variant.size} onChange={(event) => handleVariantChange(index, "size", event.target.value)} placeholder="VD: Số 12 hoặc 45 cm" />
                        </label>
                        <label>
                          <small>Phụ trọng lượng</small>
                          <input type="text" inputMode="decimal" value={variant.weightModifier} onChange={(event) => handleVariantChange(index, "weightModifier", event.target.value.replace(/[^\d.]/g, ""))} placeholder="VD: 0.15" />
                        </label>
                        <label>
                          <small>Tồn kho</small>
                          <input type="text" inputMode="numeric" value={variant.stockQuantity} onChange={(event) => handleVariantChange(index, "stockQuantity", event.target.value.replace(/[^\d]/g, ""))} placeholder="VD: 20" />
                        </label>
                        <label>
                          <small>Vị trí kho</small>
                          <input type="text" value={variant.warehouseLocation} onChange={(event) => handleVariantChange(index, "warehouseLocation", event.target.value)} placeholder="VD: Kho chính" />
                        </label>
                        {!isViewMode ? <button type="button" onClick={() => removeVariant(index)}>Xóa</button> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <label className="category-form-field"><span>Chi phí công</span><input type="text" inputMode="numeric" value={form.laborCost} onChange={(event) => handleChange("laborCost", event.target.value.replace(/[^\d]/g, ""))} placeholder="VD: 850000" /></label>
                <label className="category-form-field"><span>Chi phí đá</span><input type="text" inputMode="numeric" value={form.stoneCost} onChange={(event) => handleChange("stoneCost", event.target.value.replace(/[^\d]/g, ""))} placeholder="VD: 450000" /></label>
                <label className="category-form-field"><span>Tỷ lệ markup</span><input type="text" inputMode="decimal" value={form.markupRate} onChange={(event) => handleChange("markupRate", event.target.value.replace(/[^\d.]/g, ""))} placeholder="VD: 0.18" /></label>
                <div className="product-tier-editor category-form-field category-form-field-wide">
                  <div className="product-tier-editor-head">
                    <span>Bậc markup theo số lượng</span>
                    {!isViewMode ? <button type="button" onClick={addPriceTier}>Thêm bậc</button> : null}
                  </div>
                  {form.priceTiers.length ? (
                    <div className="product-tier-editor-list">
                      {form.priceTiers.map((tier, index) => (
                        <div className="product-tier-editor-row" key={`price-tier-${index}`}>
                          <label>
                            <small>Từ SL</small>
                            <input type="text" inputMode="numeric" value={tier.minQuantity} onChange={(event) => handlePriceTierChange(index, "minQuantity", event.target.value.replace(/[^\d]/g, ""))} placeholder="VD: 2" />
                          </label>
                          <label>
                            <small>Đến SL</small>
                            <input type="text" inputMode="numeric" value={tier.maxQuantity} onChange={(event) => handlePriceTierChange(index, "maxQuantity", event.target.value.replace(/[^\d]/g, ""))} placeholder="VD: 4 hoặc bỏ trống" />
                          </label>
                          <label>
                            <small>Tỷ lệ markup</small>
                            <input type="text" inputMode="decimal" value={tier.markupRate} onChange={(event) => handlePriceTierChange(index, "markupRate", event.target.value.replace(/[^\d.]/g, ""))} placeholder="VD: 0.12" />
                          </label>
                          {!isViewMode ? <button type="button" onClick={() => removePriceTier(index)}>Xóa</button> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Chưa có bậc giá. Nếu để trống, sản phẩm dùng giá tạm tính mặc định.</p>
                  )}
                </div>
                <label className="category-form-field category-form-field-wide">
                  <span>Địa chỉ ảnh (URL)</span>
                  <input
                    type="url"
                    value={form.mainImageUrl}
                    onChange={(event) => handleChange("mainImageUrl", event.target.value)}
                    placeholder="VD: https://example.com/images/nhan.jpg"
                    disabled={isViewMode}
                  />
                  <small className="field-hint">
                    Nhập địa chỉ URL hình ảnh công khai (Không cho phép tải lên tệp ảnh từ máy tính local).
                  </small>
                </label>
                {form.mainImageUrl ? <div className="product-image-preview category-form-field category-form-field-wide"><span>Xem trước ảnh</span><div className="product-image-preview-card"><img src={form.mainImageUrl} alt={form.name || "Ảnh sản phẩm"} /></div></div> : null}
                <div className="product-price-preview category-form-field category-form-field-wide"><span>Giá tạm tính</span><div className="product-price-preview-card"><strong>{formatCurrency(estimatedSalePrice)}</strong><p>Giá vật liệu hiện tại: {formatCurrency(selectedMaterialOption?.base_sell_price || 0)} / đơn vị</p><p>Hệ thống tự tính từ giá vàng mới nhất, khối lượng gốc, chi phí công, chi phí đá và markup.</p></div></div>
              </div>
              {submitMessage ? <div className="category-form-message success">{submitMessage}</div> : null}
              {submitError ? <div className="category-form-message error">{submitError}</div> : null}
              <div className="category-form-actions">{isViewMode ? <button type="button" className="secondary" onClick={closeCreateModal}>Đóng</button> : <><button type="button" className="secondary" onClick={() => resetForm()}>Xóa dữ liệu</button><button type="submit" disabled={isSubmitting}>{isSubmitting ? (editingProductId ? "Đang lưu..." : "Đang thêm...") : (editingProductId ? "Lưu thay đổi" : "Thêm sản phẩm")}</button></>}</div>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", onConfirm: null })}
      />
    </section>
  );
}

export default ProductsPage;
