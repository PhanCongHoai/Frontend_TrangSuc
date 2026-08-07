import { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../../../utils/api";
import { getAuthHeaders } from "../../../utils/auth";
import "./SmartReportPage.css";

const SMART_REPORT_API = buildApiUrl("/api/ai-chat/smart-report");
const SMART_REPORT_HISTORY_API = buildApiUrl("/api/ai-chat/smart-report/history");

const renderMessageContent = (text) => {
  if (!text) return "";
  
  // Split text by markdown links like [product name](/products/12)
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      const linkText = match[1];
      const url = match[2];
      
      const productRouteMatch = url.match(/(?:\/products\/\d+|\/products\/[a-zA-Z0-9-]+)/);
      if (productRouteMatch) {
        const relativePath = productRouteMatch[0];
        return (
          <a
            key={index}
            href={relativePath}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-advisor-link"
          >
            {linkText}
          </a>
        );
      }
      
      const isInternal = url.startsWith("/") || url.startsWith(window.location.origin);
      if (isInternal) {
        const path = url.startsWith("/") ? url : url.substring(window.location.origin.length);
        return (
          <a
            key={index}
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-advisor-link"
          >
            {linkText}
          </a>
        );
      } else {
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-advisor-link"
          >
            {linkText}
          </a>
        );
      }
    }
    
    const subParts = part.split("\n");
    return subParts.map((subPart, subIndex) => (
      <span key={`${index}-${subIndex}`}>
        {subPart}
        {subIndex < subParts.length - 1 && <br />}
      </span>
    ));
  });
};

function SmartReportPage() {
  const [messages, setMessages] = useState([
    {
      id: "greet",
      role: "assistant",
      content: "Xin chào! Tôi là Trợ lý Báo cáo Thông minh (AI Text-to-SQL). Hãy nhập câu hỏi về doanh thu, đơn hàng, sản phẩm hoặc khách hàng của cửa hàng JewelryBook để tôi tự động truy vấn dữ liệu và phân tích báo cáo cho bạn bằng văn bản.",
    }
  ]);
  
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);

  // Load chat history from SQL Server on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoadingHistory(true);
        setError("");
        const response = await fetch(SMART_REPORT_HISTORY_API, {
          method: "GET",
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (response.ok && data.success && Array.isArray(data.data)) {
          if (data.data.length > 0) {
            const mapped = data.data.map((msg, index) => ({
              id: `db-${index}-${Date.now()}`,
              role: msg.role,
              content: msg.content,
            }));
            setMessages(mapped);
          } else {
            setMessages([
              {
                id: "greet",
                role: "assistant",
                content: "Xin chào! Tôi là Trợ lý Báo cáo Thông minh (AI Text-to-SQL). Hãy nhập câu hỏi về doanh thu, đơn hàng, sản phẩm hoặc khách hàng của cửa hàng JewelryBook để tôi tự động truy vấn dữ liệu và phân tích báo cáo cho bạn bằng văn bản.",
              }
            ]);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải lịch sử báo cáo thông minh:", err);
        setError("Không thể tải lịch sử báo cáo thông minh.");
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  // Automatically scroll to the bottom of the chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (event) => {
    event.preventDefault();
    const query = inputValue.trim();
    if (!query || loading) return;

    setInputValue("");
    setError("");
    setLoading(true);

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);

    // Build chat history for Gemini
    const history = messages
      .filter((m) => m.id !== "greet")
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const response = await fetch(SMART_REPORT_API, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          message: query,
          history,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể lấy phản hồi báo cáo từ AI.");
      }

      const aiData = data.data || {};
      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: aiData.reply || "Tôi không thể xử lý câu trả lời lúc này.",
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error("Smart Report error:", err);
      setError(err.message || "Đã xảy ra lỗi khi gửi yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử hỏi đáp báo cáo thông minh?")) {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(SMART_REPORT_HISTORY_API, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể xóa lịch sử báo cáo.");
        }

        setMessages([
          {
            id: "greet",
            role: "assistant",
            content: "Xin chào! Tôi là Trợ lý Báo cáo Thông minh (AI Text-to-SQL). Hãy nhập câu hỏi về doanh thu, đơn hàng, sản phẩm hoặc khách hàng của cửa hàng JewelryBook để tôi tự động truy vấn dữ liệu và phân tích báo cáo cho bạn bằng văn bản.",
          }
        ]);
      } catch (err) {
        console.error("Lỗi khi xóa lịch sử báo cáo thông minh:", err);
        setError(err.message || "Lỗi khi xóa lịch sử báo cáo.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <section className="panel-page smart-report-page">
      <div className="page-head">
        <h1>Báo cáo thông minh (AI Agent)</h1>
        <p>Hỏi đáp dữ liệu trực tiếp bằng tiếng Việt. AI tự động truy vấn thực thi trên Database để phân tích và phản hồi báo cáo bằng văn bản.</p>
      </div>

      <div className="smart-report-workspace-single">
        {/* Single Full Width Chat Console */}
        <div className="smart-report-chat-container-full">
          <div className="smart-report-chat-header">
            <div className="smart-report-header-left">
              <h3>Trợ lý Phân tích Dữ liệu</h3>
              {error && <span className="error-badge">{error}</span>}
            </div>
            <button
              type="button"
              className="smart-report-clear-btn"
              onClick={handleClearHistory}
              title="Xóa lịch sử báo cáo"
              disabled={loading || loadingHistory || messages.length <= 1}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "15px", height: "15px", marginRight: "6px" }}>
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              <span>Xóa lịch sử</span>
            </button>
          </div>

          <div className="smart-report-chat-body">
            {loadingHistory ? (
              <div className="chat-message-row assistant">
                <div className="chat-message-bubble assistant loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`chat-message-row ${m.role}`}>
                  <div className={`chat-message-bubble ${m.role}`}>
                    <p className="message-content">{renderMessageContent(m.content)}</p>
                  </div>
                </div>
              ))
            )}
            
            {loading && !loadingHistory && (
              <div className="chat-message-row assistant">
                <div className="chat-message-bubble assistant loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          <form className="smart-report-chat-footer" onSubmit={handleSend}>
            <input
              type="text"
              value={inputValue}
              disabled={loading || loadingHistory}
              placeholder="Ví dụ: Doanh thu nhẫn cưới tháng này là bao nhiêu? Hoặc sản phẩm nào tồn kho thấp nhất?"
              onChange={(e) => setInputValue(e.target.value)}
            />
            <button type="submit" disabled={loading || loadingHistory || !inputValue.trim()}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <span>Gửi</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default SmartReportPage;
