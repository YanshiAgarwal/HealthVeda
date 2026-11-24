/** The user's own account: profile, password, sessions, data export, deletion. */
import mongoose from "mongoose";
import { z } from "zod";

import { AuditLog } from "../models/AuditLog.js";
import { Report } from "../models/Report.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { audit } from "../services/audit.js";
import { hashPassword, verifyPassword } from "../services/crypto.js";
import { loadUserReports } from "../services/reportStore.js";
import { clearAuthCookies, endAllSessions, startSession } from "../services/session.js";
import { badRequest, unauthorized } from "../utils/AppError.js";
import { passwordProblems } from "../utils/passwordPolicy.js";

export const updateProfileSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(80).optional(),
    dosha: z.enum(["vata", "pitta", "kapha"]).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1).max(128),
  confirm: z.literal("DELETE", { error: 'Type "DELETE" to confirm' }),
});

async function checkPassword(userId, password) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized("Your password is incorrect", "WRONG_PASSWORD");
  }
  return user;
}

export async function updateProfile(req, res) {
  Object.assign(req.user, req.valid.body);
  await req.user.save();
  await audit(req, "user.update");
  res.json({ user: req.user.toPublic() });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await checkPassword(req.user.id, currentPassword);
  const problem = passwordProblems(newPassword, user);
  if (problem) throw badRequest(problem, "WEAK_PASSWORD");
  if (currentPassword === newPassword) throw badRequest("The new password must be different.");

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  // Log out every other device, then start a fresh session here
  await endAllSessions(user.id);
  const fresh = await User.findById(user.id);
  await startSession(req, res, fresh);
  await audit(req, "user.password_change");
  res.json({ ok: true });
}

export async function listSessions(req, res) {
  // mongoose.trusted(): our own operator, allowed past the injection filter
  const sessions = await Session.find({
    user: req.user.id, revokedAt: null, expiresAt: mongoose.trusted({ $gt: new Date() }),
  })
    .sort({ createdAt: -1 })
    .select("createdAt userAgent ip expiresAt");
  res.json({ sessions: sessions.map((s) => ({ id: s.id, createdAt: s.createdAt, userAgent: s.userAgent, ip: s.ip })) });
}

export async function activity(req, res) {
  const entries = await AuditLog.find({ user: req.user.id }).sort({ at: -1 }).limit(30).select("action at ip userAgent");
  res.json({ activity: entries.map((e) => ({ action: e.action, at: e.at, ip: e.ip, userAgent: e.userAgent })) });
}

/** Data portability: download everything we hold about you. */
export async function exportData(req, res) {
  const reports = await loadUserReports(req.user.id);
  await audit(req, "user.export");
  res.set("Content-Disposition", `attachment; filename="healthveda-export-${Date.now()}.json"`);
  res.json({ exportedAt: new Date(), user: req.user.toPublic(), reports });
}

/** Right to erasure: permanently delete the account and all medical data. */
export async function deleteAccount(req, res) {
  await checkPassword(req.user.id, req.valid.body.password);
  const userId = req.user.id;
  await Report.deleteMany({ user: userId });
  await Session.deleteMany({ user: userId });
  await User.deleteOne({ _id: userId });
  await audit(req, "user.delete", { user: userId }); // keeps only id + timestamp
  clearAuthCookies(res);
  res.status(204).end();
}
