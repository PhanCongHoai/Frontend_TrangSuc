import { useEffect, useState, useMemo, useCallback } from "react";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import { formatCurrency } from "../../../utils/pricing";
import "./ManufacturingPage.css";

const MFG_API = buildApiUrl("/api/manufacturing");
const RAW_API = buildApiUrl("/api/raw-materials");
const PRODUCTS_API = buildApiUrl("/api/products");

function ManufacturingPage() {
  const [activeTab, setActiveTab] = useState("work-orders"); // "work-orders" or "jewelers"
  const [jewelers, setJewelers] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [inStockRawMaterials, setInStockRawMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  // Jeweler Form States
  const [jewelerName, setJewelerName] = useState("");
  const [jewelerPhone, setJewelerPhone] = useState("");
  const [jewelerAddress, setJewelerAddress] = useState("");
  const [jewelerSubmitState, setJewelerSubmitState] = useState("idle");
  const [jewelerSubmitMessage, setJewelerSubmitMessage] = useState("");

  // Work Order Form States
  const [selectedJewelerId, setSelectedJewelerId] = useState("");
  const [expectedProductId, setExpectedProductId] = useState("");
  const [expectedProductName, setExpectedProductName] = useState(""); // manual expected product model name
  const [quantityExpected, setQuantityExpected] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [laborCostPerItem, setLaborCostPerItem] = useState("");
  const [handoverMaterials, setHandoverMaterials] = useState([
    {
      raw_material_item_id: "",
      gold_weight_given: "",
      gem_quantity_given: "0",
      gem_weight_given: "0",
      notes: "",
    },
  ]);
  const [woSubmitState, setWoSubmitState] = useState("idle");
  const [woSubmitMessage, setWoSubmitMessage] = useState("");

  // Complete Work Order Modal States
  const [activeReturnOrder, setActiveReturnOrder] = useState(null);
  const [completedVariantId, setCompletedVariantId] = useState("");
  const [productsCompleted, setProductsCompleted] = useState("1");
  const [goldWeightInProducts, setGoldWeightInProducts] = useState("");
  const [goldScrapRecovered, setGoldScrapRecovered] = useState("");
  const [gemQuantityReturned, setGemQuantityReturned] = useState("0");
  const [gemQuantityDamaged, setGemQuantityDamaged] = useState("0");
  const [allowedLossRate, setAllowedLossRate] = useState("0.007"); // 0.7% default
  const [qcPassed, setQcPassed] = useState(true);
  const [qcNotes, setQcNotes] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [completeSubmitState, setCompleteSubmitState] = useState("idle");
  const [completeSubmitMessage, setCompleteSubmitMessage] = useState("");

  // View Details Modal States
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState(null);

  // Quick Product Creation States
  const [categories, setCategories] = useState([]);
  const [showQuickCreateProductModal, setShowQuickCreateProductModal] = useState(false);
  const [quickProductForm, setQuickProductForm] = useState({
    categoryId: "",
    name: "",
    description: "",
    materialType: "Vàng 24K",
    baseWeight: "",
    status: "ACTIVE",
    sku: "",
    size: "",
    weightModifier: "0",
    mainImageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=300",
    laborCost: "",
    stoneCost: "",
    markupRate: "0.2",
    mainMaterial: "",
    materialPurity: "",
    primaryColor: "",
    mainGemstone: "",
    gemstoneSize: "",
    gemstoneShape: "",
    sideGemstone: "",
    gender: "UNISEX",
    collection: "",
    origin: "",
    warrantyMonths: 12,
  });
  const [quickProductSubmitState, setQuickProductSubmitState] = useState("idle");
  const [quickProductSubmitMessage, setQuickProductSubmitMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");

      const headers = getAuthHeaders();
      const [jewelersRes, workOrdersRes, rawRes, productsRes, categoriesRes] = await Promise.all([
        fetch(`${MFG_API}/jewelers`, { headers }),
        fetch(`${MFG_API}/work-orders`, { headers }),
        fetch(`${RAW_API}/in-stock`, { headers }),
        fetch(`${PRODUCTS_API}/admin/list`, { headers }),
        fetch(buildApiUrl("/api/categories?all=true"), { headers }),
      ]);

      if (
        jewelersRes.status === 401 ||
        workOrdersRes.status === 401 ||
        rawRes.status === 401 ||
        productsRes.status === 401 ||
        categoriesRes.status === 401
      ) {
        clearAuthSession();
        window.location.href = "/login";
        return;
      }

      const jewelersData = await jewelersRes.json();
      const workOrdersData = await workOrdersRes.json();
      const rawData = await rawRes.json();
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      if (
        jewelersData.success &&
        workOrdersData.success &&
        rawData.success &&
        productsData.success &&
        categoriesData.success
      ) {
        setJewelers(jewelersData.data);
        setWorkOrders(workOrdersData.data);
        setInStockRawMaterials(rawData.data);
        setProducts(productsData.products || []);
        setCategories(categoriesData.data || []);
        setStatus("success");
        return productsData.products || [];
      } else {
        throw new Error("Lỗi nạp dữ liệu từ backend.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError(err.message || "Không thể nạp dữ liệu.");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allVariants = useMemo(() => {
    const list = [];
    products.forEach((p) => {
      if (Array.isArray(p.variants)) {
        p.variants.forEach((v) => {
          list.push({
            ...v,
            productName: p.name,
            materialType: p.material_type,
            product_id: p.id,
          });
        });
      }
    });
    return list;
  }, [products]);

  const handleQuickCreateProduct = async (e) => {
    e.preventDefault();
    setQuickProductSubmitState("submitting");
    setQuickProductSubmitMessage("");

    if (!quickProductForm.name.trim()) {
      setQuickProductSubmitState("error");
      setQuickProductSubmitMessage("Vui lòng nhập tên sản phẩm.");
      return;
    }
    if (!quickProductForm.sku.trim()) {
      setQuickProductSubmitState("error");
      setQuickProductSubmitMessage("Vui lòng nhập mã SKU.");
      return;
    }

    try {
      const payload = {
        category_id: quickProductForm.categoryId ? Number(quickProductForm.categoryId) : null,
        name: quickProductForm.name.trim(),
        description: quickProductForm.description.trim(),
        material_type: quickProductForm.materialType,
        base_weight: Number(quickProductForm.baseWeight || 0),
        status: quickProductForm.status,
        variants: [
          {
            sku: quickProductForm.sku.trim(),
            size: quickProductForm.size.trim() || "Free size",
            weightModifier: Number(quickProductForm.weightModifier || 0),
            stockQuantity: 0,
            warehouseLocation: "Kệ thành phẩm xưởng chế tác",
          }
        ],
        main_image_url: quickProductForm.mainImageUrl.trim(),
        labor_cost: Number(quickProductForm.laborCost || 0),
        stone_cost: Number(quickProductForm.stoneCost || 0),
        markup_rate: Number(quickProductForm.markupRate || 0),
        price_tiers: [],
        main_material: quickProductForm.mainMaterial.trim() || undefined,
        material_purity: quickProductForm.materialPurity.trim() || undefined,
        primary_color: quickProductForm.primaryColor.trim() || undefined,
        main_gemstone: quickProductForm.mainGemstone.trim() || undefined,
        gemstone_size: quickProductForm.gemstoneSize.trim() || undefined,
        gemstone_shape: quickProductForm.gemstoneShape.trim() || undefined,
        side_gemstone: quickProductForm.sideGemstone.trim() || undefined,
        gender: quickProductForm.gender,
        collection: quickProductForm.collection.trim() || undefined,
        origin: quickProductForm.origin.trim() || undefined,
        warranty_months: Number(quickProductForm.warrantyMonths || 12),
      };

      const res = await fetch(`${PRODUCTS_API}/admin`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setQuickProductSubmitState("success");
        setQuickProductSubmitMessage("Tạo sản phẩm và biến thể thành công!");
        
        // Reload products list
        const updatedProducts = await loadData();

        // Find the variant using SKU and select it
        let foundVariantId = "";
        for (const p of updatedProducts) {
          if (Array.isArray(p.variants)) {
            const v = p.variants.find((v) => v.sku === quickProductForm.sku.trim());
            if (v) {
              foundVariantId = v.id;
              break;
            }
          }
        }
        if (foundVariantId) {
          setCompletedVariantId(String(foundVariantId));
        }

        // Reset quick form except materialType and defaults
        setQuickProductForm({
          categoryId: "",
          name: "",
          description: "",
          materialType: "Vàng 24K",
          baseWeight: "",
          status: "ACTIVE",
          sku: "",
          size: "",
          weightModifier: "0",
          mainImageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=300",
          laborCost: "",
          stoneCost: "",
          markupRate: "0.2",
          mainMaterial: "",
          materialPurity: "",
          primaryColor: "",
          mainGemstone: "",
          gemstoneSize: "",
          gemstoneShape: "",
          sideGemstone: "",
          gender: "UNISEX",
          collection: "",
          origin: "",
          warrantyMonths: 12,
        });

        setTimeout(() => {
          setShowQuickCreateProductModal(false);
          setQuickProductSubmitState("idle");
          setQuickProductSubmitMessage("");
        }, 1500);
      } else {
        throw new Error(data.message || "Lỗi tạo sản phẩm.");
      }
    } catch (err) {
      setQuickProductSubmitState("error");
      setQuickProductSubmitMessage(err.message);
    }
  };

  // Jeweler Handlers
  const handleCreateJeweler = async (e) => {
    e.preventDefault();
    setJewelerSubmitState("submitting");
    setJewelerSubmitMessage("");

    if (!jewelerName.trim()) {
      setJewelerSubmitState("error");
      setJewelerSubmitMessage("Tên thợ là bắt buộc.");
      return;
    }

    try {
      const res = await fetch(`${MFG_API}/jewelers`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: jewelerName,
          phone: jewelerPhone,
          address: jewelerAddress,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setJewelerSubmitState("success");
        setJewelerSubmitMessage(`Đã thêm thợ kim hoàn thành công! Mã thợ: ${data.data.jewelerCode}`);
        setJewelerName("");
        setJewelerPhone("");
        setJewelerAddress("");
        loadData();
      } else {
        throw new Error(data.message || "Lỗi lưu thợ.");
      }
    } catch (err) {
      setJewelerSubmitState("error");
      setJewelerSubmitMessage(err.message);
    }
  };

  // Work Order Handlers
  const handleAddMaterialRow = () => {
    setHandoverMaterials((prev) => [
      ...prev,
      {
        raw_material_item_id: "",
        gold_weight_given: "",
        gem_quantity_given: "0",
        gem_weight_given: "0",
        notes: "",
      },
    ]);
  };

  const handleRemoveMaterialRow = (index) => {
    if (handoverMaterials.length === 1) return;
    setHandoverMaterials((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMaterialChange = (index, field, value) => {
    setHandoverMaterials((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      
      // Auto-populates parameters when material lot ID is selected
      if (field === "raw_material_item_id") {
        const lot = inStockRawMaterials.find((m) => m.id === Number(value));
        if (lot) {
          next[index].gold_weight_given = lot.category === "GOLD" ? lot.weight : "0";
          next[index].gem_quantity_given = lot.category === "GEMSTONE" ? lot.quantity : "0";
          next[index].gem_weight_given = lot.category === "GEMSTONE" ? lot.weight : "0";
        }
      }
      return next;
    });
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    setWoSubmitState("submitting");
    setWoSubmitMessage("");

    if (!selectedJewelerId) {
      setWoSubmitState("error");
      setWoSubmitMessage("Vui lòng chọn thợ kim hoàn chịu trách nhiệm.");
      return;
    }
    if (!dueDate) {
      setWoSubmitState("error");
      setWoSubmitMessage("Vui lòng chọn thời gian hẹn hoàn thành.");
      return;
    }
    if (isNaN(laborCostPerItem) || Number(laborCostPerItem) < 0) {
      setWoSubmitState("error");
      setWoSubmitMessage("Tiền công gia công thỏa thuận không hợp lệ.");
      return;
    }

    // Kiểm tra trống và vượt giới hạn tồn kho
    const materialIds = [];
    for (let i = 0; i < handoverMaterials.length; i++) {
      const m = handoverMaterials[i];
      if (!m.raw_material_item_id) {
        setWoSubmitState("error");
        setWoSubmitMessage(`Dòng nguyên liệu #${i + 1}: Vui lòng chọn lô phôi nguyên liệu.`);
        return;
      }
      
      const item_id = Number(m.raw_material_item_id);
      materialIds.push(item_id);

      const lot = inStockRawMaterials.find((x) => x.id === item_id);
      if (lot) {
        const givenWeight = Number(m.gold_weight_given || 0);
        if (givenWeight <= 0) {
          setWoSubmitState("error");
          setWoSubmitMessage(`Dòng nguyên liệu #${i + 1}: Khối lượng bàn giao của lô ${lot.lotId} phải lớn hơn 0.`);
          return;
        }
        if (givenWeight > lot.weight) {
          setWoSubmitState("error");
          setWoSubmitMessage(`Dòng nguyên liệu #${i + 1}: Khối lượng bàn giao (${givenWeight} chỉ) lớn hơn khối lượng tồn kho thực tế của lô ${lot.lotId} (${lot.weight} chỉ).`);
          return;
        }

        if (lot.category === "GEMSTONE") {
          const gemQty = Number(m.gem_quantity_given || 0);
          if (gemQty <= 0) {
            setWoSubmitState("error");
            setWoSubmitMessage(`Dòng nguyên liệu #${i + 1}: Số lượng đá bàn giao của lô ${lot.lotId} phải lớn hơn 0.`);
            return;
          }
          if (gemQty > lot.quantity) {
            setWoSubmitState("error");
            setWoSubmitMessage(`Dòng nguyên liệu #${i + 1}: Số lượng đá giao (${gemQty} viên) lớn hơn số lượng hạt tồn kho của lô ${lot.lotId} (${lot.quantity} viên).`);
            return;
          }
        }
      }
    }

    // Chặn chọn trùng lô phôi thô trong cùng một lệnh
    const uniqueMaterialIds = new Set(materialIds);
    if (uniqueMaterialIds.size !== materialIds.length) {
      setWoSubmitState("error");
      setWoSubmitMessage("Mã lô nguyên liệu bàn giao không được trùng lặp trong cùng một lệnh sản xuất.");
      return;
    }

    try {
      const res = await fetch(`${MFG_API}/work-orders`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jeweler_id: Number(selectedJewelerId),
          expected_product_id: null,
          expected_product_name: expectedProductName,
          quantity_expected: Number(quantityExpected),
          due_date: dueDate,
          labor_cost_per_item: Number(laborCostPerItem),
          materials: handoverMaterials.map((m) => ({
            raw_material_item_id: Number(m.raw_material_item_id),
            gold_weight_given: Number(m.gold_weight_given || 0),
            gem_quantity_given: Number(m.gem_quantity_given || 0),
            gem_weight_given: Number(m.gem_weight_given || 0),
            notes: m.notes,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWoSubmitState("success");
        setWoSubmitMessage(`Lập lệnh sản xuất thành công! Mã lệnh: ${data.workOrderCode}`);
        setSelectedJewelerId("");
        setExpectedProductId("");
        setExpectedProductName("");
        setQuantityExpected("1");
        setDueDate("");
        setLaborCostPerItem("");
        setHandoverMaterials([
          {
            raw_material_item_id: "",
            gold_weight_given: "",
            gem_quantity_given: "0",
            gem_weight_given: "0",
            notes: "",
          },
        ]);
        loadData();
      } else {
        throw new Error(data.message || "Lỗi tạo lệnh.");
      }
    } catch (err) {
      setWoSubmitState("error");
      setWoSubmitMessage(err.message);
    }
  };

  // Completion/QC Modal Handlers
  const handleOpenCompleteModal = (order) => {
    setActiveReturnOrder(order);
    setCompletedVariantId("");
    setProductsCompleted(order.quantityExpected);
    setGoldWeightInProducts("");
    setGoldScrapRecovered("");
    setGemQuantityReturned("0");
    setGemQuantityDamaged("0");
    setAllowedLossRate("0.007"); // 0.7% default
    setQcPassed(true);
    setQcNotes("");
    setReturnNotes("");
    setCompleteSubmitState("idle");
    setCompleteSubmitMessage("");
  };

  const handleCloseCompleteModal = () => {
    setActiveReturnOrder(null);
  };

  const selectedExpectedProduct = useMemo(() => {
    if (!activeReturnOrder || !activeReturnOrder.expectedProductId) return null;
    return products.find((p) => p.id === activeReturnOrder.expectedProductId) || null;
  }, [activeReturnOrder, products]);

  const handleCompleteWorkOrder = async (e) => {
    e.preventDefault();
    setCompleteSubmitState("submitting");
    setCompleteSubmitMessage("");

    if (!completedVariantId) {
      setCompleteSubmitState("error");
      setCompleteSubmitMessage("Vui lòng chọn biến thể thành phẩm sau khi hoàn thành.");
      return;
    }
    if (isNaN(productsCompleted) || Number(productsCompleted) <= 0) {
      setCompleteSubmitState("error");
      setCompleteSubmitMessage("Số lượng thành phẩm hoàn thành không hợp lệ.");
      return;
    }
    if (isNaN(goldWeightInProducts) || Number(goldWeightInProducts) < 0) {
      setCompleteSubmitState("error");
      setCompleteSubmitMessage("Khối lượng vàng trong thành phẩm không hợp lệ.");
      return;
    }

    try {
      const res = await fetch(`${MFG_API}/work-orders/${activeReturnOrder.id}/return`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          completed_product_variant_id: completedVariantId ? Number(completedVariantId) : null,
          products_completed: Number(productsCompleted),
          gold_weight_in_products: Number(goldWeightInProducts),
          gold_scrap_recovered: Number(goldScrapRecovered || 0),
          gem_quantity_returned: Number(gemQuantityReturned || 0),
          gem_quantity_damaged: Number(gemQuantityDamaged || 0),
          allowed_loss_rate: Number(allowedLossRate),
          qc_passed: qcPassed,
          qc_notes: qcNotes,
          return_notes: returnNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCompleteSubmitState("success");
        setCompleteSubmitMessage(`Nghiệm thu hoàn tất! Hao hụt thực tế: ${data.data.actualLossWeight.toFixed(4)} chỉ. Hao hụt cho phép: ${data.data.allowedLossWeight.toFixed(4)} chỉ.`);
        
        // Triggers alert dialog if red flag is raised
        if (data.data.isLossAlert) {
          alert(`CẢNH BÁO HẠO LAO: Lượng vàng hao hụt của thợ (${data.data.actualLossWeight.toFixed(4)} chỉ) VƯỢT ĐỊNH MỨC CHO PHÉP (${data.data.allowedLossWeight.toFixed(4)} chỉ)!`);
        }

        setTimeout(() => {
          handleCloseCompleteModal();
          loadData();
        }, 3000);
      } else {
        throw new Error(data.message || "Lỗi phê nghiệm thu.");
      }
    } catch (err) {
      setCompleteSubmitState("error");
      setCompleteSubmitMessage(err.message);
    }
  };

  return (
    <section className="panel-page mfg-container">
      <div className="page-head" style={{ marginBottom: "20px" }}>
        <h1 style={{ color: "#fff", fontWeight: "700" }}>Xưởng sản xuất chế tác & Quản lý hao hụt (Khâu 2)</h1>
        
        <div className="mfg-tabs-container">
          <button
            type="button"
            className={`mfg-tab-btn ${activeTab === "work-orders" ? "active" : ""}`}
            onClick={() => setActiveTab("work-orders")}
          >
            Lệnh sản xuất & Nghiệm thu
          </button>
          <button
            type="button"
            className={`mfg-tab-btn ${activeTab === "jewelers" ? "active" : ""}`}
            onClick={() => setActiveTab("jewelers")}
          >
            Danh sách thợ kim hoàn
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div style={{ padding: "20px", textAlign: "center", color: "#aaa" }}>Đang nạp dữ liệu xưởng...</div>
      )}

      {status === "error" && (
        <div className="admin-notice admin-notice-error" style={{ padding: "15px", marginBottom: "20px" }}>
          <strong>Lỗi nạp dữ liệu:</strong>
          <p>{error}</p>
        </div>
      )}

      {status === "success" && activeTab === "jewelers" && (
        <div className="products-admin-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "25px" }}>
          <section className="mfg-card">
            <div className="section-title" style={{ marginBottom: "15px" }}>
              <h3 style={{ color: "#e2b85c", margin: 0 }}>Thêm thợ kim hoàn mới</h3>
            </div>
            
            <form onSubmit={handleCreateJeweler}>
              <div className="product-form-grid" style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Họ tên thợ</span>
                  <input
                    type="text"
                    required
                    value={jewelerName}
                    onChange={(e) => setJewelerName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A..."
                    className="mfg-input"
                  />
                </label>

                <label className="mfg-input-label">
                  <span>Số điện thoại</span>
                  <input
                    type="text"
                    value={jewelerPhone}
                    onChange={(e) => setJewelerPhone(e.target.value)}
                    placeholder="Số điện thoại liên lạc..."
                    className="mfg-input"
                  />
                </label>

                <label className="mfg-input-label">
                  <span>Địa chỉ xưởng thợ</span>
                  <input
                    type="text"
                    value={jewelerAddress}
                    onChange={(e) => setJewelerAddress(e.target.value)}
                    placeholder="Nhập địa chỉ nhà riêng/xưởng..."
                    className="mfg-input"
                  />
                </label>
              </div>

              {jewelerSubmitMessage && (
                <div className={`category-form-message ${jewelerSubmitState === "success" ? "success" : "error"}`} style={{ padding: "10px", borderRadius: "5px", marginBottom: "15px", textAlign: "center" }}>
                  {jewelerSubmitMessage}
                </div>
              )}

              <div className="category-form-actions" style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={jewelerSubmitState === "submitting"} className="mfg-btn-gold">
                  {jewelerSubmitState === "submitting" ? "Đang lưu..." : "Thêm thợ"}
                </button>
              </div>
            </form>
          </section>

          <section className="mfg-card">
            <div className="section-title" style={{ marginBottom: "15px" }}>
              <h3 style={{ color: "#e2b85c", margin: 0 }}>Danh sách thợ kim hoàn</h3>
            </div>

            {jewelers.length === 0 ? (
              <p style={{ textAlign: "center", padding: "20px", color: "#aaa" }}>Chưa có thông tin thợ nào.</p>
            ) : (
              <div className="mfg-table-wrap">
                <table className="mfg-table">
                  <thead>
                    <tr>
                      <th>Mã thợ</th>
                      <th>Họ tên</th>
                      <th>Điện thoại</th>
                      <th>Địa chỉ</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jewelers.map((j) => (
                      <tr key={j.id}>
                        <td><span style={{ fontWeight: "bold", color: "#e2b85c" }}>{j.jewelerCode}</span></td>
                        <td>{j.fullName}</td>
                        <td>{j.phone || "-"}</td>
                        <td>{j.address || "-"}</td>
                        <td>
                          <span className={`mfg-status-badge ${j.status === "ACTIVE" ? "active" : "inactive"}`}>
                            {j.status === "ACTIVE" ? "Đang làm" : "Nghỉ việc"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {status === "success" && activeTab === "work-orders" && (
        <div className="products-admin-layout" style={{ display: "grid", gridTemplateColumns: "1.20fr 1.80fr", gap: "25px" }}>
          
          {/* Form tạo Lệnh chế tác và bàn giao phôi */}
          <section className="mfg-card">
            <div className="section-title" style={{ marginBottom: "15px" }}>
              <h3 style={{ color: "#e2b85c", margin: 0 }}>Lập Lệnh Chế Tác Mới</h3>
            </div>
            
            <form onSubmit={handleCreateWorkOrder}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Thợ kim hoàn phụ trách</span>
                  <select
                    required
                    value={selectedJewelerId}
                    onChange={(e) => setSelectedJewelerId(e.target.value)}
                    className="mfg-select"
                  >
                    <option value="">-- Chọn thợ --</option>
                    {jewelers.filter(j => j.status === "ACTIVE").map((j) => (
                      <option key={j.id} value={j.id}>{j.fullName} ({j.jewelerCode})</option>
                    ))}
                  </select>
                </label>
                <label className="mfg-input-label">
                  <span>Hạn hẹn hoàn công</span>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mfg-input"
                  />
                </label>
              </div>

               <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Mẫu sản phẩm dự kiến (Nhập tay)</span>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nhẫn Nam Saphir H002, Lắc Star..."
                    value={expectedProductName}
                    onChange={(e) => setExpectedProductName(e.target.value)}
                    className="mfg-input"
                  />
                </label>
                <label className="mfg-input-label">
                  <span>Số lượng mẫu</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantityExpected}
                    onChange={(e) => setQuantityExpected(e.target.value)}
                    className="mfg-input"
                  />
                </label>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Đơn giá tiền công (VND / sản phẩm)</span>
                  <input
                    type="number"
                    required
                    value={laborCostPerItem}
                    onChange={(e) => setLaborCostPerItem(e.target.value)}
                    placeholder="VD: 500000"
                    className="mfg-input"
                  />
                </label>
              </div>

              <div style={{ borderTop: "1px solid #444", paddingTop: "15px", marginBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, color: "#e2b85c" }}>Nguyên liệu phôi giao thợ</h4>
                  <button type="button" onClick={handleAddMaterialRow} className="mfg-tab-btn active" style={{ padding: "6px 12px", fontSize: "12px" }}>
                    + Thêm lô phôi giao
                  </button>
                </div>

                {handoverMaterials.map((m, idx) => (
                  <div key={idx} className="mfg-lot-container">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <strong style={{ color: "#e2b85c" }}>Chi tiết bàn giao #{idx + 1}</strong>
                      {handoverMaterials.length > 1 && (
                        <button type="button" onClick={() => handleRemoveMaterialRow(idx)} style={{ color: "#ff6b6b", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                          Xóa
                        </button>
                      )}
                    </div>

                    <label className="mfg-input-label" style={{ marginBottom: "8px" }}>
                      <span>Chọn Lot ID (Lô nguyên liệu)</span>
                      <select
                        required
                        value={m.raw_material_item_id}
                        onChange={(e) => handleMaterialChange(idx, "raw_material_item_id", e.target.value)}
                        className="mfg-select"
                      >
                        <option value="">-- Chọn Lot ID nguyên liệu thô --</option>
                        {inStockRawMaterials.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            Lot: {lot.lotId} ({lot.materialType} | Tồn: {lot.weight} {lot.weightUnit})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "8px" }}>
                      <label className="mfg-input-label">
                        <span>Vàng bàn giao (Chỉ)</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={m.gold_weight_given}
                          onChange={(e) => handleMaterialChange(idx, "gold_weight_given", e.target.value)}
                          className="mfg-input"
                        />
                      </label>
                      <label className="mfg-input-label">
                        <span>Số lượng đá (Viên)</span>
                        <input
                          type="number"
                          value={m.gem_quantity_given}
                          onChange={(e) => handleMaterialChange(idx, "gem_quantity_given", e.target.value)}
                          className="mfg-input"
                        />
                      </label>
                      <label className="mfg-input-label">
                        <span>Khối lượng đá (Carat)</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={m.gem_weight_given}
                          onChange={(e) => handleMaterialChange(idx, "gem_weight_given", e.target.value)}
                          className="mfg-input"
                        />
                      </label>
                    </div>

                    <label className="mfg-input-label">
                      <span>Ghi chú bàn giao nguyên liệu</span>
                      <input
                        type="text"
                        value={m.notes}
                        onChange={(e) => handleMaterialChange(idx, "notes", e.target.value)}
                        placeholder="VD: Cân kỹ trên cân, phôi không xước..."
                        className="mfg-input"
                      />
                    </label>
                  </div>
                ))}
              </div>

              {woSubmitMessage && (
                <div className={`category-form-message ${woSubmitState === "success" ? "success" : "error"}`} style={{ padding: "10px", borderRadius: "5px", marginBottom: "15px", textAlign: "center" }}>
                  {woSubmitMessage}
                </div>
              )}

              <div className="category-form-actions" style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={woSubmitState === "submitting"} className="mfg-btn-green">
                  {woSubmitState === "submitting" ? "Đang xử lý..." : "Khởi chạy & Giao phôi"}
                </button>
              </div>
            </form>
          </section>

          {/* Danh sách Lệnh sản xuất chế tác */}
          <section className="mfg-card">
            <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ color: "#e2b85c", margin: 0 }}>Theo dõi chế tác & Nghiệm thu hao hụt</h3>
              <button type="button" onClick={loadData} className="mfg-tab-btn active" style={{ padding: "6px 12px", fontSize: "12px" }}>Làm mới</button>
            </div>

            {workOrders.length === 0 ? (
              <p style={{ textAlign: "center", padding: "20px", color: "#aaa" }}>Chưa có lệnh sản xuất nào được khởi chạy.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {workOrders.map((order) => (
                  <article 
                    key={order.id} 
                    className="mfg-wo-article"
                    onClick={() => setViewingReceiptOrder(order)}
                    style={{ cursor: "pointer", transition: "all 0.2s" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px", marginBottom: "10px" }}>
                      <strong style={{ color: "#e2b85c" }}>Mã lệnh: {order.workOrderCode}</strong>
                      <span className={`mfg-status-badge ${order.status === "COMPLETED" ? "completed" : "progress"}`}>
                        {order.status === "COMPLETED" ? "Đã nghiệm thu (QC)" : "Đang sản xuất"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", fontSize: "14px", marginBottom: "10px" }}>
                      <div>Thợ: <span style={{ fontWeight: "bold", color: "#fff" }}>{order.jewelerName} ({order.jewelerCode})</span></div>
                      <div>Hạn hẹn: {new Date(order.dueDate).toLocaleDateString("vi-VN")}</div>
                      <div>Mẫu: <span style={{ fontWeight: "bold", color: "#e2b85c" }}>{order.expectedProductName}</span> (SL: {order.quantityExpected})</div>
                      <div>Tiền công ký thỏa thuận: {formatCurrency(order.laborCostPerItem)}/SP</div>
                    </div>

                    <div style={{ fontSize: "13px", color: "#ddd", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", marginBottom: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <strong style={{ color: "#e2b85c" }}>Lô phôi vàng/đá bàn giao:</strong>
                      <ul style={{ margin: "5px 0 0 0", paddingLeft: "18px", color: "#ccc" }}>
                        {order.materials.map((m) => (
                          <li key={m.id} style={{ marginBottom: "2px" }}>
                            Lot ID: <strong style={{ color: "#fff" }}>{m.lotId}</strong> | Vàng giao: {m.goldWeightGiven} chỉ {m.gemQuantityGiven > 0 && `| Đá giao: ${m.gemQuantityGiven} hạt (${m.gemWeightGiven} carat)`} {m.notes && `[Ghi chú: ${m.notes}]`}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {order.status === "IN_PROGRESS" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCompleteModal(order);
                        }}
                        className="mfg-btn-gold"
                        style={{ width: "100%", padding: "10px", color: "#000", fontSize: "13px" }}
                      >
                        Nghiệm thu hoàn công (Kiểm QC & Tính Lao)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingReceiptOrder(order);
                        }}
                        className="mfg-tab-btn"
                        style={{ width: "100%", padding: "8px", border: "1px solid #2ebd7f", color: "#2ebd7f", borderRadius: "8px", fontSize: "13px" }}
                      >
                        Xem chi tiết kết quả đối soát & Ghi chú QC
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal: Nghiệm thu hoàn công (QC & Tính hao hụt) - Chỉ Admin */}
      {activeReturnOrder && (
        <div className="mfg-modal-overlay">
          <div className="mfg-modal-content">
            <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px", marginBottom: "15px", color: "#ff6b6b" }}>
              Nghiệm thu kiểm QC & Tính hao hụt: {activeReturnOrder.workOrderCode}
            </h3>

            <form onSubmit={handleCompleteWorkOrder}>
              <label className="mfg-input-label" style={{ marginBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Chọn Biến Thể Thành Phẩm thực tế nhập kho</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      // Set default values from the work order details to speed up entry!
                      setQuickProductForm((prev) => ({
                        ...prev,
                        name: activeReturnOrder.expectedProductName || "",
                        materialType: activeReturnOrder.materials[0]?.materialType || "Vàng 24K",
                        laborCost: String(activeReturnOrder.laborCostPerItem || ""),
                      }));
                      setShowQuickCreateProductModal(true);
                    }} 
                    style={{ background: "none", border: "none", color: "#e2b85c", cursor: "pointer", textDecoration: "underline", fontSize: "12px", padding: 0 }}
                  >
                    + Tạo nhanh sản phẩm & SKU mới
                  </button>
                </div>
                <select
                  required
                  value={completedVariantId}
                  onChange={(e) => setCompletedVariantId(e.target.value)}
                  className="mfg-select"
                >
                  <option value="">-- Chọn biến thể size/sku thành phẩm --</option>
                  {selectedExpectedProduct && selectedExpectedProduct.variants && (
                    <optgroup label={`Biến thể của mẫu: ${selectedExpectedProduct.name}`}>
                      {selectedExpectedProduct.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          SKU: {v.sku} (Size: {v.size} | Chênh lệch nặng: {v.weight_modifier} chỉ)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Tất cả các sản phẩm khác trong hệ thống">
                    {allVariants
                      .filter((v) => !selectedExpectedProduct || v.product_id !== selectedExpectedProduct.id)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.productName} - SKU: {v.sku} (Size: {v.size} | {v.materialType})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Số lượng thành phẩm</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={productsCompleted}
                    onChange={(e) => setProductsCompleted(e.target.value)}
                    className="mfg-input"
                  />
                </label>
                <label className="mfg-input-label">
                  <span>Định mức hao lao cho phép (0.007 = 0.7%)</span>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={allowedLossRate}
                    onChange={(e) => setAllowedLossRate(e.target.value)}
                    className="mfg-input"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Trọng lượng vàng thành phẩm (Chỉ)</span>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={goldWeightInProducts}
                    onChange={(e) => setGoldWeightInProducts(e.target.value)}
                    placeholder="VD: 2.1400"
                    className="mfg-input"
                  />
                </label>
                <label className="mfg-input-label">
                  <span>Vàng dăm/bụi vàng thu hồi (Chỉ)</span>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={goldScrapRecovered}
                    onChange={(e) => setGoldScrapRecovered(e.target.value)}
                    placeholder="VD: 0.0500"
                    className="mfg-input"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Số lượng đá thừa trả lại</span>
                  <input
                    type="number"
                    value={gemQuantityReturned}
                    onChange={(e) => setGemQuantityReturned(e.target.value)}
                    className="mfg-input"
                  />
                </label>
                <label className="mfg-input-label">
                  <span>Số lượng đá hỏng/mẻ</span>
                  <input
                    type="number"
                    value={gemQuantityDamaged}
                    onChange={(e) => setGemQuantityDamaged(e.target.value)}
                    className="mfg-input"
                  />
                </label>
              </div>

              <label className="mfg-input-label" style={{ marginBottom: "15px" }}>
                <span>Ghi chú nghiệm thu (Nhận xét vàng dăm, phôi...)</span>
                <textarea
                  rows="2"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Nhập ghi chú chung khi nghiệm thu..."
                  className="mfg-textarea"
                  style={{ resize: "none" }}
                />
              </label>

              <div style={{ border: "1px solid rgba(255,255,255,0.08)", padding: "12px", borderRadius: "8px", marginBottom: "15px", background: "rgba(0,0,0,0.15)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: "bold", color: "#2ebd7f" }}>
                  <input
                    type="checkbox"
                    checked={qcPassed}
                    onChange={(e) => setQcPassed(e.target.checked)}
                    style={{ transform: "scale(1.2)" }}
                  />
                  <span>Đồng ý Duyệt Đạt Chất Lượng (QC Passed)</span>
                </label>
                <label className="mfg-input-label" style={{ marginTop: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#aaa" }}>Ghi chú kiểm duyệt QC của Admin</span>
                  <input
                    type="text"
                    value={qcNotes}
                    onChange={(e) => setQcNotes(e.target.value)}
                    placeholder="VD: Xi mạ sáng bóng, nước đá gắn chắc chắn..."
                    className="mfg-input"
                    style={{ marginTop: "5px" }}
                  />
                </label>
              </div>

              {completeSubmitMessage && (
                <div className={`category-form-message ${completeSubmitState === "success" ? "success" : "error"}`} style={{ padding: "10px", borderRadius: "5px", marginBottom: "15px", textAlign: "center" }}>
                  {completeSubmitMessage}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="secondary" onClick={handleCloseCompleteModal} style={{ padding: "8px 16px", cursor: "pointer" }}>
                  Hủy bỏ
                </button>
                <button type="submit" disabled={completeSubmitState === "submitting"} style={{ padding: "8px 20px", background: "#ff6b6b", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                  {completeSubmitState === "submitting" ? "Đang ký duyệt..." : "Admin Ký Duyệt QC & Lưu Kho"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xem chi tiết nghiệm thu & đối soát hao hụt */}
      {viewingReceiptOrder && (
        <div className="mfg-modal-overlay">
          <div className="mfg-modal-content" style={{ maxWidth: "650px", width: "90%" }}>
            <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px", color: "#e2b85c", marginBottom: "15px" }}>
              Chi tiết Lệnh Chế Tác: {viewingReceiptOrder.workOrderCode}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px", color: "#ccc", marginBottom: "15px" }}>
              <div>Thợ phụ trách: <span style={{ fontWeight: "bold", color: "#fff" }}>{viewingReceiptOrder.jewelerName} ({viewingReceiptOrder.jewelerCode})</span></div>
              <div>Hạn hẹn hoàn công: <span style={{ fontWeight: "bold", color: "#fff" }}>{new Date(viewingReceiptOrder.dueDate).toLocaleDateString("vi-VN")}</span></div>
              <div>Mẫu sản phẩm: <span style={{ fontWeight: "bold", color: "#fff" }}>{viewingReceiptOrder.expectedProductName}</span></div>
              <div>Số lượng dự kiến: <span style={{ fontWeight: "bold", color: "#fff" }}>{viewingReceiptOrder.quantityExpected} chiếc</span></div>
              <div>Tiền công thỏa thuận: <span style={{ fontWeight: "bold", color: "#fff" }}>{formatCurrency(viewingReceiptOrder.laborCostPerItem)}/SP</span></div>
              <div>Trạng thái: 
                <span className={`mfg-status-badge ${viewingReceiptOrder.status === 'COMPLETED' ? 'completed' : 'progress'}`} style={{ marginLeft: "8px" }}>
                  {viewingReceiptOrder.status === 'COMPLETED' ? 'Đã nghiệm thu' : 'Đang sản xuất'}
                </span>
              </div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px", marginBottom: "15px" }}>
              <strong style={{ color: "#e2b85c", fontSize: "13px" }}>Nguyên liệu phôi đã bàn giao thợ:</strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", color: "#ccc", fontSize: "13px" }}>
                {viewingReceiptOrder.materials.map((m) => (
                  <li key={m.id} style={{ marginBottom: "4px" }}>
                    Mã Lô: <strong style={{ color: "#fff" }}>{m.lotId}</strong> | Vàng giao: <strong style={{ color: "#fff" }}>{m.goldWeightGiven} chỉ</strong> {m.gemQuantityGiven > 0 && `| Đá giao: ${m.gemQuantityGiven} hạt (${m.gemWeightGiven} carat)`} {m.notes && `[Ghi chú: ${m.notes}]`}
                  </li>
                ))}
              </ul>
            </div>

            {viewingReceiptOrder.receipt ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "15px" }}>
                <h4 style={{ color: "#2ebd7f", margin: "0" }}>Thông tin Nghiệm thu QC & Đối soát</h4>
                <div>Người ký duyệt: <span style={{ fontWeight: "bold", color: "#fff" }}>{viewingReceiptOrder.receipt.receiverName} (ADMIN)</span></div>
                <div>Ngày nghiệm thu: {new Date(viewingReceiptOrder.receipt.returnedAt).toLocaleString("vi-VN")}</div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>Số lượng thành phẩm: <span style={{ fontWeight: "bold" }}>{viewingReceiptOrder.receipt.productsCompleted} món</span></div>
                  <div>Mã SKU nhập kho: <span style={{ fontWeight: "bold", color: "#e2b85c" }}>{viewingReceiptOrder.receipt.completedProductVariantSku}</span></div>
                </div>

                <div>
                  <strong style={{ color: "#e2b85c" }}>Cân đối lượng & Hao hụt (Lao):</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px", marginTop: "5px", fontSize: "13px" }}>
                    <div>Vàng trong thành phẩm:</div>
                    <div style={{ fontWeight: "bold" }}>{viewingReceiptOrder.receipt.goldWeightInProducts.toFixed(4)} chỉ</div>
                    <div>Vàng dăm/bụi thu hồi:</div>
                    <div style={{ fontWeight: "bold" }}>{viewingReceiptOrder.receipt.goldScrapRecovered.toFixed(4)} chỉ</div>
                    
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "5px" }}>Vàng hao hụt thực tế (Lao):</div>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "5px", fontWeight: "bold", color: viewingReceiptOrder.receipt.isLossAlert ? "#ff6b6b" : "#2ebd7f" }}>
                      {viewingReceiptOrder.receipt.actualLossWeight.toFixed(4)} chỉ
                    </div>
                    
                    <div>Hao hụt tối đa cho phép:</div>
                    <div style={{ fontWeight: "bold" }}>{viewingReceiptOrder.receipt.allowedLossWeight.toFixed(4)} chỉ ({viewingReceiptOrder.receipt.allowedLossRate * 100}%)</div>
                  </div>

                  {viewingReceiptOrder.receipt.isLossAlert && (
                    <div style={{ background: "rgba(255, 107, 107, 0.12)", border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "10px", borderRadius: "8px", marginTop: "12px", fontWeight: "bold", textAlign: "center" }}>
                      [!] CẢNH BÁO: Hao hụt của thợ VƯỢT ĐỊNH MỨC CHO PHÉP
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px dashed rgba(255,255,255,0.08)", paddingTop: "10px", fontSize: "13px" }}>
                  <div>Đá trả lại: {viewingReceiptOrder.receipt.gemQuantityReturned} viên | Đá mẻ/hỏng: {viewingReceiptOrder.receipt.gemQuantityDamaged} viên</div>
                  <div style={{ marginTop: "5px" }}>Trạng thái QC: <span style={{ fontWeight: "bold", color: viewingReceiptOrder.receipt.qcPassed ? "#2ebd7f" : "#ff6b6b" }}>{viewingReceiptOrder.receipt.qcPassed ? "Đạt chất lượng" : "Không đạt chất lượng"}</span></div>
                  <div>Ghi chú QC: <span style={{ color: "#aaa" }}>{viewingReceiptOrder.receipt.qcNotes || "Không có"}</span></div>
                  <div>Ghi chú thu hồi: <span style={{ color: "#aaa" }}>{viewingReceiptOrder.receipt.returnNotes || "Không có"}</span></div>
                </div>
              </div>
            ) : (
              <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "15px", fontSize: "14px", fontStyle: "italic", color: "#888" }}>
                Lệnh sản xuất này chưa được nghiệm thu hoàn công.
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "15px" }}>
              <button type="button" onClick={() => setViewingReceiptOrder(null)} className="secondary" style={{ padding: "8px 20px" }}>
                Đóng lại
              </button>
              {viewingReceiptOrder.status === "IN_PROGRESS" && (
                <button 
                  type="button" 
                  onClick={() => {
                    const order = viewingReceiptOrder;
                    setViewingReceiptOrder(null);
                    handleOpenCompleteModal(order);
                  }} 
                  className="mfg-btn-gold" 
                  style={{ padding: "8px 20px", color: "#000" }}
                >
                  Nghiệm thu hoàn công
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal: Tạo nhanh sản phẩm mới */}
      {showQuickCreateProductModal && (
        <div className="mfg-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="mfg-modal-content" style={{ maxWidth: "800px", width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", color: "#e2b85c", marginBottom: "15px", flexShrink: 0 }}>
              Tạo nhanh Sản Phẩm & Biến Thể để bán lẻ
            </h3>

            <form onSubmit={handleQuickCreateProduct} style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
              <div style={{ overflowY: "auto", paddingRight: "10px", flexGrow: 1, marginBottom: "15px" }}>
                
                <h4 style={{ color: "#e2b85c", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "5px", marginBottom: "12px" }}>1. Thông tin chung</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <label className="mfg-input-label">
                    <span>Tên sản phẩm *</span>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nhẫn Kim Cương Nam H005"
                      value={quickProductForm.name}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, name: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Danh mục bán hàng</span>
                    <select
                      value={quickProductForm.categoryId}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, categoryId: e.target.value })}
                      className="mfg-select"
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parent_name ? `${c.parent_name} > ` : ""}{c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <label className="mfg-input-label">
                    <span>Loại chất liệu *</span>
                    <select
                      value={quickProductForm.materialType}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, materialType: e.target.value })}
                      className="mfg-select"
                    >
                      <option value="Vàng 24K">Vàng 24K</option>
                      <option value="Vàng 18K">Vàng 18K</option>
                      <option value="Vàng trắng 18K">Vàng trắng 18K</option>
                      <option value="Bạc 925">Bạc 925</option>
                      <option value="Bạch kim">Bạch kim</option>
                    </select>
                  </label>
                  <label className="mfg-input-label">
                    <span>Trọng lượng phôi cơ bản (Chỉ)</span>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      value={quickProductForm.baseWeight}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, baseWeight: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Ảnh sản phẩm (URL công khai)</span>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={quickProductForm.mainImageUrl}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, mainImageUrl: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                </div>

                <label className="mfg-input-label" style={{ marginBottom: "20px" }}>
                  <span>Mô tả sản phẩm</span>
                  <textarea
                    rows="2"
                    placeholder="Mô tả tóm tắt về sản phẩm..."
                    value={quickProductForm.description}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, description: e.target.value })}
                    className="mfg-input"
                    style={{ resize: "vertical", fontFamily: "inherit" }}
                  />
                </label>

                <h4 style={{ color: "#e2b85c", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "5px", marginBottom: "12px" }}>2. Cấu hình định giá & Biến thể</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <label className="mfg-input-label">
                    <span>Tiền công chế tác (VND)</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={quickProductForm.laborCost}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, laborCost: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Tiền đá gắn kèm (VND)</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={quickProductForm.stoneCost}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, stoneCost: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Hệ số Markup (Lợi nhuận gộp, VD: 0.2 = 20%)</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.2"
                      value={quickProductForm.markupRate}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, markupRate: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "20px", background: "rgba(226, 184, 92, 0.03)", border: "1px solid rgba(226, 184, 92, 0.1)", padding: "12px", borderRadius: "8px" }}>
                  <label className="mfg-input-label">
                    <span>Mã SKU Biến thể *</span>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: NNS-S10"
                      value={quickProductForm.sku}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, sku: e.target.value.toUpperCase() })}
                      className="mfg-input"
                      style={{ borderColor: "#e2b85c" }}
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Size sản phẩm</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: 10, 11 (bỏ trống nếu Free size)"
                      value={quickProductForm.size}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, size: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Trọng lượng chênh lệch so với bản cơ sở (+/- chỉ)</span>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      value={quickProductForm.weightModifier}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, weightModifier: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                </div>

                <h4 style={{ color: "#e2b85c", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "5px", marginBottom: "12px" }}>3. Thông số kỹ thuật chi tiết (Product Details)</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <label className="mfg-input-label">
                    <span>Chất liệu chính</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Vàng 18K Tây"
                      value={quickProductForm.mainMaterial}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, mainMaterial: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Độ tinh khiết</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: 75% (750)"
                      value={quickProductForm.materialPurity}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, materialPurity: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Màu sắc chủ đạo</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Vàng hồng, Vàng vàng"
                      value={quickProductForm.primaryColor}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, primaryColor: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <label className="mfg-input-label">
                    <span>Đá quý đính kèm chính</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Kim cương thiên nhiên"
                      value={quickProductForm.mainGemstone}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, mainGemstone: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Kích thước đá chính</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Ly, Carat hoặc mm"
                      value={quickProductForm.gemstoneSize}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, gemstoneSize: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Hình dạng cắt của đá</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Tròn, Pear, Marquise"
                      value={quickProductForm.gemstoneShape}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, gemstoneShape: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                  <label className="mfg-input-label">
                    <span>Đá phụ phối kèm</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đá CZ trắng đính kết"
                      value={quickProductForm.sideGemstone}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, sideGemstone: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Đối tượng sử dụng</span>
                    <select
                      value={quickProductForm.gender}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, gender: e.target.value })}
                      className="mfg-select"
                    >
                      <option value="UNISEX">Unisex (Nam & Nữ)</option>
                      <option value="NAM">Nam</option>
                      <option value="NỮ">Nữ</option>
                    </select>
                  </label>
                  <label className="mfg-input-label">
                    <span>Bộ sưu tập</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Luxury Wedding 2026"
                      value={quickProductForm.collection}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, collection: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "10px" }}>
                  <label className="mfg-input-label">
                    <span>Xuất xứ hàng hóa</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: Chế tác thủ công xưởng SG, Nhập khẩu Italy"
                      value={quickProductForm.origin}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, origin: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                  <label className="mfg-input-label">
                    <span>Thời hạn bảo hành (Tháng)</span>
                    <input
                      type="number"
                      placeholder="12"
                      value={quickProductForm.warrantyMonths}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, warrantyMonths: e.target.value })}
                      className="mfg-input"
                    />
                  </label>
                </div>

              </div>

              {quickProductSubmitMessage && (
                <div 
                  className={`mfg-alert ${quickProductSubmitState === "success" ? "success" : "error"}`}
                  style={{ marginBottom: "15px", padding: "10px", borderRadius: "6px", flexShrink: 0 }}
                >
                  {quickProductSubmitMessage}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "15px", flexShrink: 0 }}>
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={() => {
                    setShowQuickCreateProductModal(false);
                    setQuickProductSubmitState("idle");
                    setQuickProductSubmitMessage("");
                  }} 
                  style={{ padding: "8px 16px", cursor: "pointer" }}
                >
                  Đóng lại
                </button>
                <button 
                  type="submit" 
                  disabled={quickProductSubmitState === "submitting"} 
                  style={{ padding: "8px 24px", background: "#e2b85c", color: "#000", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                >
                  {quickProductSubmitState === "submitting" ? "Đang lưu sản phẩm..." : "Lưu & Liên kết ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
}

export default ManufacturingPage;
