const LOCAL_API_BASE_URL = "http://localhost:5000";
const PRODUCTION_TUNNEL_API_BASE_URL =
  "https://fiber-pocket-chapel-setup.trycloudflare.com";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const rawApiBaseUrl = process.env.REACT_APP_API_BASE_URL;

function normalizeApiBaseUrl(value) {
  return String(value || "").trim() === "/"
    ? ""
    : String(value || "")
        .trim()
        .replace(/\/+$/, "");
}

function isLocalApiBaseUrl(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(value);
}

function isRunningOnLocalhost() {
  if (typeof window === "undefined") {
    return false;
  }

  return LOCAL_HOSTNAMES.has(window.location.hostname);
}

const normalizedApiBaseUrl = normalizeApiBaseUrl(rawApiBaseUrl);
const shouldUseLocalApiBaseUrl = isRunningOnLocalhost();

export const API_BASE_URL =
  normalizedApiBaseUrl &&
  (!isLocalApiBaseUrl(normalizedApiBaseUrl) || shouldUseLocalApiBaseUrl)
    ? normalizedApiBaseUrl
    : shouldUseLocalApiBaseUrl
      ? LOCAL_API_BASE_URL
      : PRODUCTION_TUNNEL_API_BASE_URL;

export const API_CONNECTION_LABEL = API_BASE_URL || "same-origin";

export function buildApiUrl(path = "") {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}
