const DEFAULT_BASE = "http://localhost:8000";

export function apiBase() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

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
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" })
};
