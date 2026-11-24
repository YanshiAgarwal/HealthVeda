/** Extra security layers that run on every request. */
import crypto from "node:crypto";

import { config } from "../config/env.js";
import { forbidden } from "../utils/AppError.js";

/** Give each request an id (shown in logs + error messages for support). */
export function requestId(req, res, next) {
  const incoming = req.get("x-request-id");
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.set("X-Request-Id", req.id);
  next();
}

/**
 * CSRF protection (second layer after SameSite=Strict cookies):
 * any request that CHANGES data must come from one of our own websites.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function verifyOrigin(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next(); // non-browser clients (curl, tests) - they have no cookies of ours
  const self = `${req.protocol}://${req.get("host")}`;
  if (origin === self || config.clientOrigins.includes(origin)) return next();
  throw forbidden("Request blocked: unknown origin");
}

/** API responses contain private data - never cache them. */
export function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  next();
}
