import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import { notifyBannerChanged } from "../../../utils/bannerSync";
import ConfirmModal from "../components/ConfirmModal";

const initialForm = {
  id: "",
  imageUrl: "",
  imageUrls: [],
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh banner."));
    reader.readAsDataURL(file);
  });
}

function BannersPage() {
  const [form, setForm] = useState(initialForm);
  const [banners, setBanners] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingBannerId, setDeletingBannerId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    const loadBanner = async () => {
      try {
        setStatus("loading");
        setError("");

        const response = await fetch(buildApiUrl("/api/banners/admin/home-hero"), {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể tải banner.");
        }

        setBanners(
          Array.isArray(data.banners)
            ? data.banners
            : data.banner
              ? [data.banner]
              : []
        );
        setForm(initialForm);
        setStatus("connected");
      } catch (fetchError) {
        console.error("Load banner error:", fetchError);
        setError(fetchError.message || "Không thể tải banner.");
        setStatus("error");
      }
    };

    loadBanner();
  }, []);

  const handleLinkChange = (event) => {
    const url = event.target.value;
    setForm((prev) => ({
      ...prev,
      imageUrl: url,
      imageUrls: [url],
    }));
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedUrl = String(form.imageUrl || "").trim();
    if (!trimmedUrl) {
      setError("Vui lòng nhập link ảnh banner.");
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith("/")) {
      setError("Link ảnh banner phải bắt đầu bằng http://, https:// hoặc /");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");
      setError("");

      const response = await fetch(buildApiUrl("/api/banners/admin/home-hero"), {
        method: "PATCH",
        headers: {
          ...getAuthHeaders({
            "Content-Type": "application/json",
          }),
        },
        body: JSON.stringify({
          image_urls: [trimmedUrl],
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể lưu banner.");
      }

      const savedBanners = Array.isArray(data.banners)
        ? data.banners
        : data.banner
          ? [data.banner]
          : [];

      if (savedBanners.length) {
        setBanners((current) => [...savedBanners, ...current]);
      }
      setForm(initialForm);
      setMessage(data.message || `Đã thêm ${savedBanners.length || 1} banner.`);
      notifyBannerChanged("home_hero");
    } catch (submitError) {
      console.error("Save banner error:", submitError);
      setError(submitError.message || "Không thể lưu banner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBanner = (banner) => {
    const bannerId = Number(banner?.id || 0);

    if (!bannerId || deletingBannerId) {
      return;
    }

    setConfirmModal({
      isOpen: true,
      message: `Bạn có chắc muốn xóa banner #${bannerId}?`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          setDeletingBannerId(bannerId);
          setError("");
          setMessage("");

          const response = await fetch(
            buildApiUrl(`/api/banners/admin/home-hero/${bannerId}`),
            {
              method: "DELETE",
              headers: getAuthHeaders(),
            }
          );
          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Không thể xóa banner.");
          }

          setBanners((current) => current.filter((item) => Number(item.id) !== bannerId));
          setMessage(data.message || "Đã xóa banner.");
          notifyBannerChanged("home_hero");
        } catch (deleteError) {
          console.error("Delete banner error:", deleteError);
          setError(deleteError.message || "Không thể xóa banner.");
        } finally {
          setDeletingBannerId(null);
        }
      }
    });
  };

  return (
    <section className="panel-page">
      <div className="page-head">
        <h1>Quản lý banner</h1>
        <p>Thêm nhiều ảnh banner để trang chủ chuyển qua lại bằng mũi tên.</p>
      </div>

      {status === "error" ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể tải dữ liệu banner.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <section className="category-panel">
        <div className="section-title">
          <h3>Thêm banner trang chủ</h3>
        </div>

        {status === "loading" ? (
          <div className="admin-notice">
            <strong>Đang tải banner...</strong>
            <p>Hệ thống đang đọc ảnh banner từ database.</p>
          </div>
        ) : null}

        <form className="category-form" onSubmit={handleSubmit}>
          <div className="category-form-grid">
            <label className="category-form-field category-form-field-wide">
              <span>Link ảnh banner</span>
              <input
                type="text"
                value={form.imageUrl}
                onChange={handleLinkChange}
                placeholder="Nhập địa chỉ URL của ảnh (ví dụ: https://example.com/banner.jpg)"
              />
              <small className="field-hint">
                Cung cấp đường dẫn URL công khai của ảnh làm banner trang chủ.
              </small>
            </label>

            {form.imageUrl.trim() ? (
              <div className="product-image-preview category-form-field category-form-field-wide">
                <span>Xem trước banner</span>
                <div className="banner-gallery">
                  <div className="banner-gallery-card">
                    <img 
                      src={form.imageUrl.trim()} 
                      alt="Xem trước banner" 
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                      onLoad={(e) => {
                        e.target.style.display = "block";
                      }}
                    />
                    <span>Xem trước</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {message ? <div className="category-form-message success">{message}</div> : null}
          {error && status !== "error" ? (
            <div className="category-form-message error">{error}</div>
          ) : null}

          <div className="category-form-actions">
            <button type="submit" disabled={isSubmitting || !form.imageUrl.trim()}>
              {isSubmitting ? "Đang lưu..." : "Thêm banner"}
            </button>
          </div>
        </form>

        {banners.length ? (
          <div className="banner-gallery">
            {banners.map((banner) => (
              <div className="banner-gallery-card" key={banner.id}>
                <img src={banner.image_url} alt="Banner trang chủ" />
                <span>#{banner.id}</span>
                <button
                  type="button"
                  className="banner-delete-button"
                  onClick={() => handleDeleteBanner(banner)}
                  disabled={deletingBannerId === banner.id}
                >
                  {deletingBannerId === banner.id ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, message: "", onConfirm: null })}
      />
    </section>
  );
}

export default BannersPage;
