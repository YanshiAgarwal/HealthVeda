/**
 * Rate limits - stop brute-force attacks and runaway AI costs.
 * Counters are kept in memory locally, or in MongoDB (RATE_LIMIT_STORE=mongo)
 * when running on serverless hosts like Vercel.
 */
import { rateLimit } from "express-rate-limit";

import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { MongoRateLimitStore } from "./mongoRateStore.js";

function limiter(name, options) {
  return rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => config.isTest && !process.env.TEST_RATE_LIMITS,
    message: { error: "Too many requests, please slow down and try again later.", code: "RATE_LIMITED" },
    // If the counter database is briefly unreachable, don't take the whole site down
    passOnStoreError: true,
    store: config.RATE_LIMIT_STORE === "mongo" ? new MongoRateLimitStore(`${name}:`) : undefined,
    handler: (req, res, _next, opts) => {
      logger.warn({ limiter: name, ip: req.ip, requestId: req.id }, "Rate limit hit");
      res.status(opts.statusCode).json(opts.message);
    },
    ...options,
  });
}

// Every API call: 300 per 15 minutes per IP
export const apiLimiter = limiter("api", { windowMs: 15 * 60_000, limit: 300 });

// Login / register: 10 failed attempts per 15 minutes per IP
export const authLimiter = limiter("auth", {
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts. Please wait 15 minutes and try again.", code: "RATE_LIMITED" },
});

// Per logged-in user: AI is expensive
const byUser = (req) => req.user?.id ?? req.ip;
export const uploadLimiter = limiter("upload", { windowMs: 60 * 60_000, limit: 30, keyGenerator: byUser });
export const chatLimiter = limiter("chat", { windowMs: 60_000, limit: 20, keyGenerator: byUser });
