import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { getAuthHeaders, getCurrentUser, clearAuthSession, isAdminUser, isStaffUser } from "../../../utils/auth";
import { buildApiUrl, buildAssetUrl } from "../../../utils/api";
import { formatCurrency, computeSalePrice } from "../../../utils/pricing";
import "./PosCheckoutPage.css";

const POS_API = buildApiUrl("/api/pos");
const PRODUCTS_API = buildApiUrl("/api/products");

function PosCheckoutPage() {
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!currentUser || (!isAdminUser(currentUser) && !isStaffUser(currentUser))) {
      window.location.href = "/login";
    }
  }, [currentUser]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH"); // "CASH" or "BANK"
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  // CRM Customer Info
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerDob, setCustomerDob] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmMessage, setCrmMessage] = useState("");

  // Order & Receipt processing
  const [checkoutState, setCheckoutState] = useState("idle"); // "idle", "pending_payment", "success", "error"
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [completedOrderData, setCompletedOrderData] = useState(null);
  const [countdown, setCountdown] = useState(180); // 180s countdown

  const pollingTimer = useRef(null);

  // Load products list for manual selection
  const loadProducts = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await fetch(`${PRODUCTS_API}/admin/list`, {
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        clearAuthSession();
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(data.products || []);
        setStatus("success");
      } else {
        throw new Error(data.message || "Không thể tải danh sách sản phẩm.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Clean polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimer.current) clearInterval(pollingTimer.current);
    };
  }, []);

  // Phone CRM Lookup
  const handlePhoneLookup = async (phoneVal) => {
    setCustomerPhone(phoneVal);
    if (phoneVal.trim().length < 9) {
      setCustomerName("");
      setCustomerDob("");
      setCustomerAddress("");
      setCrmMessage("");
      return;
    }

    try {
      setCrmLoading(true);
      setCrmMessage("");
      const res = await fetch(`${POS_API}/customer-lookup?phone=${phoneVal.trim()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.exists) {
          setCustomerName(data.data.fullName);
          setCustomerDob(data.data.dob || "");
          setCustomerAddress(data.data.address || "");
          setCrmMessage("Khách quen hệ thống.");
        } else {
          setCrmMessage("Khách hàng mới (Sẽ tự động đăng ký).");
        }
      }
    } catch (err) {
      console.error("CRM lookup error:", err);
    } finally {
      setCrmLoading(false);
    }
  };

  const FALLBACK_PRODUCT_IMAGE =
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ1xp79XGKoIg-gZeZiRg2G7mpp2A6kH-AWow&s";

  const getVariantPrice = (product, variant) => {
    if (!product || !variant) return 0;
    const baseWeight = Number(product.base_weight ?? product.baseWeight ?? 0);
    return computeSalePrice({
      baseSellPrice: Number(product.pricing?.base_sell_price || 0),
      baseWeight: baseWeight,
      weightModifier: Number(variant.weight_modifier || 0),
      laborCost: Number(product.pricing?.labor_cost || 0),
      stoneCost: Number(product.pricing?.stone_cost || 0),
      markupRate: Number(product.pricing?.markup_rate || 0),
    });
  };

  // Filtered products based on manual search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const matches = [];

    products.forEach((prod) => {
      const titleMatch = prod.name.toLowerCase().includes(query);
      const skuMatch = prod.variants?.some((v) => v.sku.toLowerCase().includes(query));
      
      if (titleMatch || skuMatch) {
        const mainImg = prod.images?.find((img) => img.is_main) || prod.images?.[0] || null;
        const imageUrl = mainImg ? buildAssetUrl(mainImg.url) : FALLBACK_PRODUCT_IMAGE;

        matches.push({
          ...prod,
          imageUrl,
        });
      }
    });

    return matches.slice(0, 10);
  }, [products, searchQuery]);

  const handleAddItem = (product) => {
    const matchedVariant = product.variants?.find(
      (v) => v.sku.toLowerCase() === searchQuery.trim().toLowerCase()
    ) || product.variants?.[0];

    if (!matchedVariant) return;

    setSelectedItems((prev) => {
      const exists = prev.find(
        (item) => item.productId === product.id && item.selectedVariantId === matchedVariant.id
      );
      if (exists) {
        return prev.map((item) =>
          item.productId === product.id && item.selectedVariantId === matchedVariant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          variants: product.variants,
          pricing: product.pricing,
          baseWeight: product.base_weight,
          base_weight: product.base_weight,
          image: product.imageUrl,
          selectedVariantId: matchedVariant.id,
          quantity: 1,
        },
      ];
    });
    setSearchQuery("");
  };

  const handleUpdateQty = (productId, variantId, delta) => {
    setSelectedItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId && item.selectedVariantId === variantId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: Math.max(1, nextQty) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId, variantId) => {
    setSelectedItems((prev) =>
      prev.filter((i) => !(i.productId === productId && i.selectedVariantId === variantId))
    );
  };

  const handleVariantChange = (productId, oldVariantId, newVariantId) => {
    setSelectedItems((prev) => {
      const targetIndex = prev.findIndex(
        (i) => i.productId === productId && i.selectedVariantId === oldVariantId
      );
      if (targetIndex === -1) return prev;

      const newVariantExistsIndex = prev.findIndex(
        (i) => i.productId === productId && i.selectedVariantId === newVariantId
      );

      if (newVariantExistsIndex !== -1 && newVariantExistsIndex !== targetIndex) {
        return prev
          .map((item, idx) => {
            if (idx === newVariantExistsIndex) {
              return { ...item, quantity: item.quantity + prev[targetIndex].quantity };
            }
            return item;
          })
          .filter((_, idx) => idx !== targetIndex);
      }

      return prev.map((item, idx) => {
        if (idx === targetIndex) {
          return { ...item, selectedVariantId: newVariantId };
        }
        return item;
      });
    });
  };

  const orderTotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const selectedVariant = item.variants.find((v) => v.id === item.selectedVariantId);
      const unitPrice = getVariantPrice(item, selectedVariant);
      return sum + unitPrice * item.quantity;
    }, 0);
  }, [selectedItems]);

  // Polling for SePay Bank webhook
  const startPaymentPolling = (orderId, preparedItems) => {
    if (pollingTimer.current) clearInterval(pollingTimer.current);

    pollingTimer.current = setInterval(async () => {
      try {
        const res = await fetch(`${POS_API}/status/${orderId}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.success && data.paid) {
          clearInterval(pollingTimer.current);
          setCheckoutState("success");
          setCheckoutMessage("Khách đã chuyển khoản thành công qua SePay!");
          
          setCompletedOrderData({
            id: orderId,
            orderCode: `POS${String(orderId).padStart(6, '0')}`,
            totalAmount: orderTotal,
            paymentMethod: "CHUYỂN KHOẢN (BANK)",
            cashierName: currentUser?.fullName || "Thu ngân quầy",
            customerName,
            customerPhone,
            items: preparedItems,
          });
          
          // Triggers success beep sound
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            osc.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // high tone
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
          } catch (e) {
            console.log(e);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
  };

  // Submit Order Checkout
  const handleCheckout = async (e) => {
    e.preventDefault();
    setCheckoutState("loading");
    setCheckoutMessage("");

    if (selectedItems.length === 0) {
      setCheckoutState("error");
      setCheckoutMessage("Vui lòng chọn ít nhất 1 sản phẩm vào giỏ hàng.");
      return;
    }
    if (!customerPhone.trim() || !customerName.trim()) {
      setCheckoutState("error");
      setCheckoutMessage("Họ tên và Số điện thoại khách hàng bắt buộc phải điền đầy đủ.");
      return;
    }

    try {
      const preparedItems = selectedItems.map((item) => {
        const selectedVariant = item.variants.find((v) => v.id === item.selectedVariantId);
        const unitPrice = getVariantPrice(item, selectedVariant);
        return {
          variantId: item.selectedVariantId,
          sku: selectedVariant?.sku || "",
          productName: item.productName,
          size: selectedVariant?.size || "Free size",
          unitPrice: unitPrice,
          quantity: item.quantity,
          image: item.image,
        };
      });

      const payload = {
        items: preparedItems,
        customer: {
          fullName: customerName,
          phone: customerPhone,
          dob: customerDob || null,
          address: customerAddress,
        },
      };

      if (paymentMethod === "CASH") {
        const res = await fetch(`${POS_API}/checkout-cash`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setCheckoutState("success");
          setCheckoutMessage("Lập hóa đơn tiền mặt thành công.");
          setCompletedOrderData({
            id: data.data.id,
            orderCode: data.data.orderCode,
            totalAmount: orderTotal,
            paymentMethod: "TIỀN MẶT (CASH)",
            cashierName: currentUser?.fullName || "Thu ngân quầy",
            customerName,
            customerPhone,
            items: preparedItems,
          });
        } else {
          throw new Error(data.message || "Lỗi thanh toán tiền mặt.");
        }
      } else {
        // Bank Transfer with VietQR and SePay
        const res = await fetch(`${POS_API}/create-pending`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setCheckoutState("pending_payment");
          setPendingOrderData(data.data);
          startPaymentPolling(data.data.id, preparedItems);
        } else {
          throw new Error(data.message || "Lỗi khởi tạo đơn hàng BANK.");
        }
      }
    } catch (err) {
      setCheckoutState("error");
      setCheckoutMessage(err.message);
    }
  };

  const handleCancelOrder = useCallback(async (isTimeout = false) => {
    if (!pendingOrderData) return;
    
    // Stop polling
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
    }

    try {
      const res = await fetch(`${POS_API}/cancel-pending/${pendingOrderData.id}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCheckoutState("error");
        setCheckoutMessage(
          isTimeout
            ? "Hết hạn thanh toán ngân hàng (3 phút). Đơn hàng đã tự động hủy và hoàn kho."
            : "Đã hủy đơn hàng chờ thanh toán ngân hàng và hoàn kho thành công."
        );
        setPendingOrderData(null);
      } else {
        throw new Error(data.message || "Lỗi khi hủy đơn hàng.");
      }
    } catch (err) {
      console.error("Cancel POS order error:", err);
      setCheckoutState("error");
      setCheckoutMessage(err.message || "Không thể hủy đơn hàng lúc này.");
    }
  }, [pendingOrderData]);

  const handleSwitchToCash = async () => {
    if (!pendingOrderData) return;

    // 1. Stop polling
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
    }

    try {
      // 2. Call cancel API to cancel the bank order and restore stock
      const cancelRes = await fetch(`${POS_API}/cancel-pending/${pendingOrderData.id}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!cancelRes.ok) {
        throw new Error("Lỗi khi hủy giao dịch chuyển khoản cũ.");
      }
      
      // 3. Trigger cash checkout
      setCheckoutState("loading");
      setCheckoutMessage("Đang chuyển đổi sang thanh toán tiền mặt...");

      const preparedItems = selectedItems.map((item) => {
        const selectedVariant = item.variants.find((v) => v.id === item.selectedVariantId);
        const unitPrice = getVariantPrice(item, selectedVariant);
        return {
          variantId: item.selectedVariantId,
          sku: selectedVariant?.sku || "",
          productName: item.productName,
          size: selectedVariant?.size || "Free size",
          unitPrice: unitPrice,
          quantity: item.quantity,
          image: item.image,
        };
      });

      const payload = {
        items: preparedItems,
        customer: {
          fullName: customerName,
          phone: customerPhone,
          dob: customerDob || null,
          address: customerAddress,
        },
      };

      const res = await fetch(`${POS_API}/checkout-cash`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCheckoutState("success");
        setCheckoutMessage("Đã chuyển đổi và thanh toán tiền mặt thành công.");
        setCompletedOrderData({
          id: data.data.id,
          orderCode: data.data.orderCode,
          totalAmount: orderTotal,
          paymentMethod: "TIỀN MẶT (CASH)",
          cashierName: currentUser?.fullName || "Thu ngân quầy",
          customerName,
          customerPhone,
          items: preparedItems,
        });
        setPendingOrderData(null);
      } else {
        throw new Error(data.message || "Lỗi thanh toán tiền mặt.");
      }
    } catch (err) {
      setCheckoutState("error");
      setCheckoutMessage(err.message || "Không thể chuyển sang tiền mặt lúc này.");
    }
  };

  useEffect(() => {
    let interval = null;
    if (checkoutState === "pending_payment") {
      setCountdown(180);
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleCancelOrder(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(180);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkoutState, handleCancelOrder]);

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleResetPos = () => {
    setSelectedItems([]);
    setCustomerPhone("");
    setCustomerName("");
    setCustomerDob("");
    setCustomerAddress("");
    setCrmMessage("");
    setCheckoutState("idle");
    setCheckoutMessage("");
    setPendingOrderData(null);
    setCompletedOrderData(null);
    loadProducts(); // reloads latest stock counts
  };

  const handleLogout = () => {
    clearAuthSession();
    window.location.href = "/login";
  };

  return (
    <div className="pos-terminal-container">
      {/* Fullscreen header for Cashier */}
      <header className="pos-header">
        <div className="pos-header-left">
          <h2>Quầy Bán Hàng POS</h2>
          <span className="pos-cashier-label">
            Thu ngân: <strong>{currentUser?.fullName || currentUser?.email || "Chưa đăng nhập"}</strong>
          </span>
        </div>
        <div className="pos-header-actions">
          <button type="button" onClick={handleResetPos} className="pos-btn-reset">
            Tạo Đơn Mới
          </button>
          <button type="button" onClick={handleLogout} className="pos-btn-logout">
            Đăng xuất
          </button>
        </div>
      </header>

      {status === "loading" && <div className="pos-screen-notice">Đang nạp kho sản phẩm...</div>}
      {status === "error" && <div className="pos-screen-notice error">Lỗi: {error}</div>}

      {status === "success" && (
        <main className="pos-main-layout">
          
          {/* LEFT: Basket and manual product search */}
          <section className="pos-left-section">
            <div className="pos-search-wrapper">
              <input
                type="text"
                placeholder="Nhập tên sản phẩm hoặc mã SKU để tìm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pos-search-input"
              />
              {filteredProducts.length > 0 && (
                <ul className="pos-search-results">
                  {filteredProducts.map((prod) => {
                    const basePrice = computeSalePrice({
                      baseSellPrice: Number(prod.pricing?.base_sell_price || 0),
                      baseWeight: Number(prod.base_weight || 0),
                      weightModifier: 0,
                      laborCost: Number(prod.pricing?.labor_cost || 0),
                      stoneCost: Number(prod.pricing?.stone_cost || 0),
                      markupRate: Number(prod.pricing?.markup_rate || 0),
                    });
                    const totalStock = prod.variants?.reduce((sum, v) => sum + (v.stock?.quantity ?? v.quantity ?? 0), 0) || 0;
                    
                    return (
                      <li key={prod.id} onClick={() => handleAddItem(prod)} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <img src={prod.imageUrl} alt={prod.name} style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover", backgroundColor: "#fff" }} />
                        <div className="result-info" style={{ flex: 1 }}>
                          <strong>{prod.name}</strong>
                          <span style={{ fontSize: "12px", color: "#aaa" }}>Chất liệu: {prod.material_type} ({prod.variants?.length || 0} biến thể)</span>
                        </div>
                        <div className="result-stock" style={{ textAlign: "right" }}>
                          <span>Tổng tồn: {totalStock}</span>
                          <strong style={{ color: "#e2b85c" }}>{formatCurrency(basePrice)}</strong>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="pos-basket-card">
              <h3>Danh sách sản phẩm mua tại quầy</h3>
              {selectedItems.length === 0 ? (
                <div className="pos-empty-basket">Chưa chọn sản phẩm nào. Hãy tìm kiếm ở trên để thêm.</div>
              ) : (
                <div className="pos-basket-table-wrap">
                  <table className="pos-basket-table">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>Mã SKU</th>
                        <th>Đơn giá</th>
                        <th style={{ textAlign: "center" }}>Số lượng</th>
                        <th style={{ textAlign: "right" }}>Thành tiền</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => {
                        const selectedVariant = item.variants.find((v) => v.id === item.selectedVariantId);
                        const unitPrice = getVariantPrice(item, selectedVariant);
                        
                        return (
                          <tr key={`${item.productId}-${item.selectedVariantId}`}>
                            <td style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <img src={item.image} alt={item.productName} style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover", backgroundColor: "#fff" }} />
                              <div>
                                <strong>{item.productName}</strong>
                              </div>
                            </td>
                            <td>
                              <select
                                value={item.selectedVariantId}
                                onChange={(e) => handleVariantChange(item.productId, item.selectedVariantId, Number(e.target.value))}
                                style={{ padding: "6px 10px", background: "#1a1a1a", color: "#fff", border: "1px solid #444", borderRadius: "4px", outline: "none", cursor: "pointer" }}
                              >
                                {item.variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    Size: {v.size} - SKU: {v.sku} (Tồn: {v.stock?.quantity ?? v.quantity ?? 0})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>{formatCurrency(unitPrice)}</td>
                            <td style={{ textAlign: "center" }}>
                              <div className="pos-qty-actions">
                                <button type="button" onClick={() => handleUpdateQty(item.productId, item.selectedVariantId, -1)}>-</button>
                                <span>{item.quantity}</span>
                                <button type="button" onClick={() => handleUpdateQty(item.productId, item.selectedVariantId, 1)}>+</button>
                              </div>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "bold" }}>
                              {formatCurrency(unitPrice * item.quantity)}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.productId, item.selectedVariantId)}
                                className="pos-remove-item"
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: CRM Customer Info & Payment Checkout */}
          <section className="pos-right-section">
            <form onSubmit={handleCheckout} className="pos-checkout-form">
              
              {/* CRM Section */}
              <div className="pos-card">
                <h3>Thông Tin CRM Khách Hàng</h3>
                
                <div className="pos-form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập SĐT..."
                    value={customerPhone}
                    onChange={(e) => handlePhoneLookup(e.target.value)}
                  />
                  {crmLoading && <small style={{ color: "#e2b85c" }}>Đang tra cứu CRM...</small>}
                  {crmMessage && <small style={{ color: "#2ebd7f", fontWeight: "bold" }}>{crmMessage}</small>}
                </div>

                <div className="pos-form-group">
                  <label>Họ và tên khách hàng</label>
                  <input
                    type="text"
                    required
                    placeholder="Họ tên khách hàng..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="pos-form-group">
                  <label>Ngày sinh</label>
                  <input
                    type="date"
                    value={customerDob}
                    onChange={(e) => setCustomerDob(e.target.value)}
                  />
                </div>

                <div className="pos-form-group">
                  <label>Địa chỉ thường trú</label>
                  <input
                    type="text"
                    placeholder="Địa chỉ..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Payment Section */}
              <div className="pos-card" style={{ marginTop: "15px" }}>
                <h3>Phương thức thanh toán</h3>
                <div className="pos-payment-selector">
                  <label className={paymentMethod === "CASH" ? "active" : ""}>
                    <input
                      type="radio"
                      name="payment_method"
                      checked={paymentMethod === "CASH"}
                      onChange={() => setPaymentMethod("CASH")}
                    />
                    <span>Tiền mặt (CASH)</span>
                  </label>
                  <label className={paymentMethod === "BANK" ? "active" : ""}>
                    <input
                      type="radio"
                      name="payment_method"
                      checked={paymentMethod === "BANK"}
                      onChange={() => setPaymentMethod("BANK")}
                    />
                    <span>Chuyển khoản (BANK)</span>
                  </label>
                </div>

                <div className="pos-total-summary">
                  <span>Tổng tiền thanh toán:</span>
                  <strong>{formatCurrency(orderTotal)}</strong>
                </div>

                {checkoutMessage && (
                  <div className={`pos-checkout-message ${checkoutState === "success" ? "success" : "error"}`}>
                    {checkoutMessage}
                  </div>
                )}

                {checkoutState === "pending_payment" && pendingOrderData && (
                  <div className="pos-qr-pending-box" style={{ padding: "15px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <p style={{ color: "#e2b85c", fontWeight: "bold", margin: "0 0 10px 0", textAlign: "center" }}>
                      [!] Chờ quét QR Chuyển Khoản Ngân Hàng...
                    </p>
                    
                    {/* Countdown Display */}
                    <div style={{ background: "rgba(226, 184, 92, 0.1)", border: "1px solid #e2b85c", borderRadius: "6px", padding: "6px 12px", fontSize: "14px", fontWeight: "bold", color: "#e2b85c", marginBottom: "15px" }}>
                      Hạn chuyển khoản còn lại: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                    </div>

                    <img src={pendingOrderData.qrCodeUrl} alt="VietQR SePay" className="pos-qr-img" style={{ width: "160px", height: "160px", border: "4px solid #fff", borderRadius: "8px", margin: "10px 0" }} />
                    
                    <div className="pos-qr-details" style={{ width: "100%", margin: "10px 0", fontSize: "13px" }}>
                      <div>Mã đơn: <strong>{pendingOrderData.orderCode}</strong></div>
                      <div>Nội dung CK: <strong>{pendingOrderData.paymentReference}</strong></div>
                    </div>

                    {/* Action buttons inside pending state */}
                    <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: "10px" }}>
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(false)}
                        className="pos-btn-logout"
                        style={{ flex: 1, padding: "8px", fontSize: "13px", height: "auto" }}
                      >
                        Hủy giao dịch
                      </button>
                      <button
                        type="button"
                        onClick={handleSwitchToCash}
                        className="pos-btn-reset"
                        style={{ flex: 1, padding: "8px", fontSize: "13px", height: "auto" }}
                      >
                        Chuyển Tiền Mặt
                      </button>
                    </div>
                  </div>
                )}

                {checkoutState !== "success" && (
                  <button
                    type="submit"
                    disabled={checkoutState === "loading" || selectedItems.length === 0}
                    className="pos-btn-submit"
                  >
                    {checkoutState === "loading" ? "Đang xử lý..." : paymentMethod === "CASH" ? "Thanh Toán Tiền Mặt" : "Tạo Mã Chuyển Khoản"}
                  </button>
                )}
              </div>
            </form>
          </section>

        </main>
      )}

      {/* MODAL / SCREEN PRINT INVOICE PREVIEW K80 */}
      {completedOrderData && (
        <div className="pos-invoice-modal-overlay">
          <div className="pos-invoice-modal">
            <h3>Nghiệm thu thanh toán POS thành công</h3>
            
            {/* Simulated Invoice Container */}
            <div className="pos-invoice-k80-receipt" id="invoice-print-area">
              <div className="receipt-header">
                <h2>CỬA HÀNG TRANG SỨC ĐẸP</h2>
                <p>Địa chỉ: 123 Đường Trang Sức, Hà Nội</p>
                <p>Hotline: 1900 8888</p>
                <hr className="receipt-dashed" />
                <h3>HÓA ĐƠN BÁN LẺ</h3>
                <p className="receipt-code">Mã đơn: {completedOrderData.orderCode}</p>
                <p>Ngày lập: {new Date(completedOrderData.createdAt).toLocaleString("vi-VN")}</p>
              </div>

              <div className="receipt-body">
                <div className="receipt-row">
                  <span>Thu ngân:</span>
                  <strong>{completedOrderData.cashierName}</strong>
                </div>
                <div className="receipt-row">
                  <span>Khách hàng:</span>
                  <strong>{completedOrderData.customerName}</strong>
                </div>
                <div className="receipt-row">
                  <span>SĐT:</span>
                  <strong>{completedOrderData.customerPhone}</strong>
                </div>
                <hr className="receipt-dashed" />
                
                <table className="receipt-items-table">
                  <thead>
                    <tr>
                      <th>Tên món (Size)</th>
                      <th style={{ textAlign: "center" }}>SL</th>
                      <th style={{ textAlign: "right" }}>T.Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedOrderData.items.map((item) => (
                      <tr key={item.variantId}>
                        <td>{item.productName} ({item.size})</td>
                        <td style={{ textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(item.unitPrice * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <hr className="receipt-dashed" />
                <div className="receipt-row total">
                  <span>TỔNG CỘNG:</span>
                  <strong>{formatCurrency(completedOrderData.totalAmount)}</strong>
                </div>
                <div className="receipt-row">
                  <span>Phương thức:</span>
                  <strong>{completedOrderData.paymentMethod}</strong>
                </div>
              </div>

              <div className="receipt-footer">
                <hr className="receipt-dashed" />
                <p>Cảm ơn quý khách đã mua sắm tại cửa hàng!</p>
                <p>Hẹn gặp lại quý khách.</p>
              </div>
            </div>

            <div className="pos-invoice-modal-actions">
              <button type="button" onClick={handlePrintInvoice} className="pos-btn-print">
                In hóa đơn (window.print)
              </button>
              <button type="button" onClick={handleResetPos} className="pos-btn-done">
                Đóng & Tạo đơn tiếp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PosCheckoutPage;
