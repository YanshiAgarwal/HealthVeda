/**
 * app.js - builds the Express app (START READING HERE).
 *
 * Request journey:
 *   request id -> security headers -> CORS -> rate limit -> cookies/JSON
 *   -> CSRF origin check -> no-cache -> ROUTE -> error handler
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { config } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimits.js";
import { noStore, requestId, verifyOrigin } from "./middleware/security.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { logger } from "./utils/logger.js";

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");

/**
 * @param {object} [options]
 * @param {() => Promise<void>} [options.beforeRoutes] runs before every /api request
 *        (serverless.js uses it to connect to MongoDB lazily)
 */
export function createApp({ beforeRoutes } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY); // real client IPs behind nginx / cloud proxies
  app.set("query parser", "simple");          // no nested objects in ?query=strings

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: !config.isTest }));

  // Serverless: make sure MongoDB is connected BEFORE anything uses it
  // (the rate limiter stores its counters there).
  if (beforeRoutes) {
    app.use("/api", async (req, _res, next) => {
      if (req.path === "/health") return next();
      await beforeRoutes();
      next();
    });
  }

  // Security headers, incl. a strict Content-Security-Policy for the website
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // 'wasm-unsafe-eval' lets the in-browser OCR (WebAssembly) run - it does NOT allow eval()
          scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
          workerSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // animations use inline styles
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },
      strictTransportSecurity: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(helmet.permittedCrossDomainPolicies());
  app.use((_req, res, next) => {
    // The website uses the microphone for voice input; nothing else
    res.set("Permissions-Policy", "camera=(), geolocation=(), payment=(), microphone=(self)");
    next();
  });

  app.use(
    "/api",
    cors({
      origin: (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin)),
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
    }),
  );
  app.use("/api", apiLimiter);
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", verifyOrigin, noStore);

  // ── Routes ──
  app.get("/health", (_req, res) => res.json({ status: "ok" })); // for load balancers
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api", aiRoutes);
  app.use("/api", notFoundHandler);

  // ── Website (after `npm run build` in client/) ──
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: "1h" }));
    app.get("/{*path}", (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
