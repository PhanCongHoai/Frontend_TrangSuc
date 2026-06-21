import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import ConfirmModal from "../components/ConfirmModal";

const initialFormState = {
  name: "",
  level: "parent",
  parentId: "",
};

function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialFormState);
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
  });

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev.message === message ? { type: "", message: "" } : prev));
    }, 4000);
  };

  const loadCategories = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");

      const response = await fetch(buildApiUrl("/api/categories?all=true"), {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.categories)) {
        throw new Error("Invalid categories payload");
      }

      setCategories(data.categories);
      setStatus("connected");
    } catch (fetchError) {
      console.error("Fetch admin categories error:", fetchError);
      setCategories([]);
      setStatus("error");
      setError("Không thể tải danh mục từ backend. Kiểm tra API /api/categories.");
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const { parentCategories, childrenByParent } = useMemo(() => {
    const parents = categories.filter((item) => item.parent_id === null);
    const childrenMap = categories
      .filter((item) => item.parent_id !== null)
      .reduce((acc, item) => {
        const key = item.parent_id;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {});

    return {
      parentCategories: parents,
      childrenByParent: childrenMap,
    };
  }, [categories]);

  const totalChildren = categories.filter((item) => item.parent_id !== null).length;
  const orphanParents = parentCategories.filter(
    (parent) => !childrenByParent[parent.id]?.length
  ).length;

  const resetForm = () => {
    setForm(initialFormState);
    setSubmitState("idle");
    setSubmitMessage("");
  };

  const closeForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const handleChangeForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "level" && value === "parent" ? { parentId: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setSubmitState("error");
      setSubmitMessage("Vui lòng nhập tên danh mục.");
      return;
    }

    if (form.level === "child" && !form.parentId) {
      setSubmitState("error");
      setSubmitMessage("Vui lòng chọn danh mục cha.");
      return;
    }

    try {
      setSubmitState("submitting");
      setSubmitMessage("");

      const response = await fetch(buildApiUrl("/api/categories"), {
        method: "POST",
        headers: {
          ...getAuthHeaders({
            "Content-Type": "application/json",
          }),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          parent_id: form.level === "parent" ? null : Number(form.parentId),
        }),
      });

      const rawResponse = await response.text();
      let data = null;

      try {
        data = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        throw new Error(
          "Backend không trả về JSON hợp lệ. Hãy kiểm tra API hoặc khởi động lại backend."
        );
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể thêm danh mục.");
      }

      setSubmitState("success");
      setSubmitMessage("Đã thêm danh mục thành công.");
      showFeedback("success", `Đã thêm danh mục "${form.name.trim()}" thành công.`);
      await loadCategories();

      setTimeout(() => {
        closeForm();
      }, 600);
    } catch (submitError) {
      console.error("Create category error:", submitError);
      setSubmitState("error");
      setSubmitMessage(submitError.message || "Không thể thêm danh mục.");
      showFeedback("error", submitError.message || "Không thể thêm danh mục.");
    }
  };

  const handleToggleVisibility = (category) => {
    const nextHiddenState = !category.is_hidden;
    const actionLabel = nextHiddenState ? "Ẩn" : "Hiện";
    
    let confirmMsg = `Bạn có chắc muốn ${actionLabel.toLowerCase()} danh mục "${category.name}" không?`;
    if (nextHiddenState && category.parent_id === null) {
      confirmMsg = `Lưu ý: Khi ẩn danh mục cha "${category.name}", tất cả các danh mục con và sản phẩm trực thuộc cũng sẽ bị ẩn theo. Bạn có chắc chắn muốn ẩn không?`;
    }

    setConfirmModal({
      isOpen: true,
      message: confirmMsg,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          setTogglingId(category.id);
          
          const response = await fetch(
            buildApiUrl(`/api/categories/${category.id}/visibility`),
            {
              method: "PUT",
              headers: {
                ...getAuthHeaders({
                  "Content-Type": "application/json",
                }),
              },
              body: JSON.stringify({
                is_hidden: nextHiddenState,
              }),
            }
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || `Không thể ${actionLabel.toLowerCase()} danh mục.`);
          }

          showFeedback("success", data.message || `Đã ${actionLabel.toLowerCase()} danh mục thành công.`);
          await loadCategories();
        } catch (toggleError) {
          console.error("Toggle category visibility error:", toggleError);
          showFeedback("error", toggleError.message || `Không thể thực hiện thao tác.`);
        } finally {
          setTogglingId(null);
        }
      }
    });
  };

  return (
    <section className="panel-page">
      <div className="page-head-container">
        <div className="page-head">
          <h1>Quản lý danh mục</h1>
          <p>Theo dõi cấu trúc danh mục cha, danh mục con và trạng thái đồng bộ với backend.</p>
        </div>
        <div className="category-legend-box">
          <strong>💡 Chú thích hệ thống</strong>
          Danh mục dính tới đơn hàng nên không có cơ chế xóa, chỉ tạo button ẩn danh mục. Khi ẩn danh mục thì các sản phẩm trong danh mục đó cũng phải ẩn theo.
        </div>
      </div>

      <div className="category-summary-grid category-summary-grid-rich">
        <article className="category-summary-card">
          <span>Danh mục cha</span>
          <strong>{parentCategories.length}</strong>
          <small>Các nhóm chính đang hiển thị trong hệ thống.</small>
        </article>
        <article className="category-summary-card">
          <span>Danh mục con</span>
          <strong>{totalChildren}</strong>
          <small>Những mục đang được gắn bên trong từng nhóm cha.</small>
        </article>
        <article className="category-summary-card">
          <span>Nhóm chưa hoàn thiện</span>
          <strong>{orphanParents}</strong>
          <small>Danh mục cha chưa có mục con, nên bổ sung để dễ phân loại.</small>
        </article>
        <article className="category-summary-card">
          <span>Tổng danh mục</span>
          <strong>{categories.length}</strong>
          <small>Toàn bộ bản ghi category backend đang phản hồi.</small>
        </article>
      </div>

      {feedback.message ? (
        <div className="admin-center-toast-backdrop" onClick={() => setFeedback({ type: "", message: "" })}>
          <div
            className={`admin-center-toast ${feedback.type === "error" ? "admin-center-toast-error" : "admin-center-toast-success"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-center-toast-icon">
              {feedback.type === "error" ? "❌" : "✅"}
            </div>
            <h4>{feedback.type === "error" ? "Thao tác thất bại" : "Thao tác thành công"}</h4>
            <p>{feedback.message}</p>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", onConfirm: null })}
      />

      {status === "error" ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể lấy dữ liệu danh mục.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {status === "connected" && categories.length === 0 ? (
        <div className="admin-notice">
          <strong>Chưa có danh mục trong hệ thống.</strong>
          <p>Backend đã phản hồi thành công nhưng chưa trả về bản ghi nào.</p>
        </div>
      ) : null}

      <div className="categories-admin-layout">
        <section className="category-panel">
          <div className="section-title">
            <h3>Danh mục cha</h3>
            <button type="button" onClick={() => setIsFormOpen(true)}>
              Thêm danh mục
            </button>
          </div>

          <div className="category-parent-list">
            {parentCategories.length ? (
              parentCategories.map((parent) => (
                <article key={parent.id} className={`category-parent-card ${parent.is_hidden ? "card-hidden" : ""}`}>
                  <div className="category-parent-card-main">
                    <div className="category-parent-avatar">{parent.name.slice(0, 1)}</div>
                    <div>
                      <strong>{parent.name}</strong>
                      <p>Mã danh mục: #{parent.id}</p>
                    </div>
                  </div>
                  <div className="category-parent-actions">
                    <span className="status-pill">
                      {(childrenByParent[parent.id] || []).length} mục con
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="category-empty-state">
                <strong>Chưa có danh mục cha.</strong>
                <p>Tạo danh mục đầu tiên để bắt đầu xây dựng cấu trúc sản phẩm.</p>
              </div>
            )}
          </div>
        </section>

        <section className="category-panel">
          <div className="section-title">
            <h3>Cấu trúc danh mục</h3>
            <button type="button" onClick={loadCategories}>
              Làm mới
            </button>
          </div>

          <div className="category-tree-list">
            {parentCategories.length ? (
              parentCategories.map((parent) => {
                const children = childrenByParent[parent.id] || [];

                return (
                  <article key={parent.id} className="category-tree-card" style={parent.is_hidden ? { opacity: 0.65 } : {}}>
                    <div className="category-tree-root">
                      <div className="category-tree-root-node">
                        <strong>{parent.name}</strong>
                        <span>Nhóm gốc #{parent.id}</span>
                      </div>
                      <span className="category-tree-count">{children.length} danh mục con</span>
                    </div>

                    <div className="category-tree-branch">
                      {children.length ? (
                        <div className="category-tree-children">
                          {children.map((child) => (
                            <div key={child.id} className="category-tree-leaf" style={child.is_hidden ? { opacity: 0.65 } : {}}>
                              <span className="category-tree-leaf-line" aria-hidden="true" />
                              <div className="category-child-chip">
                                <small>#{child.id}</small>
                                {child.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="category-tree-empty">
                          Chưa có danh mục con cho nhóm này.
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="category-empty-state">
                <strong>Chưa có dữ liệu để hiển thị sơ đồ.</strong>
                <p>Khi có danh mục cha, hệ thống sẽ hiển thị cấu trúc ở đây.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="category-table-section">
        <div className="section-title">
          <h3>Bảng danh mục</h3>
          <button type="button" onClick={loadCategories}>
            Đồng bộ
          </button>
        </div>

        <div className="orders-table-wrap">
          <table className="orders-table category-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên danh mục</th>
                <th>Cấp</th>
                <th>Danh mục cha</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => (
                <tr key={item.id} style={item.is_hidden ? { opacity: 0.65 } : {}}>
                  <td>#{item.id}</td>
                  <td>
                    <div className="category-table-name">
                      <strong style={item.is_hidden ? { color: "#999", textDecoration: "line-through" } : {}}>{item.name}</strong>
                      <small>
                        {item.parent_id === null ? "Danh mục gốc" : "Danh mục phân nhánh"}
                      </small>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`category-level-badge ${
                        item.parent_id === null ? "parent" : "child"
                      }`}
                    >
                      {item.parent_id === null ? "Cha" : "Con"}
                    </span>
                  </td>
                  <td>
                    {item.parent_id === null
                      ? "Danh mục gốc"
                      : categories.find((entry) => entry.id === item.parent_id)?.name || "-"}
                  </td>
                  <td>
                    <span className={`status-badge ${item.is_hidden ? "hidden" : "active"}`}>
                      {item.is_hidden ? "Đã ẩn" : "Hiển thị"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`action-btn ${item.is_hidden ? "show-btn" : "hide-btn"}`}
                      onClick={() => handleToggleVisibility(item)}
                      disabled={togglingId === item.id}
                    >
                      {togglingId === item.id ? "..." : item.is_hidden ? "Hiện" : "Ẩn"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isFormOpen ? (
        <div className="category-modal-backdrop" onClick={closeForm}>
          <div className="category-modal" onClick={(event) => event.stopPropagation()}>
            <div className="category-modal-header">
              <div>
                <p className="category-modal-kicker">Trình tạo danh mục</p>
                <h3>Thêm danh mục mới</h3>
                <p className="category-modal-copy">
                  Tạo danh mục cha hoặc gán danh mục con vào một nhóm có sẵn.
                </p>
              </div>
              <button type="button" className="category-modal-close" onClick={closeForm}>
                Đóng
              </button>
            </div>

            <form className="category-form" onSubmit={handleSubmit}>
              <div className="category-form-grid">
                <label className="category-form-field category-form-field-wide">
                  <span>Tên danh mục</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => handleChangeForm("name", event.target.value)}
                    placeholder="VD: Đá quý"
                  />
                </label>

                <label className="category-form-field">
                  <span>Loại danh mục</span>
                  <select
                    value={form.level}
                    onChange={(event) => handleChangeForm("level", event.target.value)}
                  >
                    <option value="parent">Danh mục cha</option>
                    <option value="child">Danh mục con</option>
                  </select>
                </label>

                <label className="category-form-field">
                  <span>Danh mục cha</span>
                  <select
                    value={form.parentId}
                    onChange={(event) => handleChangeForm("parentId", event.target.value)}
                    disabled={form.level !== "child"}
                  >
                    <option value="">Chọn danh mục cha</option>
                    {parentCategories.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="category-form-field category-form-note">
                <span>Lưu ý</span>
                <small>
                  Nếu chọn danh mục con, hệ thống sẽ yêu cầu bạn chọn một danh mục cha hợp lệ
                  trước khi lưu.
                </small>
              </label>

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
                <button type="button" className="secondary" onClick={resetForm}>
                  Đặt lại
                </button>
                <button type="submit" disabled={submitState === "submitting"}>
                  {submitState === "submitting" ? "Đang lưu..." : "Lưu danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default CategoriesPage;
