import { Router } from "express";

import * as users from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

router.patch("/me", validate({ body: users.updateProfileSchema }), users.updateProfile);
router.post("/me/password", authLimiter, validate({ body: users.changePasswordSchema }), users.changePassword);
router.get("/me/sessions", users.listSessions);
router.get("/me/activity", users.activity);
router.get("/me/export", users.exportData);
router.delete("/me", authLimiter, validate({ body: users.deleteAccountSchema }), users.deleteAccount);

export default router;
