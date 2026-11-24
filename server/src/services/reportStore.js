/**
 * reportStore.js - save / load reports with transparent encryption.
 * Controllers never touch `payload` directly; they use these helpers.
 */
import { Report } from "../models/Report.js";
import { decryptJSON, encryptJSON, usesOldKey } from "./crypto.js";
import { logger } from "../utils/logger.js";

const MAX_HISTORY = 200;

/** Pick only the fields we want to keep from the AI service's analysis. */
function payloadFrom(analysis, { title, filename }) {
  return {
    title: title || "Lab report",
    filename: filename || null,
    patient: analysis.patient ?? {},
    tests: analysis.tests ?? [],
    concerns: analysis.concerns ?? [],
    categories: analysis.categories ?? [],
    summary: analysis.summary ?? {},
    healthScore: analysis.health_score ?? 0,
    riskLevel: analysis.risk_level ?? "Unknown",
    aiPowered: Boolean(analysis.ai_powered),
    extraction: analysis.extraction ?? {},
    extractedText: analysis.extracted_text ?? "",
    disclaimer: analysis.disclaimer ?? "",
  };
}

export async function saveReport(userId, analysis, { reportDate, title, filename, fileHash }) {
  const doc = await Report.create({
    user: userId,
    reportDate,
    fileHash,
    payload: encryptJSON(payloadFrom(analysis, { title, filename }), userId),
  });
  return decryptDoc(doc);
}

/** Decrypt one MongoDB document into a plain report object. */
export function decryptDoc(doc) {
  const data = decryptJSON(doc.payload, doc.user);
  if (usesOldKey(doc.payload)) {
    // Key rotation: quietly re-encrypt with the current key
    Report.updateOne({ _id: doc._id }, { payload: encryptJSON(data, doc.user) }).catch((err) =>
      logger.error({ err }, "Re-encryption failed"),
    );
  }
  return { id: doc.id, reportDate: doc.reportDate, createdAt: doc.createdAt, ...data };
}

/** The list view: no extracted text, no long summaries. */
export function toSummary(report) {
  const attention = report.tests.filter((t) => t.status !== "normal").length;
  return {
    id: report.id,
    title: report.title,
    filename: report.filename,
    reportDate: report.reportDate,
    createdAt: report.createdAt,
    healthScore: report.healthScore,
    riskLevel: report.riskLevel,
    testCount: report.tests.length,
    attentionCount: attention,
    concerns: report.concerns.map((c) => c.name),
    method: report.extraction?.method,
  };
}

/** Full report for the browser (raw OCR text left out unless asked for). */
export function toDetail(report, { includeText = false } = {}) {
  const { extractedText, ...rest } = report;
  return includeText ? report : { ...rest, hasText: Boolean(extractedText) };
}

export async function loadUserReports(userId) {
  const docs = await Report.find({ user: userId }).sort({ reportDate: -1 }).limit(MAX_HISTORY);
  const reports = [];
  for (const doc of docs) {
    try {
      reports.push(decryptDoc(doc));
    } catch (err) {
      // Tampered or foreign record: never show it, but keep the rest working
      logger.error({ err, reportId: doc.id }, "SECURITY: report failed integrity check");
    }
  }
  return reports;
}

export async function loadReport(userId, id) {
  const doc = await Report.findOne({ _id: id, user: userId }); // ownership check
  return doc ? decryptDoc(doc) : null;
}

export async function latestReport(userId) {
  const doc = await Report.findOne({ user: userId }).sort({ reportDate: -1, createdAt: -1 });
  return doc ? decryptDoc(doc) : null;
}
