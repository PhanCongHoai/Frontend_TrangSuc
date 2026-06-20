import React from "react";
import { Link } from "react-router-dom";
import Header from "./Header";
import Footer from "./footer/Footer";
import { mockArticles } from "../utils/mockArticles";
import "./ArticlesPage.css";

function ArticlesPage() {
  return (
    <div className="articles-list-page">
      <Header />

      <main className="articles-list-main">
        {/* Breadcrumb path */}
        <nav className="articles-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Tin tức</span>
        </nav>

        <header className="articles-list-header">
          <span className="articles-kicker">JewelryBook Journal</span>
          <h1 className="articles-title">Tất Cả Bài Viết</h1>
          <div className="articles-title-underline"></div>
        </header>

        {/* Grid of all articles */}
        <div className="articles-grid-container">
          {mockArticles.map((article) => (
            <article key={article.id} className="articles-grid-card">
              <Link to={`/articles/${article.id}`} className="article-card-link">
                <div className="article-card-img-wrapper">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="article-card-img"
                    loading="lazy"
                  />
                  <span className="article-card-category">{article.category}</span>
                </div>
                <div className="article-card-body">
                  <span className="article-card-date">{article.date}</span>
                  <h3 className="article-card-title">{article.title}</h3>
                  <p className="article-card-excerpt">{article.summary}</p>
                  <span className="article-card-more">
                    Xem thêm <span className="arrow">&gt;</span>
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default ArticlesPage;
