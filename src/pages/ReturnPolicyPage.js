import Header from "./Header";
import Footer from "./footer/Footer";
import "./ReturnPolicyPage.css";

function ReturnPolicyPage() {
  return (
    <div className="policy-page">
      <Header />
      <main className="policy-shell">
        <section className="policy-card">
          <div className="policy-header">
            <span className="policy-kicker">Chính sách hỗ trợ</span>
            <h1>Chính sách Hoàn trả & Hoàn tiền</h1>
            <p>Hiệu lực áp dụng từ ngày 01/01/2026</p>
          </div>

          <div className="policy-content">
            <p>
              Tại <strong>JewelryBook</strong>, chúng tôi luôn cam kết đem lại cho quý khách những sản phẩm trang sức tinh xảo nhất cùng trải nghiệm mua sắm tuyệt vời. Nếu quý khách không hoàn toàn hài lòng với sản phẩm nhận được, chúng tôi sẵn sàng hỗ trợ đổi trả hàng và hoàn tiền theo các điều khoản cụ thể dưới đây.
            </p>

            <hr className="policy-divider" />

            <div className="policy-section">
              <h3>1. Điều kiện áp dụng hoàn trả</h3>
              <p>Sản phẩm chỉ được chấp nhận hoàn trả và hoàn tiền khi đáp ứng đầy đủ các tiêu chí sau:</p>
              <ul>
                <li>Thời gian yêu cầu hoàn trả trong vòng <strong>7 ngày</strong> kể từ ngày giao hàng thành công.</li>
                <li>Sản phẩm còn nguyên vẹn, không có dấu hiệu đã qua sử dụng, không bị trầy xước, móp méo hay thay đổi cấu trúc ban đầu.</li>
                <li>Sản phẩm phải còn đầy đủ hóa đơn mua hàng, hộp đựng, thẻ bảo hành, các quà tặng kèm theo (nếu có).</li>
                <li>Chính sách không áp dụng đối với các sản phẩm được gia công riêng theo yêu cầu cá nhân hóa (khắc chữ, đặt size đặc biệt) hoặc sản phẩm nằm trong chương trình xả kho giảm giá sâu (giá sốc).</li>
              </ul>
            </div>

            <div className="policy-section">
              <h3>2. Các trường hợp được hoàn trả miễn phí</h3>
              <p>Chúng tôi chịu trách nhiệm 100% chi phí vận chuyển thu hồi sản phẩm trong các trường hợp:</p>
              <ul>
                <li>Sản phẩm bị lỗi kỹ thuật từ nhà sản xuất (lỗi khóa, đứt gãy kết cấu cơ học trước khi dùng...).</li>
                <li>Sản phẩm bị hư hỏng nghiêm trọng trong quá trình vận chuyển của đối tác giao hàng.</li>
                <li>Giao sai mẫu mã, màu sắc hoặc sai kích thước so với thông tin đơn hàng đã đặt của quý khách.</li>
              </ul>
            </div>

            <div className="policy-section">
              <h3>3. Quy trình thực hiện hoàn trả</h3>
              <p>Quý khách vui lòng thực hiện theo các bước sau:</p>
              <ol>
                <li>Truy cập mục <strong>"Hoàn hàng"</strong> trên thanh menu Header của website.</li>
                <li>Chọn đơn hàng đủ điều kiện hoàn trả từ danh sách.</li>
                <li>Điền đầy đủ thông tin tài khoản ngân hàng nhận lại tiền bao gồm: Tên ngân hàng, Số tài khoản và Tên chủ tài khoản viết hoa không dấu.</li>
                <li>Ghi rõ lý do hoàn trả và bấm <strong>"Gửi yêu cầu hoàn tiền"</strong>.</li>
                <li>Sau khi nhận được yêu cầu, bộ phận CSKH của JewelryBook sẽ liên hệ xác nhận trong vòng 24h và hướng dẫn gửi sản phẩm về trung tâm kiểm định của chúng tôi.</li>
              </ol>
            </div>

            <div className="policy-section">
              <h3>4. Phương thức hoàn tiền & Thời gian xử lý</h3>
              <ul>
                <li>Sau khi sản phẩm hoàn trả được gửi về bưu cục và kiểm định đạt điều kiện hoàn trả, Admin sẽ tích xác nhận hoàn trả.</li>
                <li>Hệ thống tự động chuyển đổi trạng thái đơn hàng và gửi email thông báo xác nhận chuyển khoản hoàn tiền thành công về Gmail của khách hàng.</li>
                <li>Tiền sẽ được chuyển khoản trực tiếp về số tài khoản quý khách cung cấp trong vòng <strong>3-5 ngày làm việc</strong> tùy thuộc vào hệ thống liên ngân hàng.</li>
              </ul>
            </div>

            <div className="policy-section note-card">
              <h4>⚠️ Lưu ý quan trọng</h4>
              <p>
                Quý khách vui lòng quay video mở kiện hàng (unboxing) khi nhận hàng từ shipper. Đây là bằng chứng quan trọng nhất giúp JewelryBook hỗ trợ giải quyết nhanh chóng các khiếu nại về hư hỏng do vận chuyển hoặc thiếu sản phẩm.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default ReturnPolicyPage;
