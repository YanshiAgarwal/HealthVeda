/**
 * Security audit trail: who did what, when, from where.
 * Never contains medical data. Kept for 1 year, then deleted automatically.
 */
import mongoose from "mongoose";

export const AUDIT_ACTIONS = [
  "auth.register", "auth.login", "auth.login_failed", "auth.locked", "auth.logout",
  "auth.logout_all", "auth.refresh_reuse", "user.update", "user.password_change",
  "user.export", "user.delete", "report.create", "report.view", "report.update", "report.delete",
];

const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  action: { type: String, enum: AUDIT_ACTIONS, required: true },
  ip: String,
  userAgent: String,
  requestId: String,
  meta: { type: Object, default: {} },
  at: { type: Date, default: Date.now },
});

auditSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

export const AuditLog = mongoose.model("AuditLog", auditSchema);
