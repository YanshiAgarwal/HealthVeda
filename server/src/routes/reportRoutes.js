import { Router } from "express";

import * as reports from "../controllers/reportController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimits.js";
import { uploadReport } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth); // every report route needs a logged-in user

router.get("/", reports.listReports);
router.get("/trends", reports.getTrends);
router.get("/sample", uploadLimiter, reports.sampleReport);
router.post("/demo-history", uploadLimiter, reports.createDemoHistory);
router.post("/", uploadLimiter, uploadReport, validate({ body: reports.uploadFieldsSchema }), reports.uploadReport);
router.post("/text", uploadLimiter, validate({ body: reports.textReportSchema }), reports.createFromText);

router.get("/:id", validate({ params: reports.idParams, query: reports.detailQuery }), reports.getReport);
router.patch("/:id", validate({ params: reports.idParams, body: reports.updateSchema }), reports.updateReport);
router.delete("/:id", validate({ params: reports.idParams }), reports.deleteReport);

export default router;
