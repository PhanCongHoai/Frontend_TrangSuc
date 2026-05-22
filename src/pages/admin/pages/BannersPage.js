import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import { notifyBannerChanged } from "../../../utils/bannerSync";

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

  const handleImageChange = async (event) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    try {
      const dataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
      setForm((prev) => ({
        ...prev,
        imageUrl: dataUrls[0] || "",
        imageUrls: dataUrls,
      }));
      setError("");
      setMessage("");
    } catch (imageError) {
      console.error("Read banner image error:", imageError);
      setError(imageError.message || "Không thể tải ảnh banner.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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
          image_urls: form.imageUrls.length ? form.imageUrls : [form.imageUrl],
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

  const handleDeleteBanner = async (banner) => {
    const bannerId = Number(banner?.id || 0);

    if (!bannerId || deletingBannerId) {
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa banner #${bannerId}?`)) {
      return;
    }

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
              <span>Ảnh banner</span>
              <input
                className="product-file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
              />
              <small className="field-hint">
                Chọn một hoặc nhiều ảnh từ máy tính để thêm vào banner trang chủ.
              </small>
            </label>

            {form.imageUrls.length ? (
              <div className="product-image-preview category-form-field category-form-field-wide">
                <span>Xem trước banner</span>
                <div className="banner-gallery">
                  {form.imageUrls.map((imageUrl, index) => (
                    <div className="banner-gallery-card" key={`${index}-${imageUrl.length}`}>
                      <img src={imageUrl} alt={`Banner trang chủ ${index + 1}`} />
                      <span>Ảnh {index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {message ? <div className="category-form-message success">{message}</div> : null}
          {error && status !== "error" ? (
            <div className="category-form-message error">{error}</div>
          ) : null}

          <div className="category-form-actions">
            <button type="submit" disabled={isSubmitting || !form.imageUrls.length}>
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
    </section>
  );
}

export default BannersPage;
