import { useEffect, useRef, useState } from "react";
import "./AiAdvisorWidget.css";
import { buildApiUrl } from "../utils/api";

const AI_CHAT_API = buildApiUrl("/api/ai-chat");

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
        <div>
          <strong>Tư vấn AI</strong>
          <span>Gợi ý trang sức theo nhu cầu của bạn</span>
        </div>
        <button type="button" className="ai-chat-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="ai-chat-body" ref={listRef}>
        {messages.map((message) => (
          <div key={message.id} className={`ai-chat-row ${message.role}`}>
            <div className={`ai-chat-bubble ${message.role}`}>
              <p>{message.content}</p>
            </div>
          </div>
        ))}
      </div>

      <form className="ai-chat-form" onSubmit={handleSend}>
        {error ? <p className="ai-chat-error">{error}</p> : null}
        <textarea
          value={draft}
          rows={1}
          placeholder="Nhập câu hỏi về sản phẩm, chất liệu, cách phối..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          {sending ? "Đang trả lời..." : "Gửi"}
        </button>
      </form>
    </aside>
  );
}

export default AiAdvisorWidget;
