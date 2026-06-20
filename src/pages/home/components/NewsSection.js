import React, { useState } from "react";
import { Link } from "react-router-dom";
import { mockArticles } from "../../../utils/mockArticles";
import "./NewsSection.css";

function GoldRatesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  // Mock current gold rates
  const goldRatesList = [
    { type: "Vàng SJC 99.99 (Lượng)", buy: 78500000, sell: 80500000 },
    { type: "Vàng Nhẫn PNJ 99.99 (Chỉ)", buy: 7420000, sell: 7590000 },
    { type: "Vàng 24K (Chỉ)", buy: 7350000, sell: 7500000 },
    { type: "Vàng 18K (75%) (Chỉ)", buy: 5460000, sell: 5600000 },
    { type: "Vàng 14K (58.3%) (Chỉ)", buy: 4210000, sell: 4350000 },
    { type: "Vàng 10K (41.6%) (Chỉ)", buy: 2950000, sell: 3090000 }
  ];

  const formatPrice = (value) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(value);
  };

  return (
    <div className="gold-modal-backdrop" onClick={onClose}>
      <div className="gold-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="gold-modal-header">
          <div>
            <span className="gold-modal-kicker">Thông tin thị trường</span>
            <h3>Bảng Giá Vàng Hôm Nay</h3>
          </div>
          <button type="button" className="gold-modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="gold-modal-body">
          <p className="gold-modal-note">
            * Giá vàng mang tính chất tham khảo tại hệ thống JewelryBook. Cập nhật mới nhất lúc {new Date().toLocaleDateString("vi-VN")} {new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}.
          </p>
          <div className="gold-table-container">
            <table className="gold-rates-table">
              <thead>
                <tr>
                  <th>Loại Vàng</th>
                  <th>Giá Mua Vào</th>
                  <th>Giá Bán Ra</th>
                </tr>
              </thead>
              <tbody>
                {goldRatesList.map((rate, idx) => (
                  <tr key={idx}>
                    <td className="gold-type-name">{rate.type}</td>
                    <td className="gold-price-buy">{formatPrice(rate.buy)}</td>
                    <td className="gold-price-sell">{formatPrice(rate.sell)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="gold-modal-footer">
          <button className="gold-modal-action-btn" onClick={onClose}>
            Đóng bảng giá
          </button>
        </div>
      </div>
    </div>
  );
}

function NewsSection() {
  const [isGoldModalOpen, setIsGoldModalOpen] = useState(false);

  // Take the first two articles for the homepage layout
  const homepageArticles = mockArticles.slice(0, 2);

  return (
    <section className="news-section" id="news-section">
      <div className="news-section-header">
        <span className="news-kicker">JewelryBook Journal</span>
        <h2 className="news-title">Tin tức</h2>
        <div className="news-title-underline"></div>
      </div>

      <div className="news-grid">
        {/* Left Column: Gold Rates Banner */}
        <div className="news-banner-card" onClick={() => setIsGoldModalOpen(true)}>
          <div className="news-banner-image-wrapper">
            <img
              src="https://cdn.pnj.io/images/promo/284/thong-tin-gia-vang.png"
              alt="Thông tin giá vàng hôm nay"
              className="news-banner-image"
            />
            <div className="news-banner-overlay">
              <span className="news-banner-btn">XEM NGAY</span>
            </div>
          </div>
        </div>

        {/* Right Column: Two articles side by side */}
        <div className="news-articles-grid">
          {homepageArticles.map((article) => (
            <article key={article.id} className="news-post-card">
              <Link to={`/articles/${article.id}`} className="news-post-link">
                <div className="news-post-image-wrapper">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="news-post-image"
                    loading="lazy"
                  />
                  <span className="news-post-category">{article.category}</span>
                </div>
                <div className="news-post-body">
                  <span className="news-post-date">{article.date}</span>
                  <h3 className="news-post-title">{article.title}</h3>
                  <p className="news-post-excerpt">{article.summary}</p>
                  <span className="news-post-more">
                    Xem thêm <span className="arrow-symbol">&gt;</span>
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="news-view-all">
        <Link to="/articles" className="news-view-all-btn">
          Xem tất cả
        </Link>
      </div>

      <GoldRatesModal
        isOpen={isGoldModalOpen}
        onClose={() => setIsGoldModalOpen(false)}
      />
    </section>
  );
}

export default NewsSection;
