const DEFAULT_BASE = "http://localhost:8000";
const AUTH_SESSION_KEY = "gnucash.auth.session.v1";
export const authSessionChangedEvent = "gnucash-auth-session-changed";

let refreshInFlight = null;

export function apiBase() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE;
}

function normalizeAuthSession(payload) {
  if (!payload || typeof payload !== "object") return null;
  const accessToken = String(payload.access_token || payload.accessToken || "").trim();
  const refreshToken = String(payload.refresh_token || payload.refreshToken || "").trim();
  const tokenType = String(payload.token_type || payload.tokenType || "bearer").trim() || "bearer";
  if (!accessToken || !refreshToken) return null;
  return {
    accessToken,
    refreshToken,
    tokenType
  };
}

export function getAuthSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    return normalizeAuthSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setAuthSession(payload) {
  const normalized = normalizeAuthSession(payload);
  if (!normalized || typeof window === "undefined") return null;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(authSessionChangedEvent));
  return normalized;
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  window.dispatchEvent(new Event(authSessionChangedEvent));
}

function shouldSkipRefresh(path) {
  return path === "/auth/login" || path === "/auth/register" || path === "/auth/refresh";
}

async function executeRequest(path, options = {}, accessToken = "") {
  const headers = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    ...options
  };
  return fetch(`${apiBase()}${path}`, headers);
}

async function refreshTokens() {
  const current = getAuthSession();
  if (!current?.refreshToken) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const response = await executeRequest(
      "/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: current.refreshToken })
      },
      ""
    );
    if (!response.ok) {
      clearAuthSession();
      return null;
    }
    const data = await response.json().catch(() => null);
    const normalized = setAuthSession(data);
    if (!normalized) {
      clearAuthSession();
      return null;
    }
    return normalized;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request(path, options = {}, retried = false) {
  const currentSession = getAuthSession();
  const accessToken = currentSession?.accessToken || "";
  const response = await executeRequest(path, options, accessToken);

  if (response.status === 401 && !retried && !shouldSkipRefresh(path) && currentSession?.refreshToken) {
    const refreshed = await refreshTokens();
    if (refreshed?.accessToken) {
      return request(path, options, true);
    }
  }

  if (response.status === 204) {
    return { ok: true, data: null };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = data || { code: "HTTP_ERROR", message: "request failed", details: {} };
    return { ok: false, error };
  }

  return { ok: true, data };
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" })
};
