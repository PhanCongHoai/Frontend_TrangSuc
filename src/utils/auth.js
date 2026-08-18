export const ACCESS_TOKEN_KEY = "accessToken";
export const CURRENT_USER_KEY = "currentUser";
export const CART_STORAGE_KEY = "shoppingCart";
export const AUTH_SESSION_CHANGED_EVENT = "auth-session-changed";
export const BLOCKED_ACCOUNT_MESSAGE =
  "Tài khoản của bạn đã bị chặn. Vui lòng liên hệ quản trị viên để được hỗ trợ.";
export const SESSION_EXPIRED_MESSAGE =
  "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.";

export function notifyAuthSessionChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];

    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );

    return JSON.parse(window.atob(paddedPayload));
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token) {
  const payload = decodeJwtPayload(token);

  if (!payload?.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

export function getAccessToken() {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);

  if (token && isAccessTokenExpired(token)) {
    clearAuthSession();
    return null;
  }

  return token;
}

export function getCurrentUser() {
  const rawUser = sessionStorage.getItem(CURRENT_USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    console.error("Parse current user error:", error);
    return null;
  }
}

export function isAdminUser(user) {
  const roleName = String(user?.roleName || user?.role || "").toLowerCase();
  return roleName === "admin";
}

export function isStaffUser(user) {
  const roleName = String(user?.roleName || user?.role || "").toLowerCase();
  return roleName === "staff";
}

export function clearAuthSession() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(CART_STORAGE_KEY);
  notifyAuthSessionChanged();
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = getAccessToken();

  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
