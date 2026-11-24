/**
 * crypto.js - all cryptography in ONE place (only Node's built-in `crypto`).
 *
 * 1. Passwords   -> scrypt (memory-hard, OWASP-recommended). Never stored in plain text.
 * 2. Medical data -> AES-256-GCM encryption at rest. Even someone who steals the
 *                    database cannot read reports without DATA_ENCRYPTION_KEY.
 *                    Each record is bound to its owner (AAD = user id), so an
 *                    encrypted report can't be copied into another user's account.
 * 3. Tokens      -> random values; only their SHA-256 hash is stored.
 */
import crypto from "node:crypto";
import { promisify } from "node:util";

import { config } from "../config/env.js";

const scrypt = promisify(crypto.scrypt);

// ── 1. Passwords ──────────────────────────────────────────────────────────
const SCRYPT = { r: 8, p: 1, keyLength: 64 };

export async function hashPassword(password) {
  const N = config.SCRYPT_COST;
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keyLength, {
    N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 256 * N * SCRYPT.r,
  });
  // Store the parameters too, so we can raise the cost later
  return `scrypt$${N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const [algo, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * Number(N) * Number(r),
  });
  return crypto.timingSafeEqual(actual, expected); // constant-time comparison
}

export const needsRehash = (stored) => !String(stored).startsWith(`scrypt$${config.SCRYPT_COST}$`);

// A real hash of a random password: used when a login email doesn't exist,
// so "wrong email" and "wrong password" take the same time (no user enumeration).
let dummyHash;
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(password, dummyHash);
  return false;
}

// ── 2. Encryption at rest (AES-256-GCM) ──────────────────────────────────
const keys = new Map([[config.DATA_ENCRYPTION_KEY_ID, Buffer.from(config.DATA_ENCRYPTION_KEY, "base64")]]);
for (const entry of config.DATA_ENCRYPTION_OLD_KEYS.split(",").filter(Boolean)) {
  const [id, b64] = entry.split(":");
  keys.set(id, Buffer.from(b64, "base64"));
}

/** Encrypt any JSON-able value. Output: "keyId.iv.authTag.ciphertext" (base64url). */
export function encryptJSON(value, ownerId) {
  const keyId = config.DATA_ENCRYPTION_KEY_ID;
  const iv = crypto.randomBytes(12); // unique per message - required for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", keys.get(keyId), iv);
  cipher.setAAD(Buffer.from(String(ownerId)));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [keyId, iv, cipher.getAuthTag(), data].map((p) => (Buffer.isBuffer(p) ? p.toString("base64url") : p)).join(".");
}

/** Decrypt. Throws if the data was tampered with or belongs to another user. */
export function decryptJSON(payload, ownerId) {
  const [keyId, iv, tag, data] = String(payload).split(".");
  const key = keys.get(keyId);
  if (!key) throw new Error(`Unknown encryption key id: ${keyId}`);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(String(ownerId)));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

/** True if data was encrypted with an old key and should be re-encrypted. */
export const usesOldKey = (payload) => !String(payload).startsWith(`${config.DATA_ENCRYPTION_KEY_ID}.`);

// ── 3. Tokens & hashes ───────────────────────────────────────────────────
export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
