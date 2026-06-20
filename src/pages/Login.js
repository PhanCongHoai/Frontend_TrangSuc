import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Login.css";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  clearAuthSession,
  isAdminUser,
  notifyAuthSessionChanged,
} from "../utils/auth";
import { buildApiUrl } from "../utils/api";

const API_URL = buildApiUrl("/api/auth/login");
const LOGIN_TIMEOUT_MS = 8000;
function normalizeLoginError(data, status) {
  const rawMessage = String(data?.message || "").trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (
    data?.code === "ACCOUNT_BLOCKED" ||
    status === 403 ||
    /blocked|disabled|bị chặn|bi chan/i.test(rawMessage)
  ) {
    return rawMessage || BLOCKED_ACCOUNT_MESSAGE;
  }

  if (lowerMessage.includes("incorrect password")) {
    return "Mật khẩu không chính xác. Vui lòng thử lại.";
  }
  if (lowerMessage.includes("email not found")) {
    return "Email không tồn tại trên hệ thống.";
  }
  if (lowerMessage.includes("please provide email and password")) {
    return "Vui lòng nhập đầy đủ email và mật khẩu.";
  }
  if (lowerMessage.includes("server error")) {
    return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
  }

  return rawMessage || `Đăng nhập thất bại (HTTP ${status}).`;
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enableSavedAccountHints, setEnableSavedAccountHints] = useState(false);
  const [allowTyping, setAllowTyping] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const adminOnlyMessage = location.state?.adminOnly;
  const sessionExpiredMessage = location.state?.sessionExpired;
  const accountBlockedMessage = location.state?.accountBlocked
    ? location.state?.message || BLOCKED_ACCOUNT_MESSAGE
    : "";
  const redirectTarget = location.state?.from || null;

  const completeLogin = useCallback(
    (data) => {
      clearAuthSession();

      if (redirectTarget?.startsWith("/admin") && !isAdminUser(data.user)) {
        setLoginError("Tài khoản này không có quyền truy cập trang admin.");
        return;
      }

      if (data.accessToken) {
        sessionStorage.setItem("accessToken", data.accessToken);
      }
      if (data.user) {
        sessionStorage.setItem("currentUser", JSON.stringify(data.user));
      }

      notifyAuthSessionChanged();

      const nextPath = redirectTarget || (isAdminUser(data.user) ? "/admin/dashboard" : "/");
      navigate(nextPath, { replace: true });
    },
    [navigate, redirectTarget]
  );

  const handleEnableHints = () => {
    if (!enableSavedAccountHints) {
      setEnableSavedAccountHints(true);
    }
  };

  const handleEnableTyping = () => {
    if (!allowTyping) {
      setAllowTyping(true);
    }
    handleEnableHints();
  };

  const handlePrepareMobileInput = (event) => {
    handleEnableTyping();

    const target = event.currentTarget;
    target.removeAttribute("readonly");

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        target.focus();
      });
    }
  };

  const handleLogin = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

    try {
      setLoginError("");

      if (!email || !password) {
        setLoginError("Vui lòng nhập email và mật khẩu.");
        return;
      }

      setIsSubmitting(true);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const rawResponse = await res.text();
      let data = null;

      try {
        data = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        throw new Error("Backend trả về dữ liệu không hợp lệ. Hãy kiểm tra server.");
      }

      if (res.ok && data?.success) {
        completeLogin(data);
      } else {
        setLoginError(normalizeLoginError(data, res.status));
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.name === "AbortError") {
        setLoginError("Backend phản hồi quá lâu. Hãy kiểm tra server có đang chạy không.");
      } else if (error instanceof TypeError) {
        setLoginError("Không thể kết nối đến backend. Hãy khởi động backend rồi thử lại.");
      } else {
        setLoginError(error.message || "Đã xảy ra lỗi khi đăng nhập.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    await handleLogin();
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <h1>JEWELRYBOOK</h1>
        </div>

        <div className="login-right">
          <form className="login-card" autoComplete="off" onSubmit={handleSubmit}>
            {adminOnlyMessage ? (
              <p className="login-note">
                Vui lòng đăng nhập bằng tài khoản admin để vào trang quản trị.
              </p>
            ) : null}
            {sessionExpiredMessage ? (
              <p className="login-note">{SESSION_EXPIRED_MESSAGE}</p>
            ) : null}
            {accountBlockedMessage ? (
              <p className="login-note">{accountBlockedMessage}</p>
            ) : null}
            {loginError ? <div className="login-error">{loginError}</div> : null}
            <input
              type="text"
              name="fake_username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: "none" }}
            />
            <input
              type="password"
              name="fake_password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: "none" }}
            />
            <input
              type="email"
              name="login_email"
              autoComplete={enableSavedAccountHints ? "username" : "off"}
              inputMode="email"
              placeholder="Email"
              value={email}
              readOnly={!allowTyping}
              onTouchStart={handlePrepareMobileInput}
              onPointerDown={handlePrepareMobileInput}
              onFocus={handleEnableTyping}
              onKeyDown={handleEnableHints}
              onChange={(event) => setEmail(event.target.value)}
            />

            <input
              type="password"
              name="login_password"
              autoComplete={enableSavedAccountHints ? "current-password" : "off"}
              placeholder="Mật khẩu"
              value={password}
              readOnly={!allowTyping}
              onTouchStart={handlePrepareMobileInput}
              onPointerDown={handlePrepareMobileInput}
              onFocus={handleEnableTyping}
              onKeyDown={handleEnableHints}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button type="submit" className="login-btn" disabled={isSubmitting}>
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <Link to="/forgot-password" className="forgot-password">
              Quên mật khẩu?
            </Link>

            <Link to="/register" className="create-link create-btn">
              Tạo tài khoản mới
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
