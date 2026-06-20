import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "./Header";
import Footer from "./footer/Footer";
import { mockArticles } from "../utils/mockArticles";
import "./ArticleDetailPage.css";

function ArticleDetailPage() {
  const { id } = useParams();

  // Find the current article
  const currentArticle = mockArticles.find((art) => art.id === id);

  // Scroll to top when the article id changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  // Featured articles list (exclude current article, show others)
  const featuredArticles = mockArticles.filter((art) => art.id !== id);

  if (!currentArticle) {
    return (
      <div className="article-detail-page-fallback">
        <Header />
        <main className="article-fallback-main">
          <div className="article-not-found-card">
            <h2>⚠️ Không Tìm Thấy Bài Viết</h2>
            <p>Bài viết bạn đang truy cập không tồn tại hoặc đã bị gỡ bỏ.</p>
            <Link to="/" className="back-home-btn">
              Quay lại Trang chủ
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="article-detail-page">
      <Header />

      <main className="article-detail-main">
        {/* Breadcrumb path */}
        <nav className="article-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/articles">Tin tức</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{currentArticle.title}</span>
        </nav>

        <div className="article-detail-layout">
          {/* Left Column: Article Content (70%) */}
          <article className="article-main-content">
            <header className="article-content-header">
              <span className="article-content-category">
                {currentArticle.category}
              </span>
              <h1 className="article-content-title">{currentArticle.title}</h1>
              <div className="article-content-meta">
                <span className="article-meta-date">🕒 Đăng ngày: {currentArticle.date}</span>
                <span className="article-meta-author">✍️ Tác giả: Ban Biên Tập JewelryBook</span>
              </div>
            </header>

            {/* Banner Image */}
            <div className="article-content-banner">
              <img
                src={currentArticle.image}
                alt={currentArticle.title}
                className="article-banner-img"
              />
            </div>

            {/* Dynamic Body Content */}
            <div className="article-body-content">
              {currentArticle.content.map((block, index) => {
                switch (block.type) {
                  case "paragraph":
                    return <p key={index} className="article-paragraph">{block.text}</p>;
                  case "heading":
                    return <h3 key={index} className="article-section-heading">{block.text}</h3>;
                  case "image":
                    return (
                      <figure key={index} className="article-inline-image-wrapper">
                        <img
                          src={block.url}
                          alt={block.caption || "Hình ảnh minh họa"}
                          className="article-inline-image"
                        />
                        {block.caption && (
                          <figcaption className="article-image-caption">
                            {block.caption}
                          </figcaption>
                        )}
                      </figure>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </article>

          {/* Right Column: Sidebar Featured Articles (30%) */}
          <aside className="article-sidebar">
            <div className="sidebar-card">
              <h2 className="sidebar-title">Bài viết nổi bật</h2>
              <div className="sidebar-divider"></div>
              
              <div className="sidebar-articles-list">
                {featuredArticles.map((art) => (
                  <Link
                    to={`/articles/${art.id}`}
                    key={art.id}
                    className="sidebar-article-item"
                  >
                    <div className="sidebar-item-thumb-wrapper">
                      <img
                        src={art.image}
                        alt={art.title}
                        className="sidebar-item-thumb"
                        loading="lazy"
                      />
                    </div>
                    <div className="sidebar-item-info">
                      <h4 className="sidebar-item-title">{art.title}</h4>
                      <span className="sidebar-item-date">{art.date}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Optional Promo Banner in Sidebar */}
            <div className="sidebar-promo-card">
              <img 
                src="https://cdn.pnj.io/images/promo/283/giao-hang-trong-3h.png" 
                alt="Giao hàng nhanh 3h" 
                className="sidebar-promo-img"
              />
              <div className="sidebar-promo-overlay">
                <h4>GIAO NHANH MIỄN PHÍ</h4>
                <p>Nhận hàng trong 3 giờ đối với đơn hàng nội thành</p>
                <Link to="/products" className="sidebar-promo-btn">MUA NGAY</Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default ArticleDetailPage;
