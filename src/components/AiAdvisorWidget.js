import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./AiAdvisorWidget.css";
import { buildApiUrl } from "../utils/api";

const AI_CHAT_API = buildApiUrl("/api/ai-chat");

const renderMessageContent = (text) => {
  if (!text) return "";
  
  // Split text by markdown links like [product name](/products/12)
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      const linkText = match[1];
      const url = match[2];
      
      // Check if it matches a product route like /products/:id or similar
      const productRouteMatch = url.match(/(?:\/products\/\d+|\/products\/[a-zA-Z0-9-]+)/);
      if (productRouteMatch) {
        const relativePath = productRouteMatch[0];
        return (
          <Link key={index} to={relativePath} className="ai-advisor-link">
            {linkText}
          </Link>
        );
      }
      
      // Internal page fallback
      const isInternal = url.startsWith("/") || url.startsWith(window.location.origin);
      if (isInternal) {
        const path = url.startsWith("/") ? url : url.substring(window.location.origin.length);
        return (
          <Link key={index} to={path} className="ai-advisor-link">
            {linkText}
          </Link>
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
    
    // Split text by newline and render line breaks nicely
    const subParts = part.split("\n");
    return subParts.map((subPart, subIndex) => (
      <span key={`${index}-${subIndex}`}>
        {subPart}
        {subIndex < subParts.length - 1 && <br />}
      </span>
    ));
  });
};

function AiAdvisorWidget({ isOpen, onClose }) {
  const [messages, setMessages] = useState(() => [
    {
      id: "greeting",
      role: "assistant",
      content:
        "Xin chào, mình là AI tư vấn JewelryBook. Bạn muốn chọn trang sức cho dịp nào?",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isOpen, messages]);

  const handleSend = async (event) => {
    event.preventDefault();

    const question = draft.trim();
    if (!question || sending) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };

    const history = messages
      .filter((item) => item.role === "user" || item.role === "assistant")
      .map((item) => ({
        role: item.role,
        content: item.content,
      }));

    try {
      setSending(true);
      setError("");
      setDraft("");
      setMessages((current) => [...current, userMessage]);

      const response = await fetch(`${AI_CHAT_API}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: question,
          history,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể nhận phản hồi AI.");
      }

      const aiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.data?.reply || "Mình chưa thể trả lời lúc này, bạn thử lại giúp mình nhé.",
      };

      setMessages((current) => [...current, aiMessage]);
    } catch (sendError) {
      setDraft(question);
      setError(sendError.message || "Không thể gửi câu hỏi.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <aside className={`ai-chat-widget${isOpen ? " open" : ""}`}>
      <div className="ai-chat-header">
        <div className="ai-chat-header-info">
          <div className="ai-chat-avatar">✨</div>
          <div>
            <strong>Trợ lý AI tư vấn</strong>
            <span>Gợi ý trang sức theo nhu cầu của bạn</span>
          </div>
        </div>
        <button type="button" className="ai-chat-close" onClick={onClose} aria-label="Đóng">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="ai-chat-body" ref={listRef}>
        {messages.map((message) => (
          <div key={message.id} className={`ai-chat-row ${message.role}`}>
            <div className={`ai-chat-bubble ${message.role}`}>
              <p>{renderMessageContent(message.content)}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="ai-chat-row assistant">
            <div className="ai-chat-bubble assistant typing">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
      </div>

      <form className="ai-chat-form" onSubmit={handleSend}>
        {error ? <p className="ai-chat-error">{error}</p> : null}
        <div className="ai-chat-input-wrapper">
          <textarea
            value={draft}
            rows={1}
            placeholder="Nhập câu hỏi về sản phẩm, size nhẫn, chất liệu..."
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="ai-chat-submit-btn" disabled={sending || !draft.trim()} aria-label="Gửi">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
}

export default AiAdvisorWidget;
