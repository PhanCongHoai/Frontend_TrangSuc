import { Link } from "react-router-dom";
import Header from "./Header";
import Footer from "./footer/Footer";
import "./AboutPage.css";

const HERO_IMAGE =
  "https://png.pngtree.com/thumb_back/fh260/background/20250417/pngtree-blue-flowers-and-gems-jewelry-with-shiny-diamonds-gold-accents-on-image_17206482.jpg";

const SHOWROOM_IMAGE =
  "https://cdn.hpdecor.vn/wp-content/uploads/2021/11/thiet-ke-cua-hang-vang-bac-8.jpg";

const steps = [
  {
    title: "1. Chọn chất liệu như chọn nguyên liệu",
    content:
      "Mỗi thiết kế bắt đầu từ vàng, bạc và đá được kiểm soát chuẩn độ tinh khiết để giữ độ sáng lâu dài và cảm giác đeo thoải mái.",
  },
  {
    title: "2. Tạo hình từng chi tiết bằng tay",
    content:
      "Thợ kim hoàn tinh chỉnh ngàm đá, độ cong và bề mặt theo từng mẫu, giúp sản phẩm nổi bật cả khi nhìn gần lẫn khi lên ảnh.",
  },
  {
    title: "3. Hoàn thiện theo phong cách cá nhân",
    content:
      "Bạn có thể tùy chỉnh màu vàng, khắc tên và kích thước để món trang sức mang đúng câu chuyện riêng trước khi hoàn thiện giao hàng.",
  },
];

function AboutPage() {
  return (
    <div className="about-page">
      <Header />

      <main className="about-main">
        <section className="about-split about-split-hero">
          <article className="about-text-block">
            <p className="about-kicker">JOURNAL • JEWELRYBOOK</p>
            <h1>JewelryBook là nơi bạn chọn trang sức dễ đeo, dễ phối và đúng nhu cầu</h1>

            <p className="about-hook">
              <strong>Nếu bạn muốn tìm một món trang sức vừa đẹp vừa dễ dùng hằng ngày</strong>, đây là nơi bắt
              đầu phù hợp. JewelryBook ưu tiên trải nghiệm thật: rõ thông tin, dễ so sánh và dễ chọn.
            </p>

            <p>
              Chúng tôi tập trung vào các mẫu dùng được trong nhiều tình huống: <strong>đi làm</strong>,
              <strong> đi chơi</strong>, hoặc <strong>dự tiệc nhẹ</strong>. Thiết kế đặt trọng tâm vào độ bền,
              độ thoải mái và khả năng phối đồ.
            </p>

            <h2>Thông tin rõ ràng để bạn quyết định nhanh hơn</h2>
            <ul className="about-bullet-list">
              <li>
                Mỗi sản phẩm đều có mô tả rõ về <strong>chất liệu</strong>, <strong>kích thước</strong> và
                <strong> mức giá</strong>.
              </li>
              <li>
                Bạn có thể đối chiếu nhiều mẫu để chọn phương án phù hợp với <strong>ngân sách</strong>.
              </li>
              <li>
                Khi cần, đội ngũ tư vấn sẽ gợi ý theo <strong>phong cách cá nhân</strong> và nhu cầu sử dụng.
              </li>
            </ul>
          </article>

          <div className="about-image-block">
            <img src={HERO_IMAGE} alt="Trang sức với sắc xanh và ánh kim" loading="eager" />
          </div>
        </section>

        <section className="about-split about-split-story">
          <div className="about-image-block">
            <img src={SHOWROOM_IMAGE} alt="Không gian showroom JewelryBook" loading="lazy" />
          </div>

          <article className="about-text-block">
            <p className="about-kicker">CÔNG THỨC TẠO NÊN MỘT MẪU TRANG SỨC</p>
            <h2>Ba bước cốt lõi trong quy trình JewelryBook</h2>
            <div className="about-steps-list">
              {steps.map((step) => (
                <section key={step.title} className="about-step-item">
                  <h3>{step.title}</h3>
                  <p>{step.content}</p>
                </section>
              ))}
            </div>
          </article>
        </section>

        <section className="about-split about-split-ending">
          <article className="about-text-block">
            <p className="about-kicker">TRẢI NGHIỆM THỰC TẾ</p>
            <h2>Không gian tư vấn giúp bạn chọn đúng món trang sức cho mình</h2>
            <p>
              Tại showroom, đội ngũ tư vấn sẽ hỗ trợ phối theo tông da, kiểu trang phục và ngân sách. Bạn có
              thể thử trực tiếp để cảm nhận độ hoàn thiện trước khi quyết định.
            </p>
            <p>
              JewelryBook không chỉ bán sản phẩm, mà đồng hành để mỗi lựa chọn đều phù hợp với cá tính và nhu
              cầu sử dụng thật.
            </p>

            <h3>Kết luận ngắn</h3>
            <p className="about-conclusion">
              Một món trang sức đẹp nên là món bạn muốn đeo nhiều lần, không chỉ cất trong hộp. Vì vậy, chúng
              tôi ưu tiên sự cân bằng giữa <strong>thẩm mỹ</strong>, <strong>độ bền</strong> và
              <strong> tính ứng dụng</strong>.
            </p>

            <Link to="/products" className="about-cta">
              Khám phá sản phẩm ngay
            </Link>
          </article>

          <div className="about-image-block">
            <img src={HERO_IMAGE} alt="Chi tiết trang sức ánh kim" loading="lazy" />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default AboutPage;
