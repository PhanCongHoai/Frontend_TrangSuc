const DEFAULT_API_BASE_URL = "http://localhost:5000";
const rawApiBaseUrl = process.env.REACT_APP_API_BASE_URL;

export const API_BASE_URL =
  rawApiBaseUrl === undefined
    ? DEFAULT_API_BASE_URL
    : String(rawApiBaseUrl || "").trim() === "/"
      ? ""
      : String(rawApiBaseUrl || "")
          .trim()
          .replace(/\/+$/, "");

export const API_CONNECTION_LABEL = API_BASE_URL || "same-origin";

export function buildApiUrl(path = "") {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}
