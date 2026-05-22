import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import { notifyProductCatalogChanged } from "../../../utils/productSync";

const initialForm = {
  materialType: "Vàng 24K",
  baseSellPrice: "",
};

const MATERIAL_OPTIONS = [
  "Vàng 24K",
  "Vàng 18K",
  "Vàng trắng 18K",
  "Bạc 925",
  "Bạch kim",
];

const MAX_PRICE_DIGITS = 13;
const HISTORY_PAGE_SIZE = 5;

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const rawValue = String(value);
  const sqlDateTimeMatch = rawValue.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );

  if (sqlDateTimeMatch) {
    const [, year, month, day, hour, minute, second] = sqlDateTimeMatch;
    return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizePriceInput(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function parseBaseSellPrice(value) {
  const normalized = normalizePriceInput(value);

  if (!normalized) {
    return { valid: false, message: "Vui lòng nhập giá cơ bản." };
  }

  if (/^-/.test(normalized)) {
    return { valid: false, message: "Giá cơ bản không được là số âm." };
  }

  if (!/^[\d.,]+$/.test(normalized)) {
    return {
      valid: false,
      message: "Giá cơ bản chỉ được chứa chữ số và dấu phân cách.",
    };
  }

  if (/[.,]{2,}/.test(normalized) || /[.,]$/.test(normalized) || /^[.,]/.test(normalized)) {
    return { valid: false, message: "Định dạng giá cơ bản không hợp lệ." };
  }

  const digitsOnly = normalized.replace(/[.,]/g, "");

  if (!digitsOnly) {
    return { valid: false, message: "Giá cơ bản không hợp lệ." };
  }

  if (!/^\d+$/.test(digitsOnly)) {
    return { valid: false, message: "Giá cơ bản phải là một số hợp lệ." };
  }

  if (digitsOnly.length > MAX_PRICE_DIGITS) {
    return { valid: false, message: "Giá cơ bản quá lớn." };
  }

  const parsedValue = Number(digitsOnly);

  if (!Number.isSafeInteger(parsedValue)) {
    return { valid: false, message: "Giá cơ bản vượt quá giới hạn xử lý." };
  }

  if (parsedValue <= 0) {
    return { valid: false, message: "Giá cơ bản phải lớn hơn 0." };
  }

  return { valid: true, value: parsedValue };
}

function GoldRatesPage() {
  const navigate = useNavigate();
  const [goldRates, setGoldRates] = useState([]);
  const [currentRateRecords, setCurrentRateRecords] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const loadGoldRates = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");

      const response = await fetch(buildApiUrl("/api/gold-rates"), {
        headers: getAuthHeaders(),
      });

      const rawResponse = await response.text();
      let data = null;

      try {
        data = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        throw new Error("Backend không trả về JSON hợp lệ từ API /api/gold-rates.");
      }

      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        navigate("/login", {
          replace: true,
          state: { from: "/admin/gold-rates", adminOnly: true },
        });
        throw new Error("Phiên đăng nhập admin đã hết hạn hoặc không còn quyền truy cập. Vui lòng đăng nhập lại.");
      }

      if (!response.ok) {
        throw new Error(data?.message || `API /api/gold-rates trả về lỗi ${response.status}.`);
      }

      if (!data.success || !Array.isArray(data.goldRates)) {
        throw new Error("Dữ liệu giá vàng và bạc từ backend không đúng định dạng.");
      }

      setGoldRates(data.goldRates);
      setCurrentRateRecords(Array.isArray(data.currentRates) ? data.currentRates : []);
      setStatus("connected");
    } catch (fetchError) {
      console.error("Fetch gold rates error:", fetchError);
      setGoldRates([]);
      setCurrentRateRecords([]);
      setStatus("error");
      setError(fetchError.message || "Không thể tải dữ liệu giá vàng và bạc từ backend.");
    }
  }, [navigate]);

  useEffect(() => {
    loadGoldRates();
  }, [loadGoldRates]);

  const summary = useMemo(() => {
    const latestByMaterial = goldRates.reduce((acc, item) => {
      if (!acc[item.material_type]) {
        acc[item.material_type] = item;
      }
      return acc;
    }, {});

    const materials = Object.keys(latestByMaterial);
    const latestRecord = goldRates[0] || null;

    return {
      totalRecords: goldRates.length,
      totalMaterials: materials.length,
      latestRecord,
    };
  }, [goldRates]);

  const currentRates = useMemo(() => {
    if (currentRateRecords.length) {
      return currentRateRecords;
    }

    const grouped = goldRates.reduce((acc, item) => {
      if (!acc[item.material_type]) {
        acc[item.material_type] = item;
      }
      return acc;
    }, {});

    return Object.values(grouped);
  }, [currentRateRecords, goldRates]);

  const totalHistoryPages = useMemo(
    () => Math.max(1, Math.ceil(goldRates.length / HISTORY_PAGE_SIZE)),
    [goldRates]
  );

  const paginatedGoldRates = useMemo(() => {
    const startIndex = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return goldRates.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
  }, [goldRates, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [goldRates]);

  const handleChangeForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  const resetForm = (clearMessage = true) => {
    setForm(initialForm);
    setFieldErrors({});

    if (clearMessage) {
      setSubmitState("idle");
      setSubmitMessage("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextFieldErrors = {};

    if (!form.materialType.trim()) {
      nextFieldErrors.materialType = "Vui lòng chọn chất liệu.";
    }

    const priceValidation = parseBaseSellPrice(form.baseSellPrice);

    if (!priceValidation.valid) {
      nextFieldErrors.baseSellPrice = priceValidation.message;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setSubmitState("error");
      setSubmitMessage("Dữ liệu nhập vào không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    try {
      setSubmitState("submitting");
      setSubmitMessage("");
      setFieldErrors({});

      const response = await fetch(buildApiUrl("/api/gold-rates"), {
        method: "POST",
        headers: {
          ...getAuthHeaders({
            "Content-Type": "application/json",
          }),
        },
        body: JSON.stringify({
          material_type: form.materialType.trim(),
          base_sell_price: priceValidation.value,
        }),
      });

      const rawResponse = await response.text();
      let data = null;

      try {
        data = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        throw new Error("Backend không trả về JSON hợp lệ. Kiểm tra lại API giá vàng và bạc.");
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể thêm giá vàng và bạc.");
      }

      setSubmitState("success");
      setSubmitMessage("Đã thêm bản ghi giá vàng và bạc thành công.");
      resetForm(false);
      await loadGoldRates();
      notifyProductCatalogChanged("gold-rate-updated", null);
    } catch (submitError) {
      console.error("Create gold rate error:", submitError);
      setSubmitState("error");
      setSubmitMessage(submitError.message || "Không thể thêm giá vàng và bạc.");
    }
  };

  return (
    <section className="panel-page">
      <div className="page-head">
        <h1>Quản lý giá vàng và bạc</h1>
      </div>

      <div className="product-summary-grid">
        <article className="category-summary-card">
          <span>Tổng bản ghi</span>
          <strong>{summary.totalRecords}</strong>
        </article>
        <article className="category-summary-card">
          <span>Số chất liệu</span>
          <strong>{summary.totalMaterials}</strong>
        </article>
        <article className="category-summary-card">
          <span>Bản ghi mới nhất</span>
          <strong>{summary.latestRecord?.material_type || "-"}</strong>
        </article>
        <article className="category-summary-card">
          <span>Giá mới nhất</span>
          <strong>
            {summary.latestRecord
              ? formatCurrency(summary.latestRecord.base_sell_price)
              : "-"}
          </strong>
        </article>
      </div>

      {status === "error" ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể lấy dữ liệu giá vàng và bạc.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="products-admin-layout">
        <section className="product-form-panel">
          <div className="section-title">
            <h3>Thêm giá vàng và bạc</h3>
          </div>

          <form className="product-form" onSubmit={handleSubmit}>
            <div className="product-form-grid">
              <label className="category-form-field">
                <span>Chất liệu</span>
                <select
                  value={form.materialType}
                  onChange={(event) => handleChangeForm("materialType", event.target.value)}
                >
                  {MATERIAL_OPTIONS.map((material) => (
                    <option key={material} value={material}>
                      {material}
                    </option>
                  ))}
                </select>
                <div className="field-feedback">
                  {fieldErrors.materialType ? (
                    <small className="field-error">{fieldErrors.materialType}</small>
                  ) : (
                    <small className="field-hint field-hint-empty">.</small>
                  )}
                </div>
              </label>

              <label className="category-form-field">
                <span>Giá bán cơ bản</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.baseSellPrice}
                  onChange={(event) => handleChangeForm("baseSellPrice", event.target.value)}
                  onBlur={() => {
                    const validation = parseBaseSellPrice(form.baseSellPrice);
                    setFieldErrors((prev) => ({
                      ...prev,
                      baseSellPrice: validation.valid ? "" : validation.message,
                    }));
                  }}
                  placeholder="VD: 8.450.000"
                />
                <div className="field-feedback">
                  {fieldErrors.baseSellPrice ? (
                    <small className="field-error">{fieldErrors.baseSellPrice}</small>
                  ) : (
                    <small className="field-hint">
                      Cho phép nhập `8450000`, `8.450.000` hoặc `8,450,000`.
                    </small>
                  )}
                </div>
              </label>
            </div>

            {submitMessage ? (
              <div
                className={`category-form-message ${
                  submitState === "success" ? "success" : "error"
                }`}
              >
                {submitMessage}
              </div>
            ) : null}

            <div className="category-form-actions">
              <button type="button" className="secondary" onClick={() => resetForm()}>
                Xóa dữ liệu
              </button>
              <button type="submit" disabled={submitState === "submitting"}>
                {submitState === "submitting" ? "Đang lưu..." : "Lưu bảng giá"}
              </button>
            </div>
          </form>
        </section>

        <section className="product-list-panel">
          <div className="section-title">
            <h3>Bảng giá hiện tại</h3>
            <button type="button" onClick={loadGoldRates}>
              Làm mới
            </button>
          </div>

          {status === "connected" && goldRates.length === 0 ? (
            <div className="admin-notice">
              <strong>Chưa có dữ liệu giá vàng và bạc.</strong>
              <p>Hãy thêm bản ghi đầu tiên vào bảng gold_rate_history.</p>
            </div>
          ) : null}

          {currentRates.length > 0 ? (
            <div className="gold-current-grid">
              {currentRates.map((item) => (
                <article key={item.material_type} className="gold-current-card">
                  <span className="gold-current-label">{item.material_type}</span>
                  <strong>{formatCurrency(item.base_sell_price)}</strong>
                  <p>Cập nhật: {formatDateTime(item.recorded_at_text || item.recorded_at)}</p>
                </article>
              ))}
            </div>
          ) : null}

          <div className="section-title gold-history-head">
            <h3>Lịch sử giá vàng và bạc</h3>
          </div>

          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Chất liệu</th>
                  <th>Giá cơ bản</th>
                  <th>Thời điểm ghi nhận</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGoldRates.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>{item.material_type}</td>
                    <td>{formatCurrency(item.base_sell_price)}</td>
                    <td>{formatDateTime(item.recorded_at_text || item.recorded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {goldRates.length > HISTORY_PAGE_SIZE ? (
            <div className="pagination-bar">
              <button
                type="button"
                className="pagination-button"
                onClick={() => setHistoryPage((prev) => Math.max(prev - 1, 1))}
                disabled={historyPage === 1}
              >
                Truoc
              </button>

              <div className="pagination-pages">
                {Array.from({ length: totalHistoryPages }, (_, index) => {
                  const pageNumber = index + 1;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`pagination-page ${
                        historyPage === pageNumber ? "active" : ""
                      }`}
                      onClick={() => setHistoryPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="pagination-button"
                onClick={() =>
                  setHistoryPage((prev) => Math.min(prev + 1, totalHistoryPages))
                }
                disabled={historyPage === totalHistoryPages}
              >
                Sau
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export default GoldRatesPage;
