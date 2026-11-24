/** requireAuth - only logged-in users get past this point. */
import { User } from "../models/User.js";
import { ACCESS_COOKIE, verifyAccessToken } from "../services/session.js";
import { unauthorized } from "../utils/AppError.js";

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token || typeof token !== "string") throw unauthorized();

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch (error) {
    // The browser will call /api/auth/refresh and retry when it sees this code
    if (error.name === "TokenExpiredError") throw unauthorized("Session expired", "TOKEN_EXPIRED");
    throw unauthorized();
  }

  // The account must still exist and the token must not be from before a
  // "log out everywhere" or password change.
  const user = await User.findById(claims.sub);
  if (!user || user.tokenVersion !== claims.tv) throw unauthorized();

  req.user = user;
  next();
}
