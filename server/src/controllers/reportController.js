/** Medical reports: analyse, save (encrypted), list, view, edit, delete, trends. */
import { z } from "zod";

import { Report } from "../models/Report.js";
import { ai } from "../services/aiClient.js";
import { audit } from "../services/audit.js";
import { encryptJSON, sha256 } from "../services/crypto.js";
import { buildInsights, buildTrends } from "../services/insights.js";
import {
  loadReport, loadUserReports, saveReport, toDetail, toSummary,
} from "../services/reportStore.js";
import { AppError, notFound } from "../utils/AppError.js";

// ── Validation schemas ──────────────────────────────────────────────────
const reportDate = z.iso
  .date("Use the format YYYY-MM-DD")
  .refine((d) => new Date(d) <= new Date(), "Report date can't be in the future")
  .refine((d) => new Date(d) >= new Date("1950-01-01"), "Report date is too old");

const title = z.string().trim().max(80);

export const uploadFieldsSchema = z.strictObject({
  reportDate: reportDate.optional(),
  title: title.optional(),
});
// The website reads PDFs / photos IN THE BROWSER (pdf.js + tesseract.js) and
// sends only the extracted text, plus how it was read.
const extraction = z.strictObject({
  method: z.enum(["pdf-text", "ocr", "text"]),
  pages: z.number().int().min(1).max(100).optional(),
  ocrEngine: z.enum(["tesseract.js"]).optional(),
  ocrConfidence: z.number().min(0).max(100).optional(),
  warnings: z.array(z.string().max(300)).max(5).default([]),
});

export const textReportSchema = z.strictObject({
  text: z.string().min(10, "Please paste more of the report").max(50_000),
  reportDate: reportDate.optional(),
  title: title.optional(),
  filename: z.string().max(200).optional(),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/, "Invalid file hash").optional(), // SHA-256 from the browser
  extraction: extraction.optional(),
});
export const updateSchema = z
  .strictObject({ reportDate: reportDate.optional(), title: title.min(1).optional() })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export const idParams = z.strictObject({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid report id") });
export const detailQuery = z.strictObject({ includeText: z.enum(["true", "false"]).optional() });

const today = () => new Date().toISOString().slice(0, 10);
const safeFilename = (name) => String(name || "report").replace(/[^\w.\- ]+/g, "_").slice(0, 100);

// ── Create ──────────────────────────────────────────────────────────────
export async function uploadReport(req, res) {
  const { reportDate = today(), title } = req.valid.body;
  const fileHash = sha256(req.file.buffer);

  const duplicate = await Report.findOne({ user: req.user.id, fileHash }).select("_id");
  if (duplicate) {
    throw new AppError(409, "You have already uploaded this exact file.", "DUPLICATE_REPORT");
  }

  const filename = safeFilename(req.file.originalname);
  const analysis = await ai.analyzeFile(req.file.buffer, filename, req.file.detectedType);
  const report = await saveReport(req.user.id, analysis, {
    reportDate: new Date(reportDate), title: title || filename, filename, fileHash,
  });

  await audit(req, "report.create", { meta: { reportId: report.id, method: report.extraction.method } });
  res.status(201).json({ report: toDetail(report) });
}

export async function createFromText(req, res) {
  const { text, reportDate = today(), title, filename: rawName, fileHash, extraction } = req.valid.body;
  const filename = rawName ? safeFilename(rawName) : null;

  if (fileHash && (await Report.exists({ user: req.user.id, fileHash }))) {
    throw new AppError(409, "You have already uploaded this exact file.", "DUPLICATE_REPORT");
  }

  const analysis = await ai.analyzeText(text);
  if (extraction) {
    analysis.extraction = {
      method: extraction.method,
      pages: extraction.pages ?? 1,
      ocr_engine: extraction.ocrEngine ?? null,
      ocr_confidence: extraction.ocrConfidence ?? null,
      warnings: extraction.warnings,
      where: "browser", // the original file never left the user's device
    };
  }
  const report = await saveReport(req.user.id, analysis, {
    reportDate: new Date(reportDate), title: title || filename || "Pasted report", filename, fileHash,
  });
  await audit(req, "report.create", { meta: { reportId: report.id, method: analysis.extraction?.method ?? "text" } });
  res.status(201).json({ report: toDetail(report) });
}

/** Demo analysis - NOT saved to history. */
export async function sampleReport(_req, res) {
  const { extracted_text: _ignored, ...analysis } = await ai.sample();
  res.json({ sample: true, analysis });
}

/** Creates 3 demo reports (6 months apart -> today) so trends can be shown. */
export async function createDemoHistory(req, res) {
  const existing = await Report.countDocuments({ user: req.user.id, fileHash: /^demo-/ });
  if (existing) throw new AppError(409, "Demo history was already added.", "DEMO_EXISTS");

  const created = [];
  for (const [index, visit] of DEMO_VISITS.entries()) {
    const date = new Date();
    date.setMonth(date.getMonth() - visit.monthsAgo);
    const analysis = await ai.analyzeText(demoReportText(visit));
    const report = await saveReport(req.user.id, analysis, {
      reportDate: date, title: `Demo checkup ${index + 1}`, fileHash: `demo-${index}`,
    });
    created.push(toSummary(report));
  }
  await audit(req, "report.create", { meta: { demo: true, count: created.length } });
  res.status(201).json({ reports: created });
}

// ── Read ────────────────────────────────────────────────────────────────
export async function listReports(req, res) {
  const reports = await loadUserReports(req.user.id);
  res.json({ reports: reports.map(toSummary) });
}

export async function getReport(req, res) {
  const report = await loadReport(req.user.id, req.valid.params.id);
  if (!report) throw notFound("Report not found");
  await audit(req, "report.view", { meta: { reportId: report.id } });
  res.json({ report: toDetail(report, { includeText: req.valid.query.includeText === "true" }) });
}

/** Trends over time + personal insights (the medical-history dashboard). */
export async function getTrends(req, res) {
  const reports = await loadUserReports(req.user.id);
  const trends = buildTrends(reports);
  const latest = reports[0] ?? null;
  res.json({
    reportCount: reports.length,
    latest: latest ? toSummary(latest) : null,
    scoreHistory: [...reports].reverse().map((r) => ({ date: r.reportDate, score: r.healthScore, id: r.id })),
    trends,
    insights: buildInsights(trends, latest),
  });
}

// ── Update / delete ─────────────────────────────────────────────────────
export async function updateReport(req, res) {
  const { id } = req.valid.params;
  const report = await loadReport(req.user.id, id);
  if (!report) throw notFound("Report not found");

  const { reportDate, title: newTitle } = req.valid.body;
  const update = {};
  if (reportDate) update.reportDate = new Date(reportDate);
  if (newTitle) {
    const { id: _id, reportDate: _d, createdAt: _c, ...data } = report;
    update.payload = encryptJSON({ ...data, title: newTitle }, req.user.id);
  }
  await Report.updateOne({ _id: id, user: req.user.id }, update);
  await audit(req, "report.update", { meta: { reportId: id } });

  const fresh = await loadReport(req.user.id, id);
  res.json({ report: toSummary(fresh) });
}

export async function deleteReport(req, res) {
  const { id } = req.valid.params;
  const result = await Report.deleteOne({ _id: id, user: req.user.id });
  if (!result.deletedCount) throw notFound("Report not found");
  await audit(req, "report.delete", { meta: { reportId: id } });
  res.status(204).end();
}

// ── Demo data ───────────────────────────────────────────────────────────
const DEMO_VISITS = [
  { monthsAgo: 6, glucose: 132, hba1c: 6.7, chol: 252, ldl: 175, hdl: 36, tg: 210, bp: "148/95", hb: 10.8, vitd: 14, bmi: 28.6 },
  { monthsAgo: 3, glucose: 121, hba1c: 6.3, chol: 236, ldl: 160, hdl: 39, tg: 182, bp: "138/88", hb: 11.6, vitd: 22, bmi: 27.9 },
  { monthsAgo: 0, glucose: 104, hba1c: 5.9, chol: 205, ldl: 128, hdl: 43, tg: 150, bp: "128/82", hb: 12.6, vitd: 31, bmi: 26.8 },
];

function demoReportText(v) {
  return `HEALTHVEDA DEMO LAB - HEALTH CHECKUP
Hemoglobin ${v.hb} g/dL 12.0 - 17.0
Fasting Blood Sugar ${v.glucose} mg/dL 70 - 99
HbA1c ${v.hba1c} % 4.0 - 5.6
Total Cholesterol ${v.chol} mg/dL < 200
HDL Cholesterol ${v.hdl} mg/dL > 40
LDL Cholesterol ${v.ldl} mg/dL < 100
Triglycerides ${v.tg} mg/dL < 150
Serum Creatinine 0.9 mg/dL 0.6 - 1.3
SGPT (ALT) 32 U/L 7 - 56
TSH 2.1 mIU/L 0.4 - 4.0
Vitamin D ${v.vitd} ng/mL 30 - 100
Blood Pressure: ${v.bp} mmHg   BMI: ${v.bmi} kg/m2`;
}
