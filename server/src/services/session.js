/**
 * session.js - how logging in works.
 *
 *  ACCESS token  : short-lived (15 min) signed JWT in an httpOnly cookie.
 *                  Sent with every API call. JavaScript can't read it (XSS-safe).
 *  REFRESH token : random 48-byte value (7 days) in an httpOnly cookie that is
 *                  only sent to /api/auth. Used to get a new access token.
 *                  It is ROTATED every time it is used. If an already-used
 *                  token shows up again, someone stole it -> we log out every
 *                  session in that login "family".
 *
 *  Both cookies are SameSite=Strict, so other websites can't use them (CSRF).
 */
import jwt from "jsonwebtoken";

import { config } from "../config/env.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { unauthorized } from "../utils/AppError.js";
import { audit } from "./audit.js";
import { randomToken, sha256 } from "./crypto.js";

export const ACCESS_COOKIE = "hv_access";
export const REFRESH_COOKIE = "hv_refresh";
const JWT_OPTIONS = { algorithm: "HS256", issuer: "healthveda", audience: "healthveda-web" };

const baseCookie = () => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: "strict",
});

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion }, config.JWT_ACCESS_SECRET, {
    ...JWT_OPTIONS,
    expiresIn: `${config.ACCESS_TOKEN_MINUTES}m`,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET, { ...JWT_OPTIONS, algorithms: ["HS256"] });
}

async function issueTokens(req, res, user, family) {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 86_400_000);
  await Session.create({
    user: user.id,
    tokenHash: sha256(refreshToken),
    family: family ?? randomToken(16),
    expiresAt,
    userAgent: req.get("user-agent")?.slice(0, 300),
    ip: req.ip,
  });

  res.cookie(ACCESS_COOKIE, signAccessToken(user), {
    ...baseCookie(),
    path: "/",
    maxAge: config.ACCESS_TOKEN_MINUTES * 60_000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie(),
    path: "/api/auth",
    expires: expiresAt,
  });
}

/** Start a brand-new login session. */
export const startSession = (req, res, user) => issueTokens(req, res, user);

/** Swap a valid refresh token for new tokens (rotation + theft detection). */
export async function rotateSession(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token || typeof token !== "string") throw unauthorized("Session expired, please log in again", "NO_SESSION");

  const session = await Session.findOne({ tokenHash: sha256(token) });
  if (!session) throw unauthorized("Session expired, please log in again", "NO_SESSION");

  if (session.revokedAt) {
    // A token that was already rotated is being used again -> stolen!
    await Session.updateMany({ family: session.family, revokedAt: null }, { revokedAt: new Date() });
    await audit(req, "auth.refresh_reuse", { user: session.user });
    clearAuthCookies(res);
    throw unauthorized("Session expired, please log in again", "SESSION_REUSED");
  }
  if (session.expiresAt < new Date()) throw unauthorized("Session expired, please log in again", "NO_SESSION");

  const user = await User.findById(session.user);
  if (!user) throw unauthorized();

  session.revokedAt = new Date();
  await session.save();
  await issueTokens(req, res, user, session.family);
  return user;
}

/** Log out this device. */
export async function endSession(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token === "string") {
    await Session.updateOne({ tokenHash: sha256(token) }, { revokedAt: new Date() });
  }
  clearAuthCookies(res);
}

/** Log out every device (also invalidates all current access tokens). */
export async function endAllSessions(userId) {
  await Session.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: "/api/auth" });
}
