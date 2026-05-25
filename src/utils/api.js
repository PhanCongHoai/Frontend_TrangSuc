const LOCAL_API_BASE_URL = "http://localhost:5000";
const PRODUCTION_TUNNEL_API_BASE_URL =
  "https://latinas-carried-journal-elevation.trycloudflare.com";
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

function getApiOrigin() {
  if (!API_BASE_URL) {
    if (typeof window === "undefined") {
      return "";
    }

    return window.location.origin;
  }

  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
}

export function buildApiUrl(path = "") {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}

export function buildAssetUrl(value = "") {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (/^data:/i.test(normalizedValue)) {
    return normalizedValue;
  }

  const apiOrigin = getApiOrigin();

  if (normalizedValue.startsWith("/")) {
    return apiOrigin ? `${apiOrigin}${normalizedValue}` : normalizedValue;
  }

  if (!/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  try {
    const parsedUrl = new URL(normalizedValue);

    if (parsedUrl.pathname.startsWith("/uploads/")) {
      return apiOrigin
        ? `${apiOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
        : normalizedValue;
    }

    return normalizedValue;
  } catch {
    return normalizedValue;
  }
}
