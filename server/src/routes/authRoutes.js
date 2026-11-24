import { Router } from "express";

import * as auth from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post("/register", authLimiter, validate({ body: auth.registerSchema }), auth.register);
router.post("/login", authLimiter, validate({ body: auth.loginSchema }), auth.login);
router.post("/refresh", auth.refresh);
router.post("/logout", auth.logout);
router.post("/logout-all", requireAuth, auth.logoutAll);
router.get("/me", requireAuth, auth.me);

export default router;
