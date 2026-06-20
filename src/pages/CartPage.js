import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "./Header";
import Footer from "./footer/Footer";
import { getCurrentUser } from "../utils/auth";
import {
  clearCart,
  getCartItems,
  removeCartItem,
  subscribeCartChange,
  updateCartQuantity,
} from "../utils/cart";
import { formatCurrency } from "../utils/pricing";
import { buildAssetUrl } from "../utils/api";
import "./CartPage.css";

function CartPage() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => getCurrentUser());
  const [items, setItems] = useState(() => (currentUser ? getCartItems() : []));

  useEffect(() => {
    if (!currentUser) {
      setItems([]);
      return undefined;
    }

    setItems(getCartItems());
    return subscribeCartChange(setItems);
  }, [currentUser]);

  const totals = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

    return {
      totalQuantity,
      totalAmount,
      formattedTotalAmount: formatCurrency(totalAmount),
    };
  }, [items]);

  const handleContinueShopping = () => {
    navigate("/", {
      state: {
        scrollToFeaturedProducts: true,
      },
    });
  };

  const handleProceedCheckout = () => {
    navigate("/checkout", {
      state: {
        source: "cart",
      },
    });
  };

  return (
    <div className="cart-page">
      <Header />

      <main className="cart-shell">
        <div className="cart-heading">
          <h1>Giỏ hàng của bạn</h1>
          <p className="cart-subheading">Xem lại các sản phẩm trang sức tinh tế bạn đã chọn</p>
        </div>

        {!currentUser ? (
          <section className="cart-empty-state">
            <div className="empty-cart-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="empty-cart-svg">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2>Yêu cầu đăng nhập</h2>
            <p>Vui lòng đăng nhập tài khoản của bạn để xem giỏ hàng và tiếp tục các bước thanh toán đơn giản.</p>
            <Link to="/login" className="cart-back-link-btn">
              Đăng nhập ngay
            </Link>
          </section>
        ) : !items.length ? (
          <section className="cart-empty-state">
            <div className="empty-cart-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="empty-cart-svg">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <h2>Giỏ hàng của bạn đang trống</h2>
            <p>Hành trình tìm kiếm vẻ đẹp tinh tế đang chờ bạn. Hãy khám phá các thiết kế trang sức mới nhất.</p>
            <button type="button" className="cart-back-link-btn" onClick={handleContinueShopping}>
              Tiếp tục mua sắm
            </button>
          </section>
        ) : (
          <section className="cart-layout">
            <div className="cart-list-container">
              <div className="cart-list-header">
                <span>Sản phẩm ({totals.totalQuantity})</span>
                <button type="button" className="cart-clear-all-btn" onClick={clearCart}>
                  Xóa tất cả
                </button>
              </div>

              <div className="cart-list">
                {items.map((item) => (
                  <article className="cart-item-card" key={item.variantId}>
                    <div className="cart-item-image-wrapper">
                      <img
                        className="cart-item-image"
                        src={buildAssetUrl(item.image)}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>

                    <div className="cart-item-body">
                      <div className="cart-item-details">
                        <h2>{item.name}</h2>
                        <div className="cart-item-options">
                          <span className="cart-option-tag">Kích thước: {item.size || "Chuẩn"}</span>
                          {item.maxQuantity > 0 ? (
                            <span className="cart-option-tag stock">
                              {item.stockLabel || `Còn ${item.maxQuantity} sp`}
                            </span>
                          ) : null}
                        </div>
                        <p className="cart-item-price-unit">
                          Đơn giá: {formatCurrency(item.price)}
                        </p>
                      </div>

                      <div className="cart-item-actions">
                        <div className="cart-quantity-container">
                          <button
                            type="button"
                            className="qty-btn minus"
                            disabled={item.quantity <= 1}
                            onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                            aria-label="Giảm số lượng"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            className="qty-input"
                            min="1"
                            max={item.maxQuantity || undefined}
                            value={item.quantity}
                            onChange={(event) => {
                              const val = Number(event.target.value);
                              if (val > 0) {
                                updateCartQuantity(
                                  item.variantId,
                                  item.maxQuantity > 0 ? Math.min(val, item.maxQuantity) : val
                                );
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="qty-btn plus"
                            disabled={item.maxQuantity > 0 && item.quantity >= item.maxQuantity}
                            onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                            aria-label="Tăng số lượng"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="cart-item-delete-btn"
                          onClick={() => removeCartItem(item.variantId)}
                          aria-label="Xóa sản phẩm"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="trash-icon">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                          <span>Xóa</span>
                        </button>
                      </div>

                      <div className="cart-item-price-total">
                        <span>Tổng cộng:</span>
                        <strong>
                          {formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="cart-summary-card">
              <h2>Tóm tắt đơn hàng</h2>



              <div className="cart-summary-details">
                <div className="cart-summary-row">
                  <span>Số lượng sản phẩm</span>
                  <strong>{totals.totalQuantity} món</strong>
                </div>
                <div className="cart-summary-row">
                  <span>Phí vận chuyển</span>
                  <strong>{totals.totalAmount >= 500000 ? "Miễn phí" : "Tính khi thanh toán"}</strong>
                </div>
                <div className="cart-summary-divider" />
                <div className="cart-summary-row total">
                  <span>Tổng tiền tạm tính</span>
                  <strong className="total-price">{totals.formattedTotalAmount}</strong>
                </div>
              </div>

              <button
                type="button"
                className="cart-checkout-button"
                onClick={handleProceedCheckout}
              >
                Tiến hành thanh toán
              </button>

              <button
                type="button"
                className="cart-back-shopping-btn"
                onClick={handleContinueShopping}
              >
                Tiếp tục mua sắm
              </button>
            </aside>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default CartPage;
