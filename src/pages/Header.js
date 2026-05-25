import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import ChatWidget from "../components/ChatWidget";
import AiAdvisorWidget from "../components/AiAdvisorWidget";
import "./Header.css";
import {
  AUTH_SESSION_CHANGED_EVENT,
  clearAuthSession,
  getCurrentUser,
  isAdminUser,
} from "../utils/auth";
import { getCartCount, subscribeCartChange } from "../utils/cart";
import {
  fetchCompareConfig,
  getCompareConfig,
  getCompareCount,
  subscribeCompareChange,
} from "../utils/compare";
import {
  buildChatQuery,
  getChatIdentity,
  getChatLastSeenAt,
  markChatLastSeen,
} from "../utils/chat";
import { buildApiUrl } from "../utils/api";

function CartIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="19" r="1.6" />
      <circle cx="18" cy="19" r="1.6" />
      <path d="M3 4h2.2l2.1 9.3a1 1 0 0 0 1 .7h9.5a1 1 0 0 0 1-.8l1.4-5.7H7.1" />
    </svg>
  );
}

function AiChatIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4 3v-6.2A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M9 10h.01M12 10h.01M15 10h.01" />
    </svg>
  );
}

function MenuIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function isAuthSessionError(data, status) {
  return (
    data?.code === "TOKEN_EXPIRED" ||
    data?.code === "INVALID_TOKEN" ||
    data?.code === "ACCOUNT_BLOCKED" ||
    status === 401
  );
}

function Header() {
  const navigate = useNavigate();
  const profileAccountRef = useRef(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileCardOpen, setIsProfileCardOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [cartCount, setCartCount] = useState(() => (getCurrentUser() ? getCartCount() : 0));
  const [compareCount, setCompareCount] = useState(() => getCompareCount());
  const [compareMaxItems, setCompareMaxItems] = useState(() => getCompareConfig().maxItems);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const syncAuthState = () => {
      const nextUser = getCurrentUser();
      setCurrentUser(nextUser);
      setCartCount(nextUser ? getCartCount() : 0);
    };

    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncAuthState);

    const unsubscribeCart = subscribeCartChange(() => {
      setCartCount(getCurrentUser() ? getCartCount() : 0);
    });
    const unsubscribeCompare = subscribeCompareChange((items) => {
      setCompareCount(items.length);
    });

    fetchCompareConfig().then((config) => {
      setCompareMaxItems(config.maxItems);
    });

    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncAuthState);
      unsubscribeCart();
      unsubscribeCompare();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const isOwnChatMessage = (message) => {
      if (message?.senderType === "admin") {
        return false;
      }

      const activeUser = getCurrentUser();

      if (activeUser?.id) {
        return Number(message?.senderUserId || 0) === Number(activeUser.id);
      }

      return message?.senderType === "guest";
    };

    const syncChatNotification = async () => {
      try {
        const identity = getChatIdentity();
        const response = await fetch(
          `${buildApiUrl("/api/chat/me")}?${buildChatQuery(identity)}`
        );
        const data = await response.json();

        if (isAuthSessionError(data, response.status)) {
          clearAuthSession();
          if (data?.code === "ACCOUNT_BLOCKED") {
            navigate("/login", {
              replace: true,
              state: {
                accountBlocked: true,
                message: data?.message,
              },
            });
          }
          return;
        }

        if (!isMounted || !response.ok || !data?.success || !Array.isArray(data.messages)) {
          return;
        }

        const incomingMessages = data.messages.filter((message) => !isOwnChatMessage(message));

        if (!incomingMessages.length) {
          setUnreadChatCount(0);
          return;
        }

        const latestIncomingMessage = incomingMessages[incomingMessages.length - 1];

        if (!latestIncomingMessage?.createdAt) {
          setUnreadChatCount(0);
          return;
        }

        if (isChatOpen) {
          markChatLastSeen(latestIncomingMessage.createdAt);
          setUnreadChatCount(0);
          return;
        }

        const lastSeenAt = getChatLastSeenAt();
        const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
        const unreadCount = incomingMessages.filter((message) => {
          const messageTime = new Date(message.createdAt || 0).getTime();
          return Number.isFinite(messageTime) && messageTime > lastSeenTime;
        }).length;

        setUnreadChatCount(unreadCount);
      } catch (error) {
        if (isMounted) {
          setUnreadChatCount(0);
        }
      }
    };

    syncChatNotification();
    const intervalId = setInterval(syncChatNotification, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isChatOpen, navigate]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileCardOpen(false);
  }, [currentUser]);

  useEffect(() => {
    if (!isProfileCardOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (profileAccountRef.current?.contains(event.target)) {
        return;
      }

      setIsProfileCardOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isProfileCardOpen]);

  const profileLabel = useMemo(() => {
    if (!currentUser) return "";
    return currentUser.fullName || currentUser.username || currentUser.email || "Người dùng";
  }, [currentUser]);

  const profileInitial = useMemo(() => {
    if (!profileLabel) return "N";
    return profileLabel.trim().charAt(0).toUpperCase();
  }, [profileLabel]);

  const canReturnToAdmin = useMemo(() => isAdminUser(currentUser), [currentUser]);

  const handleLogout = () => {
    clearAuthSession();
    setIsProfileCardOpen(false);
    setCurrentUser(null);
    navigate("/", { replace: true });
  };

  const handleOpenCart = () => {
    setIsProfileCardOpen(false);

    if (!currentUser) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }

    navigate("/cart");
  };

  const handleOpenChat = () => {
    setIsMobileMenuOpen(false);
    setIsProfileCardOpen(false);
    setIsAiChatOpen(false);
    setIsChatOpen(true);
    setUnreadChatCount(0);
    markChatLastSeen();
  };

  const handleOpenAiChat = () => {
    setIsMobileMenuOpen(false);
    setIsProfileCardOpen(false);
    setIsChatOpen(false);
    setIsAiChatOpen(true);
  };

  const handleChatMessagesSeen = (timestamp) => {
    if (timestamp) {
      markChatLastSeen(timestamp);
    }
    setUnreadChatCount(0);
  };

  const cartButton = (
    <button
      type="button"
      className="cart-button"
      aria-label="Giỏ hàng"
      onClick={handleOpenCart}
    >
      <CartIcon className="cart-icon" />
      {currentUser && cartCount > 0 ? <span className="cart-badge">{cartCount}</span> : null}
    </button>
  );

  const handleNavigateFromMenu = () => {
    setIsMobileMenuOpen(false);
    setIsProfileCardOpen(false);
  };

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button
            type="button"
            className={`mobile-menu-toggle${isMobileMenuOpen ? " is-open" : ""}`}
            aria-label={isMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => {
              setIsProfileCardOpen(false);
              setIsMobileMenuOpen((value) => !value);
            }}
          >
            <MenuIcon className="mobile-menu-toggle-icon" />
          </button>

          <Link to="/" className="brand">
            JEWELRYBOOK
          </Link>

          <nav className={`header-nav${isMobileMenuOpen ? " is-open" : ""}`}>
            <NavLink to="/" end onClick={handleNavigateFromMenu}>
              Trang chủ
            </NavLink>
            <NavLink to="/products" onClick={handleNavigateFromMenu}>
              Sản phẩm
            </NavLink>
            <NavLink to="/orders" onClick={handleNavigateFromMenu}>
              Đơn hàng
            </NavLink>
            <NavLink
              to="/compare"
              className="header-compare-link"
              onClick={handleNavigateFromMenu}
            >
              So sánh
              {compareCount > 0 ? (
                <span className="header-compare-badge">
                  {compareCount}/{compareMaxItems}
                </span>
              ) : null}
            </NavLink>
            <NavLink to="/about" onClick={handleNavigateFromMenu}>
              Giới thiệu
            </NavLink>
            <button
              type="button"
              className={`header-nav-button${unreadChatCount > 0 ? " has-notification" : ""}`}
              onClick={handleOpenChat}
            >
              Liên hệ
              {unreadChatCount > 0 ? (
                <span className="header-nav-badge">
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </span>
              ) : null}
            </button>
          </nav>

          {!currentUser ? (
            <div className="header-actions">
              {cartButton}
              <Link to="/login" className="btn btn-outline">
                Đăng nhập
              </Link>
              <Link to="/register" className="btn btn-solid">
                Đăng ký
              </Link>
            </div>
          ) : (
            <div className="profile-box">
              {cartButton}
              <div
                ref={profileAccountRef}
                className={`profile-account${isProfileCardOpen ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="profile-trigger"
                  aria-label={`Xem tài khoản ${profileLabel}`}
                  aria-expanded={isProfileCardOpen}
                  onClick={() => setIsProfileCardOpen((value) => !value)}
                >
                  <div className="profile-icon">{profileInitial}</div>
                </button>
                <div className="profile-meta">
                  <strong>{profileLabel}</strong>
                  <span>{currentUser.email}</span>
                </div>
                {isProfileCardOpen ? (
                  <div className="profile-card">
                    <p className="profile-card-label">Tài khoản đang đăng nhập</p>
                    <strong>{profileLabel}</strong>
                    {currentUser.email ? <span>{currentUser.email}</span> : null}
                    {canReturnToAdmin ? (
                      <Link
                        to="/admin/dashboard"
                        className="profile-card-link"
                        onClick={handleNavigateFromMenu}
                      >
                        Vào trang admin
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {canReturnToAdmin ? (
                <Link to="/admin/dashboard" className="btn btn-admin">
                  Về admin
                </Link>
              ) : null}
              <button type="button" className="btn btn-outline" onClick={handleLogout}>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </header>

      <ChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onMessagesSeen={handleChatMessagesSeen}
      />
      <button
        type="button"
        className="ai-chat-fab"
        aria-label="Mở tư vấn AI"
        onClick={handleOpenAiChat}
      >
        <AiChatIcon className="ai-chat-fab-icon" />
      </button>
      <AiAdvisorWidget isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />
    </>
  );
}

export default Header;
