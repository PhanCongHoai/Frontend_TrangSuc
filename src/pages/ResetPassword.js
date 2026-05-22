import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./Login.css";
import { buildApiUrl } from "../utils/api";

const API_BASE_URL = buildApiUrl();

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);

  useEffect(() => {
    let ignore = false;

    const verifyToken = async () => {
      try {
        setIsChecking(true);
        setError("");

        if (!token) {
          throw new Error("Liên kết cập nhật mật khẩu không hợp lệ.");
        }

        const response = await fetch(
          `${API_BASE_URL}/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Liên kết cập nhật mật khẩu không hợp lệ.");
        }

        if (!ignore) {
          setIsTokenValid(true);
        }
      } catch (verifyError) {
        if (!ignore) {
          setIsTokenValid(false);
          setError(verifyError.message || "Liên kết cập nhật mật khẩu không hợp lệ.");
        }
      } finally {
        if (!ignore) {
          setIsChecking(false);
        }
      }
    };

    verifyToken();

    return () => {
      ignore = true;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || !isTokenValid) {
      return;
    }

    try {
      setMessage("");
      setError("");

      if (!password || !confirmPassword) {
        setError("Vui lòng nhập mật khẩu mới và xác nhận mật khẩu.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Mật khẩu xác nhận không khớp.");
        return;
      }

      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể cập nhật mật khẩu.");
      }

      setMessage(data.message || "Cập nhật mật khẩu thành công.");
      setPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (submitError) {
      setError(submitError.message || "Không thể cập nhật mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <h1>JEWELRYBOOK</h1>
          <p>Cập nhật mật khẩu mới để tiếp tục sử dụng tài khoản.</p>
        </div>

        <div className="login-right">
          <form className="login-card" autoComplete="off" onSubmit={handleSubmit}>
            <h2>Cập nhật mật khẩu</h2>
            <p className="login-card-copy">
              Nhập mật khẩu mới cho tài khoản của bạn. Liên kết chỉ dùng được một lần.
            </p>

            {isChecking ? <p className="login-note">Đang kiểm tra liên kết...</p> : null}
            {message ? <div className="login-success">{message}</div> : null}
            {error ? <div className="login-error">{error}</div> : null}

            <input
              type="password"
              name="reset_password"
              autoComplete="new-password"
              placeholder="Mật khẩu mới"
              value={password}
              disabled={!isTokenValid || isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
            />

            <input
              type="password"
              name="reset_confirm_password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              disabled={!isTokenValid || isSubmitting}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />

            <button
              type="submit"
              className="login-btn"
              disabled={!isTokenValid || isSubmitting}
            >
              {isSubmitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>

            <Link to="/forgot-password" className="forgot-password">
              Gửi lại email cập nhật mật khẩu
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
