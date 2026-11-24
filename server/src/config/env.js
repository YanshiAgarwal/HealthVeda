/**
 * env.js - every setting of the server, checked ONCE at start-up.
 *
 * If something important is missing or weak (e.g. a short JWT secret),
 * the server refuses to start and tells you exactly what to fix.
 * Generate strong secrets with:   npm run gen-secrets
 */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/healthveda"),

  // Signs login tokens. Must be long and random.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),

  // AES-256 key (32 bytes, base64) that encrypts medical data in MongoDB.
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
  DATA_ENCRYPTION_KEY_ID: z.string().regex(/^[a-z0-9]{1,8}$/).default("k1"),
  // Old keys kept only to DECRYPT existing data after a key rotation: "k0:base64,..."
  DATA_ENCRYPTION_OLD_KEYS: z.string().default(""),

  // The internal Python AI service
  AI_SERVICE_URL: z.url().default("http://127.0.0.1:8000"),
  AI_SERVICE_KEY: z.string().min(32, "AI_SERVICE_KEY must be at least 32 characters"),

  // Websites allowed to call this API (comma separated)
  // (On Vercel the site and API share one domain, which is always allowed.)
  CLIENT_ORIGINS: z.string().default(process.env.VERCEL ? "" : "http://localhost:5173,http://127.0.0.1:5173"),
  // Behind a reverse proxy (nginx, Render...) set to the number of proxies, e.g. 1
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(process.env.VERCEL ? 1 : 0),

  // Where rate-limit counters live. "mongo" is required on serverless hosts
  // (Vercel), where each request may hit a different instance.
  RATE_LIMIT_STORE: z.enum(["memory", "mongo"]).default(process.env.VERCEL ? "mongo" : "memory"),
  // Max upload size. Vercel functions accept at most 4.5 MB per request.
  MAX_UPLOAD_MB: z.coerce.number().min(1).max(50).default(process.env.VERCEL ? 4 : 10),

  // Password hashing cost (scrypt N). OWASP recommends 2^17 = 131072.
  SCRYPT_COST: z.coerce.number().int().min(1024).default(131072),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "silent"]).default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("\n❌ Invalid server configuration (check server/.env):");
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\n   Tip: run `npm run gen-secrets` to create strong secrets.\n");
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  clientOrigins: env.CLIENT_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  // Secure cookies need HTTPS - always on in production
  cookieSecure: env.NODE_ENV === "production",
};

if (config.isProduction && config.clientOrigins.some((o) => o.startsWith("http://"))) {
  console.warn("⚠️  CLIENT_ORIGINS contains a non-HTTPS origin in production.");
}
