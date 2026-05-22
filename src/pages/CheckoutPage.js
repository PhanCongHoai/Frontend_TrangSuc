import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "./Header";
import Footer from "./footer/Footer";
import { clearCart, getCartItems } from "../utils/cart";
import { getAuthHeaders, getCurrentUser } from "../utils/auth";
import { buildApiUrl } from "../utils/api";
import { formatCurrency, normalizePriceTiers, resolveTierPrice } from "../utils/pricing";
import "./CheckoutPage.css";

const ORDERS_API = buildApiUrl("/api/orders");
const SHIPPING_API = buildApiUrl("/api/shipping");
const ADDRESS_API = "https://provinces.open-api.vn/api/v2";
const PAYMENT_STATUS_POLL_INTERVAL = 5000;
const PAYMENT_METHODS = [
  {
    id: "cod",
    label: "Thanh toán khi nhận hàng",
    description: "Trả tiền cho shipper.",
  },
  {
    id: "prepaid",
    label: "Thanh toán trước",
    description: "Shop xử lý sau khi đã xác nhận thanh toán.",
  },
];
const DELIVERY_OPTION = {
  id: "ghn_standard",
  label: "GHN giao hàng tiêu chuẩn",
  description: "Phí ship lấy trực tiếp từ GHN nếu backend đã cấu hình.",
  serviceTypeId: 2,
};

const getWeight = (item) => {
  const explicit = Number(item?.shippingWeight || 0);
  if (explicit > 0) return Math.round(explicit);
  const estimated = Number(item?.baseWeight || 0) + Number(item?.weightModifier || 0);
  return estimated > 0 ? Math.max(100, Math.round(estimated)) : 500;
};

const toPositiveInteger = (value, fallback = 0) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.round(parsedValue);
};

const toParcelInputValue = (value) => String(Math.max(1, toPositiveInteger(value, 1)));

const toRequiredPositiveInteger = (value) => {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return null;
  }

  return toPositiveInteger(normalizedValue, 0) || null;
};

const normalizeItem = (item) => {
  const quantity = Math.max(1, Number(item?.quantity || 1));
  const priceTiers = normalizePriceTiers(item?.priceTiers);
  const basePrice = Number((item?.basePrice ?? item?.price) || 0);
  const price = resolveTierPrice(priceTiers, quantity, Number(item?.price || basePrice), {
    baseSellPrice: Number(item?.baseSellPrice || 0),
    baseWeight: Number(item?.baseWeight || 0),
    weightModifier: Number(item?.weightModifier || 0),
    laborCost: Number(item?.laborCost || 0),
    stoneCost: Number(item?.stoneCost || 0),
  });
  return {
    productId: Number(item?.productId || 0),
    variantId: Number(item?.variantId || 0),
    name: String(item?.name || "").trim(),
    image: String(item?.image || "").trim(),
    size: String(item?.size || "Chuẩn").trim(),
    stockLabel: String(item?.stockLabel || "").trim(),
    quantity,
    price,
    shippingWeight: getWeight(item),
  };
};

const mapProvince = (item, ghn) => ({
  code: String(ghn ? item.ProvinceID : item.code),
  name: ghn ? item.ProvinceName : item.name,
});

const mapDistrict = (item, ghn) => ({
  code: String(ghn ? item.DistrictID : item.code),
  name: ghn ? item.DistrictName : item.name,
});

const mapWard = (item, ghn) => ({
  code: String(ghn ? item.WardCode : item.code),
  name: ghn ? item.WardName : item.name,
});

function buildPlacedOrderState(payload) {
  return {
    orderCode: payload?.data?.orderCode || "",
    orderId: payload?.data?.id || null,
    internalOrderCode: payload?.data?.internalOrderCode || "",
    payment: {
      method: payload?.data?.payment?.method || "",
      status: payload?.data?.payment?.status || "",
      amount: Number(payload?.data?.payment?.amount || 0),
      provider: payload?.data?.payment?.provider || "",
      mode: payload?.data?.payment?.mode || "",
      isVirtualAccount: Boolean(payload?.data?.payment?.isVirtualAccount),
      paymentReference: payload?.data?.payment?.paymentReference || "",
      transferContent: payload?.data?.payment?.transferContent || "",
      qrCodeUrl: payload?.data?.payment?.qrCodeUrl || "",
      bankCode: payload?.data?.payment?.bankCode || "",
      bankName: payload?.data?.payment?.bankName || "",
      accountNumber: payload?.data?.payment?.accountNumber || "",
      accountHolderName: payload?.data?.payment?.accountHolderName || "",
      qrTemplate: payload?.data?.payment?.qrTemplate || "",
      qrEnabled: Boolean(payload?.data?.payment?.qrEnabled),
      expiresAt: payload?.data?.payment?.expiresAt || null,
      warning: payload?.data?.payment?.warning || "",
      paidAt: payload?.data?.payment?.paidAt || null,
      sepayTransactionId: payload?.data?.payment?.sepayTransactionId || "",
    },
  };
}

function normalizeRequestError(error, fallbackMessage) {
  const rawMessage = String(error?.message || "").trim();

  if (!rawMessage) {
    return fallbackMessage;
  }

  if (
    rawMessage === "Failed to fetch" ||
    rawMessage === "NetworkError when attempting to fetch resource." ||
    rawMessage.includes("NetworkError")
  ) {
    return "Không kết nối được backend hoặc dịch vụ địa chỉ. Hãy kiểm tra server rồi thử lại.";
  }

  return rawMessage;
}

async function fetchJson(url, options, fallbackMessage = "Không thể tải dữ liệu.") {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
      if (!payload && response.status === 404 && String(url).includes("/api/orders")) {
        throw new Error("Backend chưa nạp API đơn hàng. Hãy khởi động lại server backend.");
      }

      throw new Error(payload?.message || fallbackMessage);
    }

    return payload;
  } catch (error) {
    throw new Error(normalizeRequestError(error, fallbackMessage));
  }
}

function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [selectedPayment, setSelectedPayment] = useState(PAYMENT_METHODS[0].id);
  const [voucherCode, setVoucherCode] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);
  const [addressError, setAddressError] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingQuote, setShippingQuote] = useState(null);
  const [shippingConfig, setShippingConfig] = useState({
    loading: true,
    enabled: false,
    useSandbox: true,
    error: "",
    missingFields: [],
  });
  const [addressLoading, setAddressLoading] = useState({
    provinces: true,
    districts: false,
    wards: false,
  });
  const [addressOptions, setAddressOptions] = useState({
    provinces: [],
    districts: [],
    wards: [],
  });
  const [formData, setFormData] = useState({
    fullName: currentUser?.fullName || currentUser?.name || currentUser?.username || "",
    phone: currentUser?.phone || currentUser?.phoneNumber || "",
    email: currentUser?.email || "",
    provinceCode: "",
    districtCode: "",
    wardCode: "",
    streetAddress: currentUser?.address || "",
  });

  const checkoutItems = useMemo(() => {
    const stateItems = Array.isArray(location.state?.items)
      ? location.state.items.map(normalizeItem)
      : [];
    return stateItems.length ? stateItems : getCartItems().map(normalizeItem);
  }, [location.state]);

  const pricing = useMemo(() => {
    const subtotal = checkoutItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
    const itemCount = checkoutItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const discount = voucherCode.trim().toUpperCase() === "TIKTOK10" ? Math.round(subtotal * 0.1) : 0;
    const shippingFee = shippingConfig.enabled ? Math.max(0, Number(shippingQuote?.total || 0)) : 0;

    return {
      subtotal,
      itemCount,
      discount,
      shippingFee,
      total: Math.max(0, subtotal + shippingFee - discount),
    };
  }, [checkoutItems, shippingConfig.enabled, shippingQuote, voucherCode]);

  const suggestedParcel = useMemo(() => {
    const weight = checkoutItems.reduce(
      (sum, item) => sum + item.shippingWeight * Math.max(1, Number(item.quantity || 0)),
      0
    );

    return {
      weight: Math.max(500, weight),
      length: 20,
      width: 15,
      height: Math.min(60, Math.max(10, 10 + pricing.itemCount * 2)),
    };
  }, [checkoutItems, pricing.itemCount]);
  const [parcelInput, setParcelInput] = useState({
    weight: "500",
    length: "20",
    width: "15",
    height: "10",
  });
  const [isParcelCustomized, setIsParcelCustomized] = useState(false);

  useEffect(() => {
    if (isParcelCustomized) {
      return;
    }

    setParcelInput({
      weight: toParcelInputValue(suggestedParcel.weight),
      length: toParcelInputValue(suggestedParcel.length),
      width: toParcelInputValue(suggestedParcel.width),
      height: toParcelInputValue(suggestedParcel.height),
    });
  }, [
    isParcelCustomized,
    suggestedParcel.height,
    suggestedParcel.length,
    suggestedParcel.weight,
    suggestedParcel.width,
  ]);

  const parcel = useMemo(
    () => ({
      weight: toRequiredPositiveInteger(parcelInput.weight),
      length: toRequiredPositiveInteger(parcelInput.length),
      width: toRequiredPositiveInteger(parcelInput.width),
      height: toRequiredPositiveInteger(parcelInput.height),
    }),
    [
      parcelInput.height,
      parcelInput.length,
      parcelInput.weight,
      parcelInput.width,
    ]
  );
  const parcelValidationMessage = useMemo(() => {
    const missingFields = [
      !parcel.weight ? "khối lượng" : "",
      !parcel.length ? "dài" : "",
      !parcel.width ? "rộng" : "",
      !parcel.height ? "cao" : "",
    ].filter(Boolean);

    if (!missingFields.length) {
      return "";
    }

    return `Vui lòng nhập đầy đủ ${missingFields.join(", ")} cho kiện hàng trước khi tính phí GHN.`;
  }, [parcel.height, parcel.length, parcel.weight, parcel.width]);

  const selectedProvince = addressOptions.provinces.find(
    (item) => item.code === formData.provinceCode
  );
  const selectedDistrict = addressOptions.districts.find(
    (item) => item.code === formData.districtCode
  );
  const selectedWard = addressOptions.wards.find((item) => item.code === formData.wardCode);
  const administrativeAddress = [selectedWard?.name, selectedDistrict?.name, selectedProvince?.name]
    .filter(Boolean)
    .join(", ");
  const fullAddress = [formData.streetAddress.trim(), administrativeAddress]
    .filter(Boolean)
    .join(", ");
  const canEstimateShipping = Boolean(
    shippingConfig.enabled && formData.districtCode && formData.wardCode
  );
  const isPrepaidOrder = placedOrder?.payment?.method === "prepaid";
  const isPaymentConfirmed =
    String(placedOrder?.payment?.status || "").trim().toUpperCase() === "PAID";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    let ignore = false;

    fetchJson(`${SHIPPING_API}/config`, undefined, "Không tải được cấu hình GHN.")
      .then((payload) => {
        if (ignore) return;

        setShippingConfig({
          loading: false,
          enabled: Boolean(payload.data?.enabled),
          useSandbox: Boolean(payload.data?.useSandbox),
          error: "",
          missingFields: Array.isArray(payload.data?.missingFields)
            ? payload.data.missingFields
            : [],
        });
      })
      .catch((error) => {
        if (ignore) return;

        setShippingConfig({
          loading: false,
          enabled: false,
          useSandbox: true,
          error: error.message || "Không tải được cấu hình GHN.",
          missingFields: [],
        });
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        setAddressError("");
        setAddressLoading((current) => ({ ...current, provinces: true }));

        if (shippingConfig.enabled) {
          const payload = await fetchJson(
            `${SHIPPING_API}/provinces`,
            undefined,
            "Không thể tải danh sách tỉnh/thành từ GHN."
          );
          if (!ignore) {
            setAddressOptions({
              provinces: (payload.data || []).map((item) => mapProvince(item, true)),
              districts: [],
              wards: [],
            });
          }
        } else {
          const provinces = await fetchJson(
            `${ADDRESS_API}/?depth=1`,
            undefined,
            "Không thể tải danh sách tỉnh/thành."
          );
          if (!ignore) {
            setAddressOptions({
              provinces: (provinces || []).map((item) => mapProvince(item, false)),
              districts: [],
              wards: [],
            });
          }
        }
      } catch (error) {
        if (!ignore) {
          setAddressError(error.message || "Không thể tải tỉnh/thành.");
        }
      } finally {
        if (!ignore) {
          setAddressLoading((current) => ({ ...current, provinces: false }));
        }
      }
    };

    if (!shippingConfig.loading) {
      load();
    }

    return () => {
      ignore = true;
    };
  }, [shippingConfig.enabled, shippingConfig.loading]);

  useEffect(() => {
    let ignore = false;

    if (!formData.provinceCode) {
      setAddressOptions((current) => ({ ...current, districts: [], wards: [] }));
      return undefined;
    }

    const load = async () => {
      try {
        setAddressError("");
        setAddressLoading((current) => ({ ...current, districts: true, wards: false }));

        if (shippingConfig.enabled) {
          const payload = await fetchJson(
            `${SHIPPING_API}/districts?province_id=${encodeURIComponent(formData.provinceCode)}`,
            undefined,
            "Không thể tải danh sách quận/huyện từ GHN."
          );
          if (!ignore) {
            setAddressOptions((current) => ({
              ...current,
              districts: (payload.data || []).map((item) => mapDistrict(item, true)),
              wards: [],
            }));
          }
        } else {
          const province = await fetchJson(
            `${ADDRESS_API}/p/${formData.provinceCode}?depth=2`,
            undefined,
            "Không thể tải danh sách quận/huyện."
          );
          if (!ignore) {
            setAddressOptions((current) => ({
              ...current,
              districts: (province.districts || []).map((item) => mapDistrict(item, false)),
              wards: [],
            }));
          }
        }
      } catch (error) {
        if (!ignore) {
          setAddressError(error.message || "Không thể tải quận/huyện.");
        }
      } finally {
        if (!ignore) {
          setAddressLoading((current) => ({ ...current, districts: false, wards: false }));
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [formData.provinceCode, shippingConfig.enabled]);

  useEffect(() => {
    let ignore = false;

    if (!formData.districtCode) {
      setAddressOptions((current) => ({ ...current, wards: [] }));
      return undefined;
    }

    const load = async () => {
      try {
        setAddressError("");
        setAddressLoading((current) => ({ ...current, wards: true }));

        if (shippingConfig.enabled) {
          const payload = await fetchJson(
            `${SHIPPING_API}/wards?district_id=${encodeURIComponent(formData.districtCode)}`,
            undefined,
            "Không thể tải danh sách phường/xã từ GHN."
          );
          if (!ignore) {
            setAddressOptions((current) => ({
              ...current,
              wards: (payload.data || []).map((item) => mapWard(item, true)),
            }));
          }
        } else {
          const district = await fetchJson(
            `${ADDRESS_API}/d/${formData.districtCode}?depth=2`,
            undefined,
            "Không thể tải danh sách phường/xã."
          );
          if (!ignore) {
            setAddressOptions((current) => ({
              ...current,
              wards: (district.wards || []).map((item) => mapWard(item, false)),
            }));
          }
        }
      } catch (error) {
        if (!ignore) {
          setAddressError(error.message || "Không thể tải phường/xã.");
        }
      } finally {
        if (!ignore) {
          setAddressLoading((current) => ({ ...current, wards: false }));
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [formData.districtCode, shippingConfig.enabled]);

  useEffect(() => {
    let ignore = false;

    if (!canEstimateShipping || parcelValidationMessage) {
      setShippingQuote(null);
      setShippingError("");
      return undefined;
    }

    const load = async () => {
      try {
        setShippingError("");
        setShippingLoading(true);

        const payload = await fetchJson(
          `${SHIPPING_API}/fee`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_type_id: DELIVERY_OPTION.serviceTypeId,
              to_district_id: Number(formData.districtCode),
              to_ward_code: formData.wardCode,
              height: parcel.height,
              length: parcel.length,
              width: parcel.width,
              weight: parcel.weight,
              insurance_value: pricing.subtotal,
              coupon: null,
            }),
          },
          "Không thể tính phí GHN cho địa chỉ này."
        );

        if (!ignore) {
          setShippingQuote(payload.data || null);
        }
      } catch (error) {
        if (!ignore) {
          setShippingQuote(null);
          setShippingError(error.message || "Không thể tính phí GHN.");
        }
      } finally {
        if (!ignore) {
          setShippingLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [
    formData.districtCode,
    formData.wardCode,
    parcel.height,
    parcel.length,
    parcel.weight,
    parcel.width,
    pricing.subtotal,
    canEstimateShipping,
    parcelValidationMessage,
  ]);

  useEffect(() => {
    if (!placedOrder?.orderId || !isPrepaidOrder || isPaymentConfirmed) {
      return undefined;
    }

    let ignore = false;

    const syncPaymentStatus = async () => {
      try {
        const payload = await fetchJson(
          `${ORDERS_API}/${placedOrder.orderId}/payment-status`,
          {
            headers: getAuthHeaders(),
          },
          "KhÃ´ng thá»ƒ kiá»ƒm tra tráº¡ng thÃ¡i thanh toÃ¡n."
        );

        if (ignore || !payload?.success) {
          return;
        }

        setPlacedOrder((current) => {
          if (!current || Number(current.orderId) !== Number(payload.data?.orderId || 0)) {
            return current;
          }

          return {
            ...current,
            payment: {
              ...current.payment,
              status: payload.data?.payment?.status || current.payment.status,
              mode: payload.data?.payment?.mode || current.payment.mode || "",
              isVirtualAccount:
                typeof payload.data?.payment?.isVirtualAccount === "boolean"
                  ? payload.data.payment.isVirtualAccount
                  : current.payment.isVirtualAccount,
              paidAt: payload.data?.payment?.paidAt || current.payment.paidAt || null,
              paymentReference:
                payload.data?.payment?.paymentReference || current.payment.paymentReference || "",
              transferContent:
                payload.data?.payment?.transferContent || current.payment.transferContent || "",
              accountNumber:
                payload.data?.payment?.accountNumber || current.payment.accountNumber || "",
              accountHolderName:
                payload.data?.payment?.accountHolderName ||
                current.payment.accountHolderName ||
                "",
              expiresAt:
                payload.data?.payment?.expiresAt || current.payment.expiresAt || null,
              warning: payload.data?.payment?.warning || current.payment.warning || "",
              sepayTransactionId:
                payload.data?.payment?.sepayTransactionId ||
                current.payment.sepayTransactionId ||
                "",
            },
          };
        });
      } catch (error) {
        if (!ignore) {
          console.error("Poll payment status error:", error);
        }
      }
    };

    syncPaymentStatus();
    const timerId = window.setInterval(syncPaymentStatus, PAYMENT_STATUS_POLL_INTERVAL);

    return () => {
      ignore = true;
      window.clearInterval(timerId);
    };
  }, [isPaymentConfirmed, isPrepaidOrder, placedOrder?.orderId]);

  const handleChange = ({ target: { name, value } }) => {
    setFormData((current) => {
      if (name === "provinceCode") {
        return { ...current, provinceCode: value, districtCode: "", wardCode: "" };
      }

      if (name === "districtCode") {
        return { ...current, districtCode: value, wardCode: "" };
      }

      return { ...current, [name]: value };
    });
  };

  const handleParcelChange = ({ target: { name, value } }) => {
    const normalizedValue = String(value || "").replace(/[^\d]/g, "");
    setIsParcelCustomized(true);
    setParcelInput((current) => ({
      ...current,
      [name]: normalizedValue,
    }));
  };

  const handlePlaceOrder = async (event) => {
    event.preventDefault();

    if (isPlacingOrder) return;

    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.streetAddress.trim()) {
      setAddressError("Vui lòng điền đầy đủ thông tin khách hàng và địa chỉ chi tiết.");
      return;
    }

    if (!formData.provinceCode || !formData.districtCode || !formData.wardCode) {
      setAddressError("Vui lòng chọn đầy đủ tỉnh/thành, quận/huyện và phường/xã.");
      return;
    }

    if (parcelValidationMessage) {
      setAddressError(parcelValidationMessage);
      return;
    }

    setAddressError("");

    try {
      setIsPlacingOrder(true);
      if (shippingConfig.enabled && !shippingQuote) {
        throw new Error("Chưa tính được phí GHN.");
      }

      const payload = await fetchJson(
        ORDERS_API,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            name:
              checkoutItems.length === 1
                ? checkoutItems[0].name
                : `Đơn hàng gồm ${checkoutItems.length} sản phẩm`,
            subtotal: pricing.subtotal,
            discount_amount: pricing.discount,
            shipping_fee: pricing.shippingFee,
            total_amount: pricing.total,
            payment_method: selectedPayment,
            payment_type_id: selectedPayment === "cod" ? 2 : 1,
            note: orderNote.trim(),
            required_note: "KHONGCHOXEMHANG",
            email: formData.email.trim(),
            to_name: formData.fullName.trim(),
            to_phone: formData.phone.trim(),
            to_address: formData.streetAddress.trim(),
            to_district_id: Number(formData.districtCode),
            to_ward_code: formData.wardCode,
            ward_name: selectedWard?.name || "",
            district_name: selectedDistrict?.name || "",
            province_name: selectedProvince?.name || "",
            full_address: fullAddress,
            weight: parcel.weight,
            length: parcel.length,
            width: parcel.width,
            height: parcel.height,
            insurance_value: pricing.subtotal,
            cod_amount: selectedPayment === "cod" ? pricing.total : 0,
            service_type_id: DELIVERY_OPTION.serviceTypeId,
            items: checkoutItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              code: String(item.variantId || item.productId || ""),
              quantity: item.quantity,
              price: Number(item.price || 0),
              weight: item.shippingWeight,
              length: parcel.length,
              width: parcel.width,
              height: parcel.height,
              category: {
                level1: "Trang sức",
              },
            })),
          }),
        },
        "Không thể tạo đơn hàng."
      );

      if ((location.state?.source || "cart") === "cart") {
        clearCart();
      }

      setPlacedOrder(buildPlacedOrderState(payload));
    } catch (error) {
      setAddressError(error.message || "Không thể tạo đơn hàng.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="checkout-page">
        <Header />
        <main className="checkout-shell">
          <section className="checkout-empty-state">
            <p className="checkout-kicker">Thanh toán</p>
            <h1>Bạn cần đăng nhập để tiếp tục mua hàng</h1>
            <p>Đăng nhập để lưu địa chỉ và theo dõi đơn hàng.</p>
            <Link to="/login" className="checkout-primary-button">
              Đăng nhập ngay
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (!checkoutItems.length) {
    return (
      <div className="checkout-page">
        <Header />
        <main className="checkout-shell">
          <section className="checkout-empty-state">
            <p className="checkout-kicker">Thanh toán</p>
            <h1>Chưa có sản phẩm nào để thanh toán</h1>
            <p>Hãy thêm sản phẩm vào giỏ hàng trước.</p>
            <button
              type="button"
              className="checkout-primary-button"
              onClick={() => navigate("/")}
            >
              Quay về trang chủ
            </button>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (placedOrder) {
    return (
      <div className="checkout-page">
        <Header />
        <main className="checkout-shell">
          <section className="checkout-empty-state checkout-success-state">
            {isPrepaidOrder ? (
              <div className="checkout-payment-success">
                <div
                  className={`checkout-payment-status ${
                    isPaymentConfirmed
                      ? "checkout-payment-status-success"
                      : "checkout-payment-status-pending"
                  }`}
                >
                  <strong>
                    {isPaymentConfirmed
                      ? "Đã nhận thanh toán từ SePay"
                      : "Đang chờ SePay xác nhận thanh toán"}
                  </strong>
                  <p>
                    {isPaymentConfirmed
                      ? "Hệ thống đã tự động đối soát và cập nhật đơn hàng thành công."
                      : "Màn hình này sẽ tự làm mới. Khi SePay gửi webhook thành công, trạng thái sẽ đổi sang đã thanh toán."}
                  </p>
                </div>
                <p className="checkout-kicker">
                  {isPaymentConfirmed ? "Thanh toán thành công" : "Chờ thanh toán"}
                </p>
                <h1>
                  {isPaymentConfirmed
                    ? "Đơn hàng đã được thanh toán"
                    : "Quét QR để hoàn tất thanh toán"}
                </h1>
                <p>
                  {isPaymentConfirmed
                    ? "Khoản thanh toán của bạn đã được ghi nhận. Chúng tôi sẽ tiếp tục xử lý đơn hàng."
                    : `Vui lòng chuyển đúng ${formatCurrency(
                        placedOrder.payment.amount
                      )} với nội dung bên dưới. Hệ thống sẽ tự động xác nhận khi SePay gửi webhook về.`}
                </p>
                <p>{fullAddress}</p>
                {placedOrder.internalOrderCode ? (
                  <p>Mã đơn nội bộ: {placedOrder.internalOrderCode}</p>
                ) : null}
                {placedOrder.orderCode ? <p>Mã đơn GHN: {placedOrder.orderCode}</p> : null}
                {placedOrder.payment.isVirtualAccount ? (
                  <p>Phuong thuc nhan tien: Tai khoan ao SePay</p>
                ) : null}
                {placedOrder.payment.paidAt ? (
                  <p>Thời điểm xác nhận: {placedOrder.payment.paidAt}</p>
                ) : null}
                {placedOrder.payment.sepayTransactionId ? (
                  <p>Mã giao dịch SePay: {placedOrder.payment.sepayTransactionId}</p>
                ) : null}
                {placedOrder.payment.warning ? (
                  <div className="checkout-address-preview">
                    <strong>Luu y cau hinh thanh toan</strong>
                    <p>{placedOrder.payment.warning}</p>
                  </div>
                ) : null}
                {!isPaymentConfirmed &&
                placedOrder.payment.qrEnabled &&
                placedOrder.payment.qrCodeUrl ? (
                  <div className="checkout-payment-qr">
                    <img
                      src={placedOrder.payment.qrCodeUrl}
                      alt="QR thanh toán SePay"
                      className="checkout-payment-qr-image"
                    />
                  </div>
                ) : null}
                {!isPaymentConfirmed && !placedOrder.payment.qrEnabled ? (
                  <div className="checkout-address-preview">
                    <strong>Chưa tạo được QR SePay</strong>
                    <p>
                      Cần cấu hình `SEPAY_STATIC_VA_NUMBER` và `SEPAY_BANK_CODE` trong
                      `backend/.env`.
                    </p>
                  </div>
                ) : null}

                <div className="checkout-payment-details">
                  <div className="checkout-payment-row">
                    <span>Ngân hàng</span>
                    <strong>
                      {placedOrder.payment.bankName ||
                        placedOrder.payment.bankCode ||
                        "Chưa có"}
                    </strong>
                  </div>
                  <div className="checkout-payment-row">
                    <span>{placedOrder.payment.isVirtualAccount ? "So tai khoan ao" : "So tai khoan"}</span>
                    <strong>{placedOrder.payment.accountNumber || "Chưa có"}</strong>
                  </div>
                  {placedOrder.payment.accountHolderName ? (
                    <div className="checkout-payment-row">
                      <span>Chu tai khoan</span>
                      <strong>{placedOrder.payment.accountHolderName}</strong>
                    </div>
                  ) : null}
                  <div className="checkout-payment-row">
                    <span>Số tiền</span>
                    <strong>{formatCurrency(placedOrder.payment.amount || 0)}</strong>
                  </div>
                  <div className="checkout-payment-row">
                    <span>Nội dung chuyển khoản</span>
                    <strong>
                      {placedOrder.payment.transferContent ||
                        placedOrder.payment.paymentReference ||
                        "Chưa có"}
                    </strong>
                  </div>
                  {placedOrder.payment.expiresAt ? (
                    <div className="checkout-payment-row">
                      <span>Hieu luc den</span>
                      <strong>{placedOrder.payment.expiresAt}</strong>
                    </div>
                  ) : null}
                  {!isPaymentConfirmed ? (
                    <p className="checkout-payment-help">
                      {placedOrder.payment.isVirtualAccount
                        ? "He thong uu tien doi soat theo tai khoan ao cua don hang nay. Ban van nen giu nguyen noi dung chuyen khoan de de tra soat."
                        : "Khach hang can chuyen dung so tien va giu nguyen noi dung de SePay tu dong doi soat don hang."}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!isPrepaidOrder ? (
              <>
            <p className="checkout-kicker">Đặt hàng thành công</p>
            <h1>Đơn hàng của bạn đã được ghi nhận</h1>
            <p>Chúng tôi sẽ liên hệ với {formData.fullName || "bạn"} qua số {formData.phone}.</p>
            <p>{fullAddress}</p>
            {placedOrder.orderCode ? <p>Mã đơn GHN: {placedOrder.orderCode}</p> : null}
              </>
            ) : null}
            <div className="checkout-success-actions">
              <button
                type="button"
                className="checkout-primary-button"
                onClick={() => navigate("/")}
              >
                Tiếp tục mua sắm
              </button>
              <button
                type="button"
                className="checkout-secondary-button"
                onClick={() => navigate("/orders")}
              >
                Xem giỏ hàng
              </button>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <Header />
      <main className="checkout-shell">
        <form className="checkout-layout" onSubmit={handlePlaceOrder}>
          <div className="checkout-main-column">
            <section className="checkout-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">1. Thông tin khách hàng</p>
                  <h2>Người nhận đơn</h2>
                </div>
              </div>

              <div className="checkout-form-grid">
                <label>
                  <span>Họ và tên</span>
                  <input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </label>

                <label>
                  <span>Số điện thoại</span>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="09xxxxxxxx"
                    required
                  />
                </label>

                <label className="checkout-form-span-2">
                  <span>Email</span>
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="ban@example.com"
                  />
                </label>
              </div>
            </section>

            <section className="checkout-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">2. Địa chỉ giao hàng</p>
                  <h2>Thông tin giao đến</h2>
                </div>
              </div>

              <div className="checkout-form-grid">
                <label>
                  <span>Tỉnh/Thành phố</span>
                  <select
                    name="provinceCode"
                    value={formData.provinceCode}
                    onChange={handleChange}
                    disabled={addressLoading.provinces}
                    required
                  >
                    <option value="">
                      {addressLoading.provinces ? "Đang tải tỉnh/thành..." : "Chọn tỉnh/thành"}
                    </option>
                    {addressOptions.provinces.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Quận/Huyện</span>
                  <select
                    name="districtCode"
                    value={formData.districtCode}
                    onChange={handleChange}
                    disabled={!formData.provinceCode || addressLoading.districts}
                    required
                  >
                    <option value="">
                      {addressLoading.districts ? "Đang tải quận/huyện..." : "Chọn quận/huyện"}
                    </option>
                    {addressOptions.districts.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Phường/Xã</span>
                  <select
                    name="wardCode"
                    value={formData.wardCode}
                    onChange={handleChange}
                    disabled={!formData.districtCode || addressLoading.wards}
                    required
                  >
                    <option value="">
                      {addressLoading.wards ? "Đang tải phường/xã..." : "Chọn phường/xã"}
                    </option>
                    {addressOptions.wards.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="checkout-form-span-2">
                  <span>Địa chỉ chi tiết</span>
                  <input
                    name="streetAddress"
                    value={formData.streetAddress}
                    onChange={handleChange}
                    placeholder="Số nhà, tên đường, chung cư, tòa nhà..."
                    required
                  />
                  <small className="checkout-form-help">
                    Ô này dùng để lưu địa chỉ giao thực tế cho tài xế và cho đơn GHN.
                  </small>
                </label>
              </div>

              {administrativeAddress ? (
                <div className="checkout-address-preview">
                  <strong>Khu vực dùng để tính phí GHN</strong>
                  <p>{administrativeAddress}</p>
                </div>
              ) : null}

              {fullAddress ? (
                <div className="checkout-address-preview">
                  <strong>Địa chỉ giao hàng đầy đủ</strong>
                  <p>{fullAddress}</p>
                </div>
              ) : null}

              {addressError ? <p className="checkout-address-error">{addressError}</p> : null}
            </section>

            <section className="checkout-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">3. Sản phẩm</p>
                  <h2>Danh sách đang thanh toán</h2>
                </div>
              </div>

              <div className="checkout-item-list">
                {checkoutItems.map((item) => (
                  <article className="checkout-item" key={`${item.variantId}-${item.productId}`}>
                    <img src={item.image} alt={item.name} className="checkout-item-image" />
                    <div className="checkout-item-body">
                      <h3>{item.name}</h3>
                      <div className="checkout-item-meta">
                        <span>Phân loại: {item.size || "Chuẩn"}</span>
                        <span>Số lượng: {item.quantity}</span>
                        <span>Ship: {item.shippingWeight} g</span>
                        {item.stockLabel ? <span>{item.stockLabel}</span> : null}
                      </div>
                    </div>
                    <strong>
                      {formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}
                    </strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="checkout-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">4. Thông tin gói hàng</p>
                  <h2>Dữ liệu tính cước</h2>
                </div>
              </div>

              <div className="checkout-form-grid checkout-parcel-grid">
                <label>
                  <span>Khối lượng (gram)</span>
                  <input
                    type="number"
                    name="weight"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={parcelInput.weight}
                    onChange={handleParcelChange}
                    required
                  />
                </label>

                <label>
                  <span>Dài (cm)</span>
                  <input
                    type="number"
                    name="length"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={parcelInput.length}
                    onChange={handleParcelChange}
                    required
                  />
                </label>

                <label>
                  <span>Rộng (cm)</span>
                  <input
                    type="number"
                    name="width"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={parcelInput.width}
                    onChange={handleParcelChange}
                    required
                  />
                </label>

                <label>
                  <span>Cao (cm)</span>
                  <input
                    type="number"
                    name="height"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={parcelInput.height}
                    onChange={handleParcelChange}
                    required
                  />
                </label>
              </div>

              <div className="checkout-info-list">
                <div className="checkout-info-row">
                  <span>Khối lượng GHN đang dùng</span>
                  <strong>{parcel.weight ? `${parcel.weight} g` : "--"}</strong>
                </div>
                <div className="checkout-info-row">
                  <span>Kích thước GHN đang dùng</span>
                  <strong>
                    {parcel.length && parcel.width && parcel.height
                      ? `${parcel.length} x ${parcel.width} x ${parcel.height} cm`
                      : "--"}
                  </strong>
                </div>
                <div className="checkout-info-row">
                  <span>Tổng số món</span>
                  <strong>{pricing.itemCount} sản phẩm</strong>
                </div>
              </div>

              {parcelValidationMessage ? (
                <p className="checkout-address-error">{parcelValidationMessage}</p>
              ) : null}

            </section>

            <section className="checkout-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">5. Giao hàng</p>
                  <h2>Kết nối GHN</h2>
                </div>
              </div>

              {!shippingConfig.loading && !shippingConfig.enabled ? (
                <div className="checkout-address-preview">
                  <strong>Backend chưa cấu hình GHN</strong>
                  <p>Cần điền các biến còn thiếu trong `backend/.env` để bật GHN thật.</p>
                  {shippingConfig.missingFields.length ? (
                    <p>Còn thiếu: {shippingConfig.missingFields.join(", ")}</p>
                  ) : null}
                </div>
              ) : null}

              {shippingConfig.error ? (
                <p className="checkout-address-error">{shippingConfig.error}</p>
              ) : null}

              <label className="checkout-option active">
                <input type="radio" checked readOnly />
                <div>
                  <strong>{DELIVERY_OPTION.label}</strong>
                  <span>{DELIVERY_OPTION.description}</span>
                  <span>
                    {shippingConfig.enabled
                      ? `Môi trường: ${shippingConfig.useSandbox ? "Sandbox" : "Production"}`
                      : "Đang tạo đơn nội bộ."}
                  </span>
                  <span>
                    {canEstimateShipping
                      ? "Đã có đủ quận/huyện và phường/xã để gọi phí GHN."
                      : "Chọn đủ quận/huyện và phường/xã để lấy phí GHN."}
                  </span>
                </div>
                <em>{shippingLoading ? "Đang tính..." : formatCurrency(pricing.shippingFee)}</em>
              </label>

              {administrativeAddress ? (
                <div className="checkout-address-preview">
                  <strong>Khu vực đang gửi sang GHN để tính phí</strong>
                  <p>{administrativeAddress}</p>
                </div>
              ) : null}

              {shippingError ? <p className="checkout-address-error">{shippingError}</p> : null}
            </section>

            <section className="checkout-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">6. Thanh toán</p>
                  <h2>Phương thức thanh toán</h2>
                </div>
              </div>

              <div className="checkout-option-list">
                {PAYMENT_METHODS.map((item) => (
                  <label
                    key={item.id}
                    className={`checkout-option ${selectedPayment === item.id ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={item.id}
                      checked={selectedPayment === item.id}
                      onChange={() => setSelectedPayment(item.id)}
                    />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="checkout-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">7. Ghi chú</p>
                  <h2>Thông tin bổ sung</h2>
                </div>
              </div>

              <div className="checkout-form-grid">
                <label>
                  <span>Mã ưu đãi</span>
                  <input
                    value={voucherCode}
                    onChange={(event) => setVoucherCode(event.target.value)}
                    placeholder="Ví dụ: TIKTOK10"
                  />
                </label>

                <label className="checkout-form-span-2">
                  <span>Ghi chú cho shop</span>
                  <textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    placeholder="Gọi trước khi giao..."
                    rows="4"
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="checkout-summary-column">
            <section className="checkout-card checkout-summary-card">
              <div className="checkout-card-head">
                <div>
                  <p className="checkout-card-kicker">Tổng kết</p>
                  <h2>Đơn hàng của bạn</h2>
                </div>
              </div>

              <div className="checkout-summary-rows">
                <div>
                  <span>Tạm tính</span>
                  <strong>{formatCurrency(pricing.subtotal)}</strong>
                </div>
                <div>
                  <span>Vận chuyển</span>
                  <strong>{shippingLoading ? "Đang tính..." : formatCurrency(pricing.shippingFee)}</strong>
                </div>
                <div>
                  <span>Giảm giá</span>
                  <strong>- {formatCurrency(pricing.discount)}</strong>
                </div>
                <div className="checkout-summary-total">
                  <span>Tổng thanh toán</span>
                  <strong>{formatCurrency(pricing.total)}</strong>
                </div>
              </div>

              <div className="checkout-summary-note">
                <strong>
                  {selectedPayment === "cod"
                    ? "Thanh toán khi nhận hàng"
                    : "Thanh toán trước"}
                </strong>
                <p>
                  {shippingConfig.enabled
                    ? "Nếu GHN đã đủ thông tin shop, hệ thống sẽ tạo đơn GHN ngay lúc đặt hàng."
                    : "Nút đặt hàng hiện tại tạo đơn nội bộ do backend chưa có GHN credentials."}
                </p>
              </div>

              <button type="submit" className="checkout-primary-button" disabled={isPlacingOrder}>
                {isPlacingOrder ? "Đang tạo đơn..." : "Đặt hàng ngay"}
              </button>
              <button
                type="button"
                className="checkout-secondary-button"
                onClick={() => navigate(location.state?.source === "buy-now" ? -1 : "/cart")}
              >
                Quay lại
              </button>
            </section>
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}

export default CheckoutPage;
