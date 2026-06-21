import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthHeaders, getAccessToken } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

const API_BASE_URL = buildApiUrl("/api/chat/admin");
const MAX_CHAT_IMAGE_SIZE = 2 * 1024 * 1024;

const formatPendingTime = () =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hourCycle: "h23",
  }).format(new Date());

const getAvatarLabel = (name) => {
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    return "K";
  }

  const parts = normalizedName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

const getAvatarStyle = (name) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    return {
      background: "linear-gradient(135deg, rgba(244, 200, 75, 0.28), rgba(244, 200, 75, 0.12))",
      border: "1px solid rgba(244, 200, 75, 0.18)",
      color: "#f4c84b"
    };
  }

  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    hash = normalizedName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 60%, 22%), hsl(${hue}, 40%, 11%))`,
    border: `1px solid rgba(244, 200, 75, 0.15)`,
    borderColor: `hsl(${hue}, 50%, 28%)`,
    color: `hsl(${hue}, 95%, 72%)`
  };
};

function readChatImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
    reader.readAsDataURL(file);
  });
}

function ChatsPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [messageMenu, setMessageMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    messageId: null,
  });
  const [conversationMenu, setConversationMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    conversationId: null,
  });
  const imageInputRef = useRef(null);

  const selectedConversationIdRef = useRef(selectedConversationId);
  const triggerMessageReloadRef = useRef(null);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    let isMounted = true;
    let eventSource = null;

    const loadConversations = async (keepSelection = true) => {
      try {
        const response = await fetch(`${API_BASE_URL}/conversations`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể tải danh sách hội thoại.");
        }

        if (!isMounted) {
          return;
        }

        setConversations(data.conversations || []);
        setSelectedConversationId((currentId) => {
          if (
            keepSelection &&
            currentId &&
            (data.conversations || []).some((item) => item.id === currentId)
          ) {
            return currentId;
          }

          return data.conversations?.[0]?.id || null;
        });
        setError("");
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || "Không thể tải danh sách hội thoại.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConversations(false);

    const token = getAccessToken();
    if (token) {
      const streamUrl = `${API_BASE_URL}/conversations/stream?access_token=${encodeURIComponent(token)}`;
      
      const connectStream = () => {
        if (!isMounted) return;
        
        eventSource = new EventSource(streamUrl);
        
        eventSource.addEventListener("conversation", (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload && payload.conversation) {
              const updatedConv = payload.conversation;
              
              setConversations((current) => {
                const index = current.findIndex((c) => c.id === updatedConv.id);
                if (index !== -1) {
                  const copy = [...current];
                  copy[index] = {
                    ...copy[index],
                    ...updatedConv,
                    unreadCount: payload.readConversationId === updatedConv.id ? 0 : updatedConv.unreadCount
                  };
                  return copy;
                } else {
                  return [updatedConv, ...current];
                }
              });
              
              if (updatedConv.id === selectedConversationIdRef.current) {
                triggerMessageReloadRef.current?.();
              }
            }
          } catch (err) {
            console.error("Lỗi xử lý SSE:", err);
          }
        });
        
        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
          }
          if (isMounted) {
            setTimeout(connectStream, 5000);
          }
        };
      };
      
      connectStream();
    } else {
      const intervalId = setInterval(() => loadConversations(true), 2500);
      return () => {
        isMounted = false;
        clearInterval(intervalId);
      };
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return undefined;
    }

    let isMounted = true;

    const loadMessages = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/conversations/${selectedConversationId}/messages`,
          { headers: getAuthHeaders() }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể tải tin nhắn.");
        }

        if (isMounted) {
          setMessages((current) => {
            const pendingMessages = current.filter((item) =>
              String(item.id).startsWith("pending-")
            );

            if (!pendingMessages.length) {
              return data.messages || [];
            }

            return [
              ...(data.messages || []),
              ...pendingMessages.filter(
                (pendingMessage) =>
                  !(data.messages || []).some(
                    (item) =>
                      item.message === pendingMessage.message &&
                      item.imageUrl === pendingMessage.imageUrl &&
                      item.senderType === pendingMessage.senderType
                  )
              ),
            ];
          });
          if (data.conversation) {
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === data.conversation.id ? data.conversation : conversation
              )
            );
          }
          setError("");
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || "Không thể tải tin nhắn.");
        }
      }
    };

    triggerMessageReloadRef.current = loadMessages;
    loadMessages();
    const intervalId = setInterval(loadMessages, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      triggerMessageReloadRef.current = null;
    };
  }, [selectedConversationId]);

  useEffect(() => {
    setSelectedImage(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (!messageMenu.visible && !conversationMenu.visible) {
      return undefined;
    }

    const closeMenus = () => {
      setMessageMenu((current) => ({ ...current, visible: false }));
      setConversationMenu((current) => ({ ...current, visible: false }));
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };

    window.addEventListener("click", closeMenus);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeMenus);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [conversationMenu.visible, messageMenu.visible]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const mergedConversations = useMemo(() => {
    const conversationMap = new Map();

    conversations.forEach((conversation) => {
      const guestKey = String(conversation.guestName || "").trim().toLowerCase() || `conversation-${conversation.id}`;
      const existingConversation = conversationMap.get(guestKey);

      if (!existingConversation) {
        conversationMap.set(guestKey, conversation);
        return;
      }

      const existingTime = new Date(existingConversation.lastMessageAt || 0).getTime();
      const nextTime = new Date(conversation.lastMessageAt || 0).getTime();

      const mergedUnreadCount =
        Number(existingConversation.unreadCount || 0) + Number(conversation.unreadCount || 0);

      if (nextTime >= existingTime) {
        conversationMap.set(guestKey, {
          ...conversation,
          unreadCount: mergedUnreadCount,
        });
      } else {
        conversationMap.set(guestKey, {
          ...existingConversation,
          unreadCount: mergedUnreadCount,
        });
      }
    });

    return Array.from(conversationMap.values());
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return mergedConversations;
    }

    return mergedConversations.filter((conversation) => {
      const guestName = String(conversation.guestName || "").toLowerCase();
      const lastMessage = String(conversation.lastMessage || "").toLowerCase();

      return guestName.includes(normalizedKeyword) || lastMessage.includes(normalizedKeyword);
    });
  }, [mergedConversations, searchKeyword]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedConversationId || sending) {
      return;
    }

    const nextMessage = draft.trim();
    const nextImage = selectedImage;

    if (!nextMessage && !nextImage) {
      return;
    }

    const optimisticId = `pending-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      senderType: "admin",
      senderName: "Bạn",
      message: nextMessage,
      imageUrl: nextImage?.url || null,
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

      const response = await fetch(
        `${API_BASE_URL}/conversations/${selectedConversationId}/messages`,
        {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            message: nextMessage,
            imageUrl: nextImage?.url || null,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể gửi phản hồi.");
      }

      setMessages((current) =>
        current.map((item) => (item.id === optimisticId ? data.chatMessage : item))
      );
    } catch (submitError) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setDraft(nextMessage);
      setSelectedImage(nextImage);
      setError(submitError.message || "Không thể gửi phản hồi.");
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
    if (!selectedConversationId || !messageId || String(messageId).startsWith("pending-")) {
      return;
    }

    try {
      setError("");
      const response = await fetch(
        `${API_BASE_URL}/conversations/${selectedConversationId}/messages/${messageId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể xóa tin nhắn.");
      }

      setMessages((current) => current.filter((item) => item.id !== messageId));
      setMessageMenu((current) => ({ ...current, visible: false }));
    } catch (deleteError) {
      setError(deleteError.message || "Không thể xóa tin nhắn.");
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationMenu.conversationId) {
      return;
    }

    try {
      setError("");
      const selectedName = String(
        conversations.find((conversation) => conversation.id === conversationMenu.conversationId)
          ?.guestName || ""
      )
        .trim()
        .toLowerCase();
      const conversationIdsToDelete = conversations
        .filter((conversation) =>
          String(conversation.guestName || "").trim().toLowerCase() === selectedName
        )
        .map((conversation) => conversation.id);
      const remainingConversations = conversations.filter(
        (conversation) => !conversationIdsToDelete.includes(conversation.id)
      );

      for (const conversationId of conversationIdsToDelete) {
        const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể xóa cuộc hội thoại.");
        }
      }

      setConversations((current) =>
        current.filter((conversation) => !conversationIdsToDelete.includes(conversation.id))
      );
      setSelectedConversationId(remainingConversations[0]?.id || null);
      setMessages([]);
      setConversationMenu((current) => ({ ...current, visible: false }));
    } catch (deleteError) {
      setError(deleteError.message || "Không thể xóa cuộc hội thoại.");
    }
  };

  const openMessageMenu = (event, messageId) => {
    if (!messageId || String(messageId).startsWith("pending-")) {
      return;
    }

    event.preventDefault();
    setConversationMenu((current) => ({ ...current, visible: false }));
    setMessageMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      messageId,
    });
  };

  const openConversationMenu = (event, conversationId) => {
    if (!conversationId) {
      return;
    }

    event.preventDefault();
    setMessageMenu((current) => ({ ...current, visible: false }));
    setConversationMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      conversationId,
    });
  };

  return (
    <section className="panel-page chats-page">
      {messageMenu.visible ? (
        <button
          type="button"
          className="chat-admin-context-menu"
          style={{ top: messageMenu.y, left: messageMenu.x }}
          onClick={() => handleDeleteMessage(messageMenu.messageId)}
        >
          Xóa tin nhắn
        </button>
      ) : null}

      {conversationMenu.visible ? (
        <button
          type="button"
          className="chat-admin-context-menu"
          style={{ top: conversationMenu.y, left: conversationMenu.x }}
          onClick={handleDeleteConversation}
        >
          Xóa hội thoại
        </button>
      ) : null}

      <div className="chat-admin-layout">
        <aside className="chat-admin-list">
          <div className="chat-admin-search">
            <svg 
              className="chat-admin-search-icon" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              value={searchKeyword}
              placeholder="Tìm kiếm người nhắn..."
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
          </div>

          {loading ? <p className="chat-admin-empty">Đang tải hội thoại...</p> : null}
          {!loading && !filteredConversations.length ? (
            <p className="chat-admin-empty">Chưa có khách nào nhắn tin.</p>
          ) : null}

          <div className="chat-admin-conversation-list">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`chat-admin-conversation${
                  selectedConversationId === conversation.id ? " active" : ""
                }`}
                onClick={() => setSelectedConversationId(conversation.id)}
                onContextMenu={(event) => openConversationMenu(event, conversation.id)}
              >
                <div 
                  className="chat-admin-conversation-avatar" 
                  aria-hidden="true"
                  style={getAvatarStyle(conversation.guestName)}
                >
                  {getAvatarLabel(conversation.guestName)}
                </div>
                <div className="chat-admin-conversation-content">
                  <strong>{conversation.guestName}</strong>
                  <p>{conversation.lastMessage || "Chưa có tin nhắn"}</p>
                  <span>{conversation.lastMessageAtLabel || "Vừa xong"}</span>
                </div>
                {Number(conversation.unreadCount || 0) > 0 ? (
                  <span className="chat-admin-unread-badge" aria-label={`${conversation.unreadCount} tin nhắn chưa đọc`}>
                    {Number(conversation.unreadCount || 0) > 99 ? "99+" : conversation.unreadCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="chat-admin-panel">
          {selectedConversation ? (
            <>
              <header className="chat-admin-panel-head">
                <div className="chat-admin-panel-identity">
                  <div 
                    className="chat-admin-conversation-avatar large" 
                    aria-hidden="true"
                    style={getAvatarStyle(selectedConversation.guestName)}
                  >
                    {getAvatarLabel(selectedConversation.guestName)}
                  </div>
                  <div className="chat-admin-panel-title">
                    <strong>{selectedConversation.guestName}</strong>
                  </div>
                </div>
              </header>

              <div className="chat-admin-messages">
                {!messages.length ? (
                  <p className="chat-admin-empty">Chưa có tin nhắn nào trong hội thoại này.</p>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-admin-message-row${
                      message.senderType === "admin" ? " own" : ""
                    }`}
                    onContextMenu={(event) => openMessageMenu(event, message.id)}
                  >
                    <div className="chat-admin-message-stack">
                      <div
                        className={`chat-admin-message${
                          message.senderType === "admin" ? " own" : ""
                        }`}
                      >
                        {message.imageUrl ? (
                          <img
                            className="chat-admin-message-image"
                            src={message.imageUrl}
                            alt="Ảnh trong tin nhắn"
                          />
                        ) : null}
                        {message.message ? <p>{message.message}</p> : null}
                      </div>
                      <span className="chat-admin-message-time">{message.createdAtLabel}</span>
                    </div>
                  </div>
                ))}
              </div>

              <form className="chat-admin-form" onSubmit={handleSubmit}>
                {selectedImage ? (
                  <div className="chat-admin-image-preview">
                    <img src={selectedImage.url} alt={selectedImage.name || "Ảnh đã chọn"} />
                    <span>{selectedImage.name}</span>
                    <button type="button" onClick={clearSelectedImage} aria-label="Bỏ ảnh">
                      x
                    </button>
                  </div>
                ) : null}
                <div className="chat-admin-compose">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    className="chat-admin-file-input"
                    onChange={handleImageChange}
                  />
                  <button
                    type="button"
                    className="chat-admin-attach-button"
                    onClick={() => imageInputRef.current?.click()}
                    aria-label="Chọn ảnh"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </button>
                  <textarea
                    value={draft}
                    rows={1}
                    placeholder="Nhập phản hồi cho khách..."
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="submit"
                    className="chat-admin-send-button"
                    disabled={sending || (!draft.trim() && !selectedImage)}
                    aria-label="Gửi tin nhắn"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="chat-admin-placeholder">
              <div className="chat-admin-placeholder-hero">
                <div className="chat-admin-placeholder-icon-wrap">
                  <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <h3>Trung tâm Tư vấn Khách hàng</h3>
                <p>{error ? error : "Chọn một cuộc hội thoại từ danh sách bên trái để bắt đầu trò chuyện với khách hàng."}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ChatsPage;
