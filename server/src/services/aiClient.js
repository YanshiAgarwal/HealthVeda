/**
 * aiClient.js - the ONLY place that talks to the Python AI service.
 * Every call sends the secret X-Service-Key and has a timeout.
 */
import { config } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

async function call(path, { method = "GET", json, form, timeoutMs = 60_000 } = {}) {
  const headers = { "X-Service-Key": config.AI_SERVICE_KEY };
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  let response;
  try {
    // Join without dropping any path prefix in the base URL (Vercel service bindings)
    response = await fetch(`${config.AI_SERVICE_URL.replace(/\/+$/, "")}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    logger.error({ err: error, path }, "AI service unreachable");
    throw new AppError(503, "The AI service is not available right now. Please try again shortly.", "AI_UNAVAILABLE");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 4xx from the AI service = a problem with the user's input -> pass the message on
    if (response.status >= 400 && response.status < 500 && response.status !== 401) {
      const detail = typeof data.detail === "string" ? data.detail : "The file or text could not be processed.";
      throw new AppError(response.status === 413 ? 413 : 400, detail, "AI_REJECTED");
    }
    logger.error({ status: response.status, path }, "AI service error");
    throw new AppError(502, "The AI service had a problem. Please try again.", "AI_ERROR");
  }
  return data;
}

export const ai = {
  status: () => call("/api/status", { timeoutMs: 5_000 }),

  analyzeFile(buffer, filename, mimeType) {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), filename);
    return call("/api/reports/analyze", { method: "POST", form, timeoutMs: 180_000 }); // OCR can be slow
  },

  analyzeText: (text) => call("/api/reports/analyze-text", { method: "POST", json: { text }, timeoutMs: 90_000 }),
  sample: () => call("/api/reports/sample", { timeoutMs: 90_000 }),

  chat: (payload) => call("/api/chat", { method: "POST", json: payload, timeoutMs: 120_000 }),

  conditions: (search, limit) =>
    call(`/api/conditions?${new URLSearchParams({ search, limit: String(limit) })}`, { timeoutMs: 10_000 }),
  condition: (name) => call(`/api/conditions/${encodeURIComponent(name)}`, { timeoutMs: 10_000 }),
};
