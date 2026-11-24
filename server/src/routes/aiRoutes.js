import { Router } from "express";

import * as aiCtrl from "../controllers/aiController.js";
import { requireAuth } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Public
router.get("/status", aiCtrl.status);
router.get("/conditions", validate({ query: aiCtrl.conditionsQuery }), aiCtrl.listConditions);
router.get("/conditions/:name", validate({ params: aiCtrl.conditionParams }), aiCtrl.getCondition);

// Logged-in users only (uses your report history)
router.post("/chat", requireAuth, chatLimiter, validate({ body: aiCtrl.chatSchema }), aiCtrl.chat);

export default router;
