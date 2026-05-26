import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AUTH_SESSION_CHANGED_EVENT,
  clearAuthSession,
  getAccessToken,
  getCurrentUser,
} from "../utils/auth";
import { buildApiUrl } from "../utils/api";
import { buildChatQuery, getChatIdentity, markChatLastSeen } from "../utils/chat";
import "./ChatWidget.css";

const API_BASE_URL = buildApiUrl("/api/chat");
const MAX_CHAT_IMAGE_SIZE = 2 * 1024 * 1024;

function isAuthSessionError(data, status) {
  const message = String(data?.message || "").toLowerCase();

  return (
    data?.code === "TOKEN_EXPIRED" ||
    data?.code === "INVALID_TOKEN" ||
    data?.code === "ACCOUNT_BLOCKED" ||
    status === 401 ||
    (status === 403 &&
      (message.includes("blocked") ||
        message.includes("disabled") ||
        message.includes("bị chặn") ||
        message.includes("bi chan")))
  );
}

const formatPendingTime = () =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hourCycle: "h23",
  }).format(new Date());

const mergeMessages = (currentMessages, incomingMessages) => {
  const pendingMessages = currentMessages.filter((item) =>
    String(item.id).startsWith("pending-")
  );

  if (!pendingMessages.length) {
    return incomingMessages;
  }

  return [
    ...incomingMessages,
    ...pendingMessages.filter(
      (pendingMessage) =>
        !incomingMessages.some(
          (item) =>
            item.message === pendingMessage.message &&
            item.imageUrl === pendingMessage.imageUrl &&
            item.senderType === pendingMessage.senderType &&
            item.senderName === pendingMessage.senderName
        )
    ),
  ];
};

function readChatImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
    reader.readAsDataURL(file);
  });
}

function ChatWidget({ isOpen, onClose, onMessagesSeen }) {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState(() => getChatIdentity());
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    messageId: null,
  });
  const listRef = useRef(null);
  const imageInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const isAuthenticated = Boolean(currentUser?.id);
  const canSendImage = Boolean(currentUser?.id);

  useEffect(() => {
    const syncCurrentUser = () => {
      setCurrentUser(getCurrentUser());
    };

    window.addEventListener("storage", syncCurrentUser);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncCurrentUser);

    return () => {
      window.removeEventListener("storage", syncCurrentUser);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncCurrentUser);
    };
  }, []);

  const resolveOwnMessage = useCallback((message) => {
    if (message.senderType === "admin") {
      return false;
    }

    if (currentUser?.id) {
      return message.senderUserId === Number(currentUser.id);
    }

    return message.senderType === "guest";
  }, [currentUser]);

  const syncSeenState = useCallback((messageItems) => {
    if (!isOpen || !Array.isArray(messageItems) || !messageItems.length) {
      return;
    }

    const latestIncomingMessage = [...messageItems]
      .reverse()
      .find((item) => !resolveOwnMessage(item));

    if (!latestIncomingMessage?.createdAt) {
      return;
    }

    markChatLastSeen(latestIncomingMessage.createdAt);
    onMessagesSeen?.(latestIncomingMessage.createdAt);
  }, [isOpen, onMessagesSeen, resolveOwnMessage]);

  const handleAuthSessionError = useCallback(
    (data) => {
      clearAuthSession();

      if (data?.code === "ACCOUNT_BLOCKED") {
        navigate("/login", {
          replace: true,
          state: {
            accountBlocked: true,
            message: data?.message,
          },
        });
      }
    },
    [navigate]
  );

  const handleLoginRequired = useCallback(() => {
    setError("Vui lòng đăng nhập để nhắn tin với tư vấn viên.");
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      return;
    }

    setIdentity(getChatIdentity());
  }, [isOpen, syncSeenState]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    if (!isAuthenticated) {
      setConversation(null);
      setMessages([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    let isMounted = true;

    const loadConversation = async () => {
      try {
        setLoading(true);
        setError("");

        const nextIdentity = getChatIdentity();
        if (isMounted) {
          setIdentity(nextIdentity);
        }

        const response = await fetch(`${API_BASE_URL}/me?${buildChatQuery(nextIdentity)}`);
        const data = await response.json();

        if (isAuthSessionError(data, response.status)) {
          handleAuthSessionError(data);
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể tải hộp chat.");
        }

        if (!isMounted) {
          return;
        }

        setConversation(data.conversation);
        setMessages(data.messages || []);
        syncSeenState(data.messages || []);
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || "Không thể tải hộp chat.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConversation();

    return () => {
      isMounted = false;
    };
  }, [handleAuthSessionError, isAuthenticated, isOpen, syncSeenState]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !conversation?.id) {
      return undefined;
    }

    const eventSource = new EventSource(
      `${API_BASE_URL}/me/stream?${buildChatQuery(identity)}`
    );

    eventSource.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload?.conversationId === conversation.id && Array.isArray(payload.messages)) {
        setMessages((current) => {
          const nextMessages = mergeMessages(current, payload.messages);
          syncSeenState(nextMessages);
          return nextMessages;
        });
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [conversation?.id, identity, isAuthenticated, isOpen, syncSeenState]);

  useEffect(() => {
    if (!isOpen || !listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isOpen, messages]);

  useEffect(() => {
    if (!contextMenu.visible) {
      return undefined;
    }

    const closeMenu = () => {
      setContextMenu((current) => ({ ...current, visible: false }));
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu.visible]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (sending) {
      return;
    }

    const nextMessage = draft.trim();
    const nextImage = selectedImage;
    const activeUser = getCurrentUser();

    if (!activeUser?.id) {
      handleLoginRequired();
      return;
    }

    if (!nextMessage && !nextImage) {
      return;
    }

    if (nextImage && !activeUser?.id) {
      setError("Vui lòng đăng nhập để gửi ảnh trong tin nhắn.");
      return;
    }

    const nextIdentity = getChatIdentity();
    const optimisticId = `pending-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      conversationId: conversation?.id || 0,
      senderType: currentUser?.id ? "user" : "guest",
      senderUserId: currentUser?.id ? Number(currentUser.id) : null,
      senderName:
        nextIdentity.guestName ||
        currentUser?.fullName ||
        currentUser?.username ||
        currentUser?.email ||
        "Khách hàng",
      message: nextMessage,
      imageUrl: nextImage?.url || null,
      createdAt: new Date().toISOString(),
      createdAtLabel: formatPendingTime(),
    };

    try {
      setSending(true);
      setError("");
      setMessages((current) => [...current, optimisticMessage]);
      setDraft("");
      setSelectedImage(null);

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      const headers = {
        "Content-Type": "application/json",
      };

      const accessToken = activeUser?.id ? getAccessToken() : "";

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/me/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          guestKey: nextIdentity.guestKey,
          guestName: nextIdentity.guestName,
          message: nextMessage,
          imageUrl: nextImage?.url || null,
        }),
      });
      const data = await response.json();

      if (isAuthSessionError(data, response.status)) {
        handleAuthSessionError(data);
        throw new Error(data.message || "Phiên đăng nhập đã hết hạn.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể gửi tin nhắn.");
      }

      if (data.conversationId && !conversation?.id) {
        setConversation((current) => ({
          ...(current || {}),
          id: data.conversationId,
          guestName: nextIdentity.guestName,
          status: "OPEN",
        }));
      }

      setMessages((current) =>
        current.map((item) => (item.id === optimisticId ? data.chatMessage : item))
      );
    } catch (submitError) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setDraft(nextMessage);
      setSelectedImage(nextImage);
      setError(submitError.message || "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (!getCurrentUser()?.id) {
        throw new Error("Vui lòng đăng nhập để gửi ảnh trong tin nhắn.");
      }

      if (!file.type.startsWith("image/")) {
        throw new Error("Vui lòng chọn đúng tệp ảnh.");
      }

      if (file.size > MAX_CHAT_IMAGE_SIZE) {
        throw new Error("Ảnh quá lớn, vui lòng chọn ảnh dưới 2MB.");
      }

      const dataUrl = await readChatImageAsDataUrl(file);
      setSelectedImage({
        name: file.name,
        url: dataUrl,
      });
      setError("");
    } catch (imageError) {
      setSelectedImage(null);
      setError(imageError.message || "Không thể chọn ảnh.");

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!String(messageId) || String(messageId).startsWith("pending-")) {
      return;
    }

    try {
      setError("");
      const nextIdentity = getChatIdentity();
      const headers = {};

      const activeUser = getCurrentUser();
      const accessToken = activeUser?.id ? getAccessToken() : "";

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/me/messages/${messageId}?${buildChatQuery(nextIdentity)}`,
        {
          method: "DELETE",
          headers,
        }
      );
      const data = await response.json();

      if (isAuthSessionError(data, response.status)) {
        handleAuthSessionError(data);
        throw new Error(data.message || "Phiên đăng nhập đã hết hạn.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể xóa tin nhắn.");
      }

      setMessages((current) => current.filter((item) => item.id !== messageId));
      setContextMenu((current) => ({ ...current, visible: false }));
    } catch (deleteError) {
      setError(deleteError.message || "Không thể xóa tin nhắn.");
    }
  };

  const handleMessageContextMenu = (event, message, isOwnMessage) => {
    if (!isOwnMessage || String(message.id).startsWith("pending-")) {
      return;
    }

    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      messageId: message.id,
    });
  };

  return (
    <aside className={`chat-widget${isOpen ? " open" : ""}`}>
      {contextMenu.visible ? (
        <button
          type="button"
          className="chat-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={() => handleDeleteMessage(contextMenu.messageId)}
        >
          Xóa tin nhắn
        </button>
      ) : null}

      <div className="chat-widget-header">
        <div>
          <strong>Liên hệ tư vấn</strong>
          <span>Phản hồi thời gian thực</span>
        </div>
        <button type="button" className="chat-widget-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="chat-widget-body" ref={listRef}>
        {!isAuthenticated ? (
          <div className="chat-login-prompt">
            <strong>Đăng nhập để nhắn tin</strong>
            <p>Vui lòng đăng nhập trước khi trò chuyện với tư vấn viên.</p>
            <button type="button" onClick={handleLoginRequired}>
              Đăng nhập
            </button>
          </div>
        ) : null}
        {isAuthenticated && loading ? <p className="chat-widget-state">Đang tải cuộc trò chuyện...</p> : null}
        {isAuthenticated && !loading && !messages.length ? (
          <p className="chat-widget-state">
            Chào bạn, hãy để lại tin nhắn. Bên mình sẽ phản hồi ngay khi có mặt.
          </p>
        ) : null}

        {isAuthenticated && messages.map((message) => {
          const isOwnMessage = resolveOwnMessage(message);

          return (
            <div
              key={message.id}
              className={`chat-bubble-row${isOwnMessage ? " own" : ""}`}
              onContextMenu={(event) => handleMessageContextMenu(event, message, isOwnMessage)}
            >
              <div className="chat-bubble-stack">
                <div className={`chat-bubble${isOwnMessage ? " own" : ""}`}>
                  {!isOwnMessage ? <strong>{message.senderName}</strong> : null}
                  {message.imageUrl ? (
                    <img
                      className="chat-bubble-image"
                      src={message.imageUrl}
                      alt="Ảnh trong tin nhắn"
                    />
                  ) : null}
                  {message.message ? <p>{message.message}</p> : null}
                  <span>{message.createdAtLabel}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form className="chat-widget-form" onSubmit={handleSubmit}>
        {error ? <p className="chat-widget-error">{error}</p> : null}
        {selectedImage ? (
          <div className="chat-image-preview">
            <img src={selectedImage.url} alt={selectedImage.name || "Ảnh đã chọn"} />
            <span>{selectedImage.name}</span>
            <button type="button" onClick={clearSelectedImage} aria-label="Bỏ ảnh">
              x
            </button>
          </div>
        ) : null}
        <div className="chat-widget-compose">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            className="chat-file-input"
            onChange={handleImageChange}
          />
          <button
            type="button"
            className="chat-attach-button"
            onClick={() =>
              canSendImage ? imageInputRef.current?.click() : handleLoginRequired()
            }
            disabled={!canSendImage}
            aria-label={canSendImage ? "Chọn ảnh" : "Đăng nhập để gửi ảnh"}
            title={canSendImage ? "Chọn ảnh" : "Đăng nhập để gửi ảnh"}
          >
            +
          </button>
          <textarea
            value={draft}
            rows={1}
            placeholder={isAuthenticated ? "Nhập tin nhắn..." : "Đăng nhập để nhắn tin..."}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isAuthenticated}
          />
          <button
            type="submit"
            className="chat-send-button"
            disabled={!isAuthenticated || sending || (!draft.trim() && !selectedImage)}
          >
            Gửi
          </button>
        </div>
      </form>
    </aside>
  );
}

export default ChatWidget;
