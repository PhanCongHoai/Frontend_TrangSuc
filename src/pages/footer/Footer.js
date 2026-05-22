import "./Footer.css";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <section className="footer-col footer-brand">
          <h3>JEWELRYBOOK</h3>
          <p>
            Thương hiệu trang sức theo phong cách hiện đại, tối giản và sang
            trọng.
          </p>
        </section>

        <section className="footer-col">
          <h4>Danh mục</h4>
          <a href="/products">Sản phẩm</a>
          <a href="/compare">So sánh sản phẩm</a>
          <a href="/register">Đăng ký tài khoản</a>
        </section>

        <section className="footer-col">
          <h4>Hỗ trợ</h4>
          <a href="/contact">Liên hệ</a>
          <a href="/about">Giới thiệu</a>
          <a href="/login">Đăng nhập</a>
        </section>

        <section className="footer-col">
          <h4>Thông tin liên hệ</h4>
          <p>Email: support@jewelrybook.vn</p>
          <p>Hotline: 0900 000 999</p>
          <p>Địa chỉ: 123 Nguyễn Huệ, Quận 1, TP.HCM</p>
        </section>
      </div>

      <div className="footer-bottom">
        <p>© 2026 JewelryBook. Bảo lưu mọi quyền.</p>
      </div>
    </footer>
  );
}

export default Footer;
