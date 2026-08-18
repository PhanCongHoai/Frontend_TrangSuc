import { useEffect, useState, useMemo, useCallback } from "react";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import { formatCurrency } from "../../../utils/pricing";
import "./ManufacturingPage.css"; // Reuse premium mfg card & table styling

const RAW_API = buildApiUrl("/api/raw-materials");

const MATERIAL_CATALOG = {
  GOLD: [
    "Vàng 24K",
    "Vàng 18K",
    "Vàng trắng 18K",
    "Bạc 925",
    "Bạch kim"
  ]
};

const getCategoryForMaterial = (materialType) => {
  const normalized = String(materialType || "").trim();
  for (const [category, items] of Object.entries(MATERIAL_CATALOG)) {
    if (items.includes(normalized)) {
      return category;
    }
  }
  return null;
};

function RawMaterialsPage() {
  const [activeTab, setActiveTab] = useState("in-stock"); // "in-stock" or "receipts"
  const [inStockMaterials, setInStockMaterials] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  // Form states for creating raw receipt
  const [supplierName, setSupplierName] = useState("");
  const [importDate, setImportDate] = useState("");
  const [items, setItems] = useState([
    {
      lot_id: "",
      material_type: "Vàng 24K",
      category: "GOLD",
      weight: "",
      weight_unit: "Chỉ",
      purity: "0.999",
      gem_size: "",
      gem_shape: "",
      quantity: "",
      unit_cost: "",
    },
  ]);
  const [formSubmitState, setFormSubmitState] = useState("idle"); // "idle", "submitting", "success", "error"
  const [formSubmitMessage, setFormSubmitMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");
      
      const inStockRes = await fetch(`${RAW_API}/in-stock`, {
        headers: getAuthHeaders(),
      });
      const receiptsRes = await fetch(RAW_API, {
        headers: getAuthHeaders(),
      });

      if (inStockRes.status === 401 || receiptsRes.status === 401) {
        clearAuthSession();
        window.location.href = "/login";
        return;
      }

      const inStockData = await inStockRes.json();
      const receiptsData = await receiptsRes.json();

      if (inStockData.success && receiptsData.success) {
        setInStockMaterials(inStockData.data);
        setReceipts(receiptsData.data);
        setStatus("success");
      } else {
        throw new Error("Không thể tải thông tin từ server.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError(err.message || "Lỗi tải thông tin.");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        lot_id: "",
        material_type: "Vàng 24K",
        category: "GOLD",
        weight: "",
        weight_unit: "Chỉ",
        purity: "0.999",
        gem_size: "",
        gem_shape: "",
        quantity: "",
        unit_cost: "",
      },
    ]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      
      // Tự động nhận diện category và điều chỉnh cấu hình tương ứng
      if (field === "material_type") {
        const detectedCategory = getCategoryForMaterial(value);
        if (detectedCategory) {
          const prevCategory = next[index].category;
          next[index].category = detectedCategory;
          
          if (detectedCategory !== prevCategory) {
            if (detectedCategory === "GOLD") {
              next[index].weight_unit = "Chỉ";
              next[index].purity = value === "Vàng 24K" ? "0.999" : "0.750";
              next[index].gem_size = "";
              next[index].gem_shape = "";
              next[index].quantity = "";
            } else if (detectedCategory === "GEMSTONE") {
              next[index].weight_unit = "Carat";
              next[index].purity = "";
              next[index].gem_size = "4.5";
              next[index].gem_shape = "Tròn";
              next[index].quantity = "1";
            } else { // MOLD
              next[index].weight_unit = "Gram";
              next[index].purity = "";
              next[index].gem_size = "";
              next[index].gem_shape = "";
              next[index].quantity = "1";
            }
          } else if (detectedCategory === "GOLD") {
            // Cập nhật lại tuổi vàng (purity) tùy theo vàng 24k hay 18k
            next[index].purity = value === "Vàng 24K" ? "0.999" : "0.750";
          }
        }
      }
      return next;
    });
  };

  const handleSubmitReceipt = async (e) => {
    e.preventDefault();
    setFormSubmitState("submitting");
    setFormSubmitMessage("");

    // Basic validation
    if (!supplierName.trim()) {
      setFormSubmitState("error");
      setFormSubmitMessage("Vui lòng nhập tên nhà cung cấp.");
      return;
    }
    if (supplierName.trim().length > 250) {
      setFormSubmitState("error");
      setFormSubmitMessage("Tên nhà cung cấp không được vượt quá 250 ký tự.");
      return;
    }

    const lotIds = items.map((i) => i.lot_id.trim());
    const uniqueLotIds = new Set(lotIds);
    if (uniqueLotIds.size !== lotIds.length) {
      setFormSubmitState("error");
      setFormSubmitMessage("Có mã Lô (Lot ID) bị trùng lặp trong danh sách nguyên liệu nhập.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.lot_id.trim()) {
        setFormSubmitState("error");
        setFormSubmitMessage(`Mục thứ ${i + 1}: Lot ID không được để trống.`);
        return;
      }
      if (item.lot_id.trim().length > 50) {
        setFormSubmitState("error");
        setFormSubmitMessage(`Mục thứ ${i + 1}: Mã Lô (Lot ID) không được vượt quá 50 ký tự.`);
        return;
      }
      if (isNaN(item.weight) || Number(item.weight) <= 0) {
        setFormSubmitState("error");
        setFormSubmitMessage(`Mục thứ ${i + 1}: Khối lượng phải là số lớn hơn 0.`);
        return;
      }
      if (isNaN(item.unit_cost) || Number(item.unit_cost) <= 0) {
        setFormSubmitState("error");
        setFormSubmitMessage(`Mục thứ ${i + 1}: Giá vốn phải là số lớn hơn 0.`);
        return;
      }
    }

    try {
      const res = await fetch(`${RAW_API}/receipts`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplier_name: supplierName,
          import_date: importDate || undefined,
          items: items.map((i) => ({
            lot_id: i.lot_id,
            material_type: i.material_type,
            category: i.category,
            weight: Number(i.weight),
            weight_unit: i.weight_unit,
            purity: i.purity || null,
            gem_size: i.gem_size ? Number(i.gem_size) : null,
            gem_shape: i.gem_shape || null,
            quantity: i.quantity ? Number(i.quantity) : null,
            unit_cost: Number(i.unit_cost),
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormSubmitState("success");
        setFormSubmitMessage(`Nhập kho thành công! Mã phiếu: ${data.receiptCode}`);
        setSupplierName("");
        setImportDate("");
        setItems([
          {
            lot_id: "",
            material_type: "Vàng 24K",
            category: "GOLD",
            weight: "",
            weight_unit: "Chỉ",
            purity: "0.999",
            gem_size: "",
            gem_shape: "",
            quantity: "",
            unit_cost: "",
          },
        ]);
        loadData();
      } else {
        throw new Error(data.message || "Lỗi tạo phiếu nhập kho.");
      }
    } catch (err) {
      setFormSubmitState("error");
      setFormSubmitMessage(err.message);
    }
  };

  const getCategoryLabel = (category) => {
    if (category === "GOLD") return "Vàng phôi";
    if (category === "GEMSTONE") return "Đá quý";
    return "Phôi đúc sẵn";
  };

  const summary = useMemo(() => {
    let totalLots = inStockMaterials.length;
    let gold24kWeight = 0;
    let gold18kWeight = 0;
    let whiteGold18kWeight = 0;
    let silverWeight = 0;
    let platinumWeight = 0;

    inStockMaterials.forEach((m) => {
      const w = Number(m.weight || 0);
      if (m.materialType === "Vàng 24K") {
        gold24kWeight += w;
      } else if (m.materialType === "Vàng 18K") {
        gold18kWeight += w;
      } else if (m.materialType === "Vàng trắng 18K") {
        whiteGold18kWeight += w;
      } else if (m.materialType === "Bạc 925") {
        silverWeight += w;
      } else if (m.materialType === "Bạch kim") {
        platinumWeight += w;
      }
    });

    return {
      totalLots,
      gold24kWeight: Math.round(gold24kWeight * 10000) / 10000,
      gold18kWeight: Math.round(gold18kWeight * 10000) / 10000,
      whiteGold18kWeight: Math.round(whiteGold18kWeight * 10000) / 10000,
      silverWeight: Math.round(silverWeight * 10000) / 10000,
      platinumWeight: Math.round(platinumWeight * 10000) / 10000,
    };
  }, [inStockMaterials]);

  return (
    <section className="panel-page mfg-container">
      <div className="page-head" style={{ marginBottom: "20px" }}>
        <h1 style={{ color: "#fff", fontWeight: "700" }}>Kho nguyên liệu phôi thô (Khâu 1)</h1>
        <div className="mfg-tabs-container">
          <button
            type="button"
            className={`mfg-tab-btn ${activeTab === "in-stock" ? "active" : ""}`}
            onClick={() => setActiveTab("in-stock")}
          >
            Tồn kho nguyên liệu hiện tại
          </button>
          <button
            type="button"
            className={`mfg-tab-btn ${activeTab === "receipts" ? "active" : ""}`}
            onClick={() => setActiveTab("receipts")}
          >
            Lịch sử & Nhập kho phôi
          </button>
        </div>
      </div>

      <div className="product-summary-grid" style={{ marginBottom: "25px", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px" }}>
        <article className="mfg-card" style={{ padding: "12px 15px !important", display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#aaa" }}>Tổng số lô</span>
          <strong style={{ fontSize: "20px", color: "#e2b85c" }}>{summary.totalLots} Lô</strong>
        </article>
        <article className="mfg-card" style={{ padding: "12px 15px !important", display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#aaa" }}>Vàng 24K</span>
          <strong style={{ fontSize: "20px", color: "#e2b85c" }}>{summary.gold24kWeight} Chỉ</strong>
        </article>
        <article className="mfg-card" style={{ padding: "12px 15px !important", display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#aaa" }}>Vàng 18K</span>
          <strong style={{ fontSize: "20px", color: "#e2b85c" }}>{summary.gold18kWeight} Chỉ</strong>
        </article>
        <article className="mfg-card" style={{ padding: "12px 15px !important", display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#aaa" }}>Vàng trắng 18K</span>
          <strong style={{ fontSize: "20px", color: "#e2b85c" }}>{summary.whiteGold18kWeight} Chỉ</strong>
        </article>
        <article className="mfg-card" style={{ padding: "12px 15px !important", display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#aaa" }}>Bạc 925</span>
          <strong style={{ fontSize: "20px", color: "#e2b85c" }}>{summary.silverWeight} Chỉ</strong>
        </article>
        <article className="mfg-card" style={{ padding: "12px 15px !important", display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "12px", color: "#aaa" }}>Bạch kim</span>
          <strong style={{ fontSize: "20px", color: "#e2b85c" }}>{summary.platinumWeight} Chỉ</strong>
        </article>
      </div>

      {status === "loading" && (
        <div style={{ padding: "20px", textAlign: "center", color: "#aaa" }}>Đang tải dữ liệu kho phôi...</div>
      )}

      {status === "error" && (
        <div className="admin-notice admin-notice-error" style={{ padding: "15px", marginBottom: "20px" }}>
          <strong>Lỗi xảy ra:</strong>
          <p>{error}</p>
        </div>
      )}

      {status === "success" && activeTab === "in-stock" && (
        <section className="mfg-card">
          <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ color: "#e2b85c", margin: 0 }}>Bảng tồn kho phôi chuẩn sạch (Sẵn sàng chế tác)</h3>
            <button type="button" onClick={loadData} className="mfg-tab-btn active" style={{ padding: "6px 12px", fontSize: "12px" }}>Làm mới</button>
          </div>

          {inStockMaterials.length === 0 ? (
            <div className="admin-notice" style={{ padding: "20px", textAlign: "center" }}>
              <strong>Kho phôi trống rỗng!</strong>
              <p>Vui lòng chuyển qua tab "Lịch sử & Nhập kho phôi" để nhập lô phôi nguyên liệu đầu tiên.</p>
            </div>
          ) : (
            <div className="mfg-table-wrap">
              <table className="mfg-table">
                <thead>
                  <tr>
                    <th>Lot ID</th>
                    <th>Chất liệu / Tên phôi</th>
                    <th>Phân loại</th>
                    <th>Tuổi vàng / Quy cách</th>
                    <th>Định lượng phôi</th>
                    <th>Đơn giá vốn</th>
                    <th>Tổng giá trị</th>
                    <th>Mã phiếu nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {inStockMaterials.map((item) => (
                    <tr key={item.id}>
                      <td><span style={{ fontWeight: "bold", color: "#e2b85c" }}>{item.lotId}</span></td>
                      <td>{item.materialType}</td>
                      <td>{getCategoryLabel(item.category)}</td>
                      <td>
                        {item.category === "GOLD" && <span>{item.purity}</span>}
                        {item.category === "GEMSTONE" && <span>Size: {item.gemSize} li, {item.gemShape}</span>}
                        {item.category === "MOLD" && <span>Phôi đúc thô</span>}
                      </td>
                      <td>
                        <span style={{ fontWeight: "bold" }}>
                          {item.weight} {item.weightUnit}
                        </span>
                        {item.quantity && <span> ({item.quantity} hạt/phôi)</span>}
                      </td>
                      <td>{formatCurrency(item.unitCost)} / {item.category === "GOLD" ? "Chỉ" : "Viên"}</td>
                      <td><span style={{ color: "#2ebd7f" }}>{formatCurrency(item.totalCost)}</span></td>
                      <td>{item.receiptCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {status === "success" && activeTab === "receipts" && (
        <div className="products-admin-layout" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "25px" }}>
          
          {/* Form để tạo Phiếu nhập kho phôi mới */}
          <section className="mfg-card">
            <div className="section-title" style={{ marginBottom: "15px" }}>
              <h3 style={{ color: "#e2b85c", margin: 0 }}>Tạo Phiếu Nhập Kho Phôi Mới</h3>
            </div>
            
            <form onSubmit={handleSubmitReceipt}>
              <div className="product-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <label className="mfg-input-label">
                  <span>Nhà cung cấp / Nguồn gốc</span>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Nhập tên nhà cung cấp..."
                    className="mfg-input"
                  />
                </label>
                <label className="mfg-input-label">
                  <span>Ngày nhập kho</span>
                  <input
                    type="datetime-local"
                    value={importDate}
                    onChange={(e) => setImportDate(e.target.value)}
                    className="mfg-input"
                  />
                </label>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "15px", marginBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, color: "#e2b85c" }}>Danh sách nguyên liệu định lượng</h4>
                  <button type="button" onClick={handleAddItemRow} className="mfg-tab-btn active" style={{ padding: "6px 12px", fontSize: "12px" }}>
                    + Thêm dòng phôi
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="mfg-lot-container">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <strong style={{ color: "#e2b85c" }}>Nguyên liệu thô #{idx + 1}</strong>
                      {items.length > 1 && (
                        <button type="button" onClick={() => handleRemoveItemRow(idx)} style={{ color: "#ff6b6b", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                          Xóa dòng
                        </button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "10px", marginBottom: "10px" }}>
                      <label className="mfg-input-label">
                        <span>Tên nguyên liệu</span>
                        <select
                          value={item.material_type}
                          onChange={(e) => handleItemChange(idx, "material_type", e.target.value)}
                          className="mfg-select"
                        >
                          {Object.values(MATERIAL_CATALOG).flat().map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mfg-input-label">
                        <span>Mã Lô (Lot ID)</span>
                        <input
                          type="text"
                          required
                          value={item.lot_id}
                          onChange={(e) => handleItemChange(idx, "lot_id", e.target.value)}
                          placeholder="Mã lô duy nhất..."
                          className="mfg-input"
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr", gap: "10px" }}>
                      <label className="mfg-input-label">
                        <span>Khối lượng cân</span>
                        <input
                          type="number"
                          step="0.0001"
                          required
                          value={item.weight}
                          onChange={(e) => handleItemChange(idx, "weight", e.target.value)}
                          placeholder="Khối lượng..."
                          className="mfg-input"
                        />
                      </label>
                      <label className="mfg-input-label">
                        <span>Đơn vị đo</span>
                        <select
                          value={item.weight_unit}
                          onChange={(e) => handleItemChange(idx, "weight_unit", e.target.value)}
                          className="mfg-select"
                        >
                          <option value="Chỉ">Chỉ</option>
                          <option value="Gram">Gram</option>
                          <option value="Carat">Carat</option>
                          <option value="Ly">Ly</option>
                        </select>
                      </label>
                      <label className="mfg-input-label">
                        <span>Số lượng hạt</span>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          placeholder="Mảnh/hạt (nếu có)"
                          disabled={item.category === "GOLD"}
                          className="mfg-input"
                        />
                      </label>
                      <label className="mfg-input-label">
                        <span>Giá vốn/đơn vị (VND)</span>
                        <input
                          type="number"
                          required
                          value={item.unit_cost}
                          onChange={(e) => handleItemChange(idx, "unit_cost", e.target.value)}
                          placeholder="Giá vốn..."
                          className="mfg-input"
                        />
                      </label>
                    </div>

                    {item.category === "GOLD" && (
                      <div style={{ marginTop: "10px" }}>
                        <label className="mfg-input-label">
                          <span>Độ tinh khiết (Tuổi vàng)</span>
                          <input
                            type="text"
                            value={item.purity}
                            onChange={(e) => handleItemChange(idx, "purity", e.target.value)}
                            placeholder="Ví dụ: 0.750, 0.999"
                            className="mfg-input"
                          />
                        </label>
                      </div>
                    )}

                    {item.category === "GEMSTONE" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                        <label className="mfg-input-label">
                          <span>Kích thước đá (li)</span>
                          <input
                            type="text"
                            value={item.gem_size}
                            onChange={(e) => handleItemChange(idx, "gem_size", e.target.value)}
                            placeholder="Ví dụ: 4.5, 6.0"
                            className="mfg-input"
                          />
                        </label>
                        <label className="mfg-input-label">
                          <span>Hình dạng đá</span>
                          <input
                            type="text"
                            value={item.gem_shape}
                            onChange={(e) => handleItemChange(idx, "gem_shape", e.target.value)}
                            placeholder="Ví dụ: Tròn, Oval, Giọt nước..."
                            className="mfg-input"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

                {formSubmitMessage && (
                  <div className={`category-form-message ${formSubmitState === "success" ? "success" : "error"}`} style={{ padding: "10px", borderRadius: "5px", marginBottom: "15px", textAlign: "center" }}>
                    {formSubmitMessage}
                  </div>
                )}

                <div className="category-form-actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="submit" disabled={formSubmitState === "submitting"} className="mfg-btn-green">
                  {formSubmitState === "submitting" ? "Đang lưu phiếu..." : "Xác nhận nhập kho"}
                </button>
              </div>
            </form>
          </section>

          {/* Danh sách lịch sử Phiếu nhập kho nguyên liệu */}
          <section className="mfg-card">
            <div className="section-title" style={{ marginBottom: "15px" }}>
              <h3 style={{ color: "#e2b85c", margin: 0 }}>Lịch sử phiếu nhập kho phôi</h3>
            </div>

            {receipts.length === 0 ? (
              <p style={{ textAlign: "center", padding: "20px", color: "#aaa" }}>Chưa có phiếu nhập kho nào được tạo.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {receipts.map((rec) => (
                  <article 
                    key={rec.id} 
                    className="mfg-wo-article"
                    onClick={() => setSelectedReceipt(rec)}
                    style={{ cursor: "pointer", transition: "all 0.2s" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px", marginBottom: "10px" }}>
                      <strong style={{ color: "#e2b85c" }}>Mã phiếu: {rec.receiptCode}</strong>
                      <span style={{ fontSize: "13px", color: "#aaa" }}>
                        Ngày nhập: {new Date(rec.importDate).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <p style={{ fontSize: "14px", margin: "0 0 10px 0", color: "#ccc" }}>
                      Nhà cung cấp: <span style={{ fontWeight: "bold", color: "#fff" }}>{rec.supplierName || "Không rõ"}</span> | Người nhận: {rec.creatorName}
                    </p>
                    <div style={{ fontSize: "13px", color: "#ddd" }}>
                      <strong style={{ color: "#e2b85c" }}>Các lô phôi nguyên liệu trong phiếu:</strong>
                      <ul style={{ paddingLeft: "20px", margin: "5px 0 0 0", color: "#ccc" }}>
                        {rec.items.map((i) => (
                          <li key={i.id} style={{ marginBottom: "4px" }}>
                            Lot ID: <span style={{ color: "#e2b85c", fontWeight: "bold" }}>{i.lotId}</span> - {i.materialType} | Cân định lượng: <span style={{ fontWeight: "bold", color: "#fff" }}>{i.weight} {i.weightUnit}</span> | Giá vốn: {formatCurrency(i.totalCost)} (Trạng thái: <span style={{ fontWeight: "bold", color: i.status === 'IN_STOCK' ? '#2ebd7f' : i.status === 'HANDED_OVER' ? '#e2b85c' : '#ff6b6b' }}>{i.status === 'IN_STOCK' ? 'Trong kho' : i.status === 'HANDED_OVER' ? 'Giao thợ' : 'Đã sử dụng'}</span>)
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "12px", color: "#e2b85c", fontWeight: "bold", textDecoration: "underline" }}>Xem chi tiết & lịch sử thợ nhận phôi →</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal: Chi tiết phiếu nhập kho phôi & Lịch sử bàn giao */}
      {selectedReceipt && (
        <div className="mfg-modal-overlay">
          <div className="mfg-modal-content" style={{ maxWidth: "700px", width: "90%" }}>
            <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "15px", color: "#e2b85c" }}>
              Chi tiết Phiếu Nhập Kho: {selectedReceipt.receiptCode}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px", fontSize: "14px", color: "#ccc" }}>
              <div>Nhà cung cấp: <strong style={{ color: "#fff" }}>{selectedReceipt.supplierName || "Không rõ"}</strong></div>
              <div>Ngày nhập kho: <strong style={{ color: "#fff" }}>{new Date(selectedReceipt.importDate).toLocaleString("vi-VN")}</strong></div>
              <div>Người lập phiếu: <strong style={{ color: "#fff" }}>{selectedReceipt.creatorName}</strong></div>
            </div>

            <h4 style={{ color: "#e2b85c", marginBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "6px" }}>Danh sách Lô nguyên liệu nhập</h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", maxHeight: "400px", overflowY: "auto", paddingRight: "5px" }}>
              {selectedReceipt.items.map((i) => (
                <div key={i.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong>Lot ID: <span style={{ color: "#e2b85c" }}>{i.lotId}</span> ({i.materialType})</strong>
                    <span className={`mfg-status-badge ${i.status === 'IN_STOCK' ? 'active' : i.status === 'HANDED_OVER' ? 'progress' : 'completed'}`} style={{ fontSize: "12px", padding: "3px 8px" }}>
                      {i.status === 'IN_STOCK' ? 'Trong kho' : i.status === 'HANDED_OVER' ? 'Đã giao thợ' : 'Đã sử dụng'}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", fontSize: "13px", color: "#bbb", marginBottom: "10px" }}>
                    <div>Khối lượng: <strong style={{ color: "#fff" }}>{i.weight} {i.weightUnit}</strong></div>
                    {i.purity && <div>Tuổi vàng: <strong style={{ color: "#fff" }}>{i.purity}</strong></div>}
                    <div>Thành tiền: <strong style={{ color: "#fff" }}>{formatCurrency(i.totalCost)}</strong></div>
                  </div>

                  {/* Phần hiển thị Giao nhiệm vụ cho thợ nếu có */}
                  {i.workOrders && i.workOrders.length > 0 ? (
                    <div style={{ marginTop: "10px", background: "rgba(226, 184, 92, 0.05)", border: "1px solid rgba(226, 184, 92, 0.15)", borderRadius: "6px", padding: "10px" }}>
                      <strong style={{ color: "#e2b85c", fontSize: "12px", display: "block", marginBottom: "5px" }}>
                        🛠️ Thông tin Giao nhiệm vụ cho Thợ:
                      </strong>
                      {i.workOrders.map((wo) => (
                        <div key={wo.id} style={{ fontSize: "12px", color: "#ccc", display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div>Mã Lệnh chế tác: <strong style={{ color: "#fff" }}>{wo.workOrderCode}</strong></div>
                          <div>Thợ chế tác: <strong style={{ color: "#fff" }}>{wo.jewelerName} ({wo.jewelerCode})</strong></div>
                          <div>Sản phẩm dự kiến: <strong style={{ color: "#fff" }}>{wo.expectedProductName}</strong> (Số lượng: {wo.quantityExpected})</div>
                          <div style={{ marginTop: "4px" }}>
                            Trạng thái lệnh:{" "}
                            <span style={{ fontWeight: "bold", color: wo.status === 'COMPLETED' ? '#2ebd7f' : '#e2b85c' }}>
                              {wo.status === 'COMPLETED' ? 'Đã nghiệm thu (QC Passed)' : 'Đang sản xuất chế tác'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: "5px", fontStyle: "italic", fontSize: "12px", color: "#888" }}>
                      Chưa bàn giao lệnh chế tác nào từ lô phôi này.
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
              <button type="button" onClick={() => setSelectedReceipt(null)} style={{ padding: "8px 24px", background: "#444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default RawMaterialsPage;
