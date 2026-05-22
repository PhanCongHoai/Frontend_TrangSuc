import { getAccessToken, getCurrentUser } from "./auth";

export const CHAT_GUEST_KEY = "chatGuestKey";
export const CHAT_GUEST_NAME = "chatGuestName";
export const CHAT_LAST_SEEN_PREFIX = "chatLastSeen";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function ensureGuestIdentity() {
  let guestKey = localStorage.getItem(CHAT_GUEST_KEY);

  if (!guestKey) {
    guestKey = `guest-${Date.now()}-${randomId()}`;
    localStorage.setItem(CHAT_GUEST_KEY, guestKey);
  }

  let guestName = localStorage.getItem(CHAT_GUEST_NAME);

  if (!guestName) {
    guestName = `Khách ${guestKey.slice(-4).toUpperCase()}`;
    localStorage.setItem(CHAT_GUEST_NAME, guestName);
  }

  return { guestKey, guestName };
}

export function getChatIdentity() {
  const currentUser = getCurrentUser();

  if (currentUser?.id) {
    return {
      mode: "user",
      token: getAccessToken(),
      guestKey: "",
      guestName:
        currentUser.fullName ||
        currentUser.username ||
        currentUser.email ||
        "Khách hàng",
    };
  }

  const guest = ensureGuestIdentity();

  return {
    mode: "guest",
    token: "",
    guestKey: guest.guestKey,
    guestName: guest.guestName,
  };
}

export function getChatIdentityKey() {
  const currentUser = getCurrentUser();

  if (currentUser?.id) {
    return `user:${currentUser.id}`;
  }

  const guest = ensureGuestIdentity();
  return `guest:${guest.guestKey}`;
}

export function getChatLastSeenAt() {
  const identityKey = getChatIdentityKey();
  return localStorage.getItem(`${CHAT_LAST_SEEN_PREFIX}:${identityKey}`) || "";
}

export function markChatLastSeen(timestamp = new Date().toISOString()) {
  const identityKey = getChatIdentityKey();
  localStorage.setItem(`${CHAT_LAST_SEEN_PREFIX}:${identityKey}`, String(timestamp || ""));
}

export function buildChatQuery(identity) {
  const params = new URLSearchParams();

  if (identity.token) {
    params.set("token", identity.token);
  }

  if (identity.guestKey) {
    params.set("guestKey", identity.guestKey);
  }

  if (identity.guestName) {
    params.set("guestName", identity.guestName);
  }

  return params.toString();
}
