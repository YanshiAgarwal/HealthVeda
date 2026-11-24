/** Sign up, log in, refresh, log out. */
import { z } from "zod";

import { User } from "../models/User.js";
import { audit } from "../services/audit.js";
import { dummyVerify, hashPassword, needsRehash, verifyPassword } from "../services/crypto.js";
import { endAllSessions, endSession, rotateSession, startSession } from "../services/session.js";
import { AppError, badRequest, unauthorized } from "../utils/AppError.js";
import { passwordProblems } from "../utils/passwordPolicy.js";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.email("Enter a valid email").max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const loginSchema = z.strictObject({
  email: z.string().trim().max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(128),
});

export async function register(req, res) {
  const { name, email, password } = req.valid.body;
  const problem = passwordProblems(password, { email, name });
  if (problem) throw badRequest(problem, "WEAK_PASSWORD");

  if (await User.exists({ email })) {
    throw new AppError(409, "An account with this email already exists. Try logging in.", "EMAIL_TAKEN");
  }
  const user = await User.create({ name, email, passwordHash: await hashPassword(password) });

  await startSession(req, res, user);
  await audit(req, "auth.register", { user: user.id });
  res.status(201).json({ user: user.toPublic() });
}

export async function login(req, res) {
  const { email, password } = req.valid.body;
  const invalid = () => unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    await dummyVerify(password); // same timing as a real check -> no user enumeration
    throw invalid();
  }

  if (user.isLocked()) {
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60_000);
    throw new AppError(429, `Too many failed attempts. Try again in ${minutes} minute(s).`, "ACCOUNT_LOCKED");
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    user.failedLogins += 1;
    if (user.failedLogins >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      user.failedLogins = 0;
      await audit(req, "auth.locked", { user: user.id });
    }
    await user.save();
    await audit(req, "auth.login_failed", { user: user.id });
    throw invalid();
  }

  user.failedLogins = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  if (needsRehash(user.passwordHash)) user.passwordHash = await hashPassword(password);
  await user.save();

  await startSession(req, res, user);
  await audit(req, "auth.login", { user: user.id });
  res.json({ user: user.toPublic() });
}

export async function refresh(req, res) {
  const user = await rotateSession(req, res);
  res.json({ user: user.toPublic() });
}

export async function logout(req, res) {
  await endSession(req, res);
  if (req.user) await audit(req, "auth.logout");
  res.json({ ok: true });
}

export async function logoutAll(req, res) {
  await endAllSessions(req.user.id);
  await endSession(req, res);
  await audit(req, "auth.logout_all");
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ user: req.user.toPublic() });
}
