/** Write an audit-log entry. Never throws - auditing must not break the request. */
import { AuditLog } from "../models/AuditLog.js";
import { logger } from "../utils/logger.js";

export async function audit(req, action, { user, meta } = {}) {
  try {
    await AuditLog.create({
      user: user ?? req.user?.id,
      action,
      ip: req.ip,
      userAgent: req.get("user-agent")?.slice(0, 300),
      requestId: req.id,
      meta,
    });
  } catch (error) {
    logger.error({ err: error, action }, "Failed to write audit log");
  }
}
