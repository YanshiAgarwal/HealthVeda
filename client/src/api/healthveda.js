// Every call from the website to the HealthVeda server lives in this ONE file.
// Login cookies are httpOnly (JavaScript can't read them - safer); the
// browser just sends them automatically with `credentials: "include"`.

const BASE_URL = import.meta.env.VITE_API_URL || ""; // "" = same server (dev proxy)

let refreshPromise = null;
let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => { onSessionExpired = fn; };

const NO_RETRY = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"];

async function request(path, options = {}, retry = true) {
  let response;
  try {
    response = await fetch(BASE_URL + path, { credentials: "include", ...options });
  } catch {
    throw new Error("Cannot reach the HealthVeda server. Please check your connection.");
  }

  // Access token expired -> get a new one with the refresh cookie, then retry once
  if (response.status === 401 && retry && !NO_RETRY.includes(path)) {
    refreshPromise ??= fetch(`${BASE_URL}/api/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
    if (await refreshPromise) return request(path, options, false);
    onSessionExpired();
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

const send = (method, path, body) =>
  request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

// ── Auth ──
export const auth = {
  me: () => request("/api/auth/me"),
  register: (name, email, password) => send("POST", "/api/auth/register", { name, email, password }),
  login: (email, password) => send("POST", "/api/auth/login", { email, password }),
  logout: () => send("POST", "/api/auth/logout"),
  logoutAll: () => send("POST", "/api/auth/logout-all"),
};

// ── My account ──
export const account = {
  update: (fields) => send("PATCH", "/api/users/me", fields),
  changePassword: (currentPassword, newPassword) => send("POST", "/api/users/me/password", { currentPassword, newPassword }),
  sessions: () => request("/api/users/me/sessions"),
  activity: () => request("/api/users/me/activity"),
  exportData: () => request("/api/users/me/export"),
  remove: (password) => send("DELETE", "/api/users/me", { password, confirm: "DELETE" }),
};

// ── Reports & history ──
export const reports = {
  list: () => request("/api/reports"),
  get: (id, includeText = false) => request(`/api/reports/${id}${includeText ? "?includeText=true" : ""}`),
  trends: () => request("/api/reports/trends"),
  upload(file, { reportDate, title } = {}) {
    const form = new FormData();
    form.append("file", file);
    if (reportDate) form.append("reportDate", reportDate);
    if (title) form.append("title", title);
    return request("/api/reports", { method: "POST", body: form });
  },
  // details = { reportDate, filename, fileHash, extraction } (all optional)
  fromText: (text, details = {}) => send("POST", "/api/reports/text", { text, ...details }),
  sample: () => request("/api/reports/sample"),
  demoHistory: () => send("POST", "/api/reports/demo-history"),
  update: (id, fields) => send("PATCH", `/api/reports/${id}`, fields),
  remove: (id) => request(`/api/reports/${id}`, { method: "DELETE" }),
};

// ── Veda Assistant & Ayurveda library ──
export const sendChatMessage = (message, history, language, useReport) =>
  send("POST", "/api/chat", { message, history, language, useReport });
export const getStatus = () => request("/api/status");
export const searchConditions = (search = "") =>
  request(`/api/conditions?search=${encodeURIComponent(search)}&limit=60`);
export const getCondition = (name) => request(`/api/conditions/${encodeURIComponent(name)}`);
