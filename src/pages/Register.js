import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Register.css";
import { buildApiUrl } from "../utils/api";

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async () => {
    try {
      if (!fullName || !email || !password || !confirmPassword) {
        alert("Vui lòng nhập đầy đủ thông tin.");
        return;
      }

      if (password !== confirmPassword) {
        alert("Mật khẩu xác nhận không khớp.");
        return;
      }

      const response = await fetch(buildApiUrl("/api/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        navigate("/login", { replace: true });
      } else {
        alert(data.message || "Đăng ký thất bại.");
      }
    } catch (error) {
      console.error("Register error:", error);
      alert("Không thể kết nối tới server.");
    }
  };

  return (
    <div className="register-page">
      <div className="register-container" autoComplete="off">
        <h1>Tạo tài khoản</h1>

        <input
          type="text"
          name="register_full_name"
          autoComplete="off"
          placeholder="Họ và tên"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          type="email"
          name="register_email"
          autoComplete="off"
          inputMode="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          name="register_password"
          autoComplete="new-password"
          placeholder="Mật khẩu mới"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          name="register_confirm_password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Link to="/login" className="back-login-link">
          Quay lại
        </Link>

        <button className="register-btn" onClick={handleRegister}>
          Đăng ký
        </button>
      </div>
    </div>
  );
}

export default Register;
