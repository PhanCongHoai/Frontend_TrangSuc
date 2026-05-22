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
          <h1>Giỏ hàng</h1>
        </div>

        {!currentUser ? (
          <section className="cart-empty-state">
            <h2>Bạn cần đăng nhập để xem giỏ hàng</h2>
            <p>Hãy đăng nhập để lưu sản phẩm và tiếp tục mua sắm.</p>
            <Link to="/login" className="cart-back-link">
              Đăng nhập ngay
            </Link>
          </section>
        ) : !items.length ? (
          <section className="cart-empty-state">
            <h2>Giỏ hàng của bạn đang trống</h2>
            <p>Hãy quay lại và chọn thêm sản phẩm bạn muốn mua.</p>
            <button type="button" className="cart-back-link" onClick={handleContinueShopping}>
              Tiếp tục mua sắm
            </button>
          </section>
        ) : (
          <section className="cart-layout">
            <div className="cart-list">
              {items.map((item) => (
                <article className="cart-item-card" key={item.variantId}>
                  <img
                    className="cart-item-image"
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                  />

                  <div className="cart-item-body">
                    <div className="cart-item-top">
                      <div>
                        <h2>{item.name}</h2>
                        <p>Kích thước: {item.size || "Chuẩn"}</p>
                        {item.maxQuantity > 0 ? (
                          <p>Tồn kho: {item.stockLabel || `${item.maxQuantity} sản phẩm`}</p>
                        ) : null}
                        <p>{`Đơn giá hiện tại: ${formatCurrency(item.price)}`}</p>
                      </div>
                      <strong>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                    </div>

                    <div className="cart-item-actions">
                      <label className="cart-quantity-control">
                        <span>Số lượng</span>
                        <input
                          type="number"
                          min="1"
                          max={item.maxQuantity || undefined}
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(event) =>
                            updateCartQuantity(item.variantId, Number(event.target.value || 1))
                          }
                          onBlur={(event) =>
                            updateCartQuantity(item.variantId, Number(event.target.value || 1))
                          }
                        />
                        {item.maxQuantity > 0 ? (
                          <small>Tối đa {item.maxQuantity} sản phẩm</small>
                        ) : null}
                      </label>

                      <button
                        type="button"
                        className="cart-remove-button"
                        onClick={() => removeCartItem(item.variantId)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside className="cart-summary-card">
              <h2>Tóm tắt đơn hàng</h2>
              <div className="cart-summary-row">
                <span>Tổng sản phẩm</span>
                <strong>{totals.totalQuantity}</strong>
              </div>
              <div className="cart-summary-row">
                <span>Tạm tính</span>
                <strong>{totals.formattedTotalAmount}</strong>
              </div>

              <button
                type="button"
                className="cart-checkout-button"
                onClick={handleProceedCheckout}
              >
                Tiến hành đặt hàng
              </button>
              <button type="button" className="cart-back-link" onClick={handleContinueShopping}>
                Tiếp tục mua sắm
              </button>
              <button type="button" className="cart-clear-button" onClick={clearCart}>
                Xóa toàn bộ giỏ hàng
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
