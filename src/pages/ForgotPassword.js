import { useState } from "react";
import { Link } from "react-router-dom";
import "./Login.css";
import { buildApiUrl } from "../utils/api";

const API_BASE_URL = buildApiUrl();

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setMessage("");
      setError("");

      if (!email.trim()) {
        setError("Vui lòng nhập email tài khoản.");
        return;
      }

      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể gửi email cập nhật mật khẩu.");
      }

      setMessage(data.message || "Hãy kiểm tra Gmail để cập nhật mật khẩu.");
    } catch (submitError) {
      setError(submitError.message || "Không thể gửi email cập nhật mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <h1>JEWELRYBOOK</h1>
          <p>Nhận liên kết cập nhật mật khẩu qua Gmail.</p>
        </div>

        <div className="login-right">
          <form className="login-card" autoComplete="off" onSubmit={handleSubmit}>
            <h2>Quên mật khẩu</h2>
            <p className="login-card-copy">
              Nhập email đã đăng ký. JewelryBook sẽ gửi giao diện cập nhật mật khẩu vào hộp thư của bạn.
            </p>

            {message ? <div className="login-success">{message}</div> : null}
            {error ? <div className="login-error">{error}</div> : null}

            <input
              type="email"
              name="forgot_email"
              autoComplete="username"
              inputMode="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <button type="submit" className="login-btn" disabled={isSubmitting}>
              {isSubmitting ? "Đang gửi..." : "Gửi email cập nhật"}
            </button>

            <Link to="/login" className="forgot-password">
              Quay lại đăng nhập
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
