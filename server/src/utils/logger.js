/**
 * logger.js - structured JSON logs (pino).
 * Secrets and health data are REDACTED so they never end up in log files.
 */
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers['x-service-key']",
      "res.headers['set-cookie']",
      "*.password",
      "*.currentPassword",
      "*.newPassword",
      "*.text",
    ],
    censor: "[redacted]",
  },
});
