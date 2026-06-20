import React from "react";

function StorySection() {
  const storyFeatures = [
    {
      icon: "✨",
      title: "Nguyên liệu tuyệt mỹ",
      desc: "Lựa chọn từ 100% bạc tinh khiết, vàng chuẩn tuổi và những viên đá quý lấp lánh có kiểm định nghiêm ngặt."
    },
    {
      icon: "⚒️",
      title: "Chế tác thủ công tinh xảo",
      desc: "Từng chi tiết được mài giũa, hoàn thiện tinh tế bởi đôi bàn tay tài hoa của các nghệ nhân kim hoàn lành nghề."
    },
    {
      icon: "⚜️",
      title: "Thiết kế độc bản",
      desc: "Sự kết hợp hoàn hảo giữa nét cổ điển sang trọng và hơi thở đương đại tối giản, tôn vinh nét riêng của bạn."
    }
  ];

  return (
    <section className="brand-story-section">
      <div className="brand-story-container">
        <div className="brand-story-content">
          <span className="brand-story-kicker">Câu chuyện thương hiệu</span>
          <h2 className="brand-story-title">Nghệ Thuật Chế Tác Thủ Công Tinh Xảo</h2>
          <p className="brand-story-desc">
            Mỗi tác phẩm tại JewelryBook không chỉ đơn thuần là món trang sức, mà là một tác phẩm nghệ thuật 
            được kết tinh từ sự đam mê, tỉ mỉ và đôi bàn tay tài hoa của những nghệ nhân kim hoàn. Chúng tôi 
            luôn nỗ lực không ngừng để tạo ra những thiết kế vượt thời gian, đồng hành cùng bạn ghi dấu 
            những khoảnh khắc thiêng liêng nhất của cuộc đời.
          </p>
          <div className="brand-story-features">
            {storyFeatures.map((feat, idx) => (
              <div key={idx} className="brand-story-feature-item">
                <div className="brand-story-feature-icon">{feat.icon}</div>
                <div className="brand-story-feature-text">
                  <h3>{feat.title}</h3>
                  <p>{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="brand-story-visual">
          <div className="brand-story-image-wrapper">
            <img 
              src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=800&q=80" 
              alt="Quy trình chế tác thủ công tinh xảo" 
              className="brand-story-image"
              loading="lazy"
            />
            <div className="brand-story-image-overlay"></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StorySection;
