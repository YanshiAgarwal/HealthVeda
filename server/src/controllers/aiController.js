/** Chat, Remedy Explorer and status - forwarded to the AI service. */
import { z } from "zod";

import { ai } from "../services/aiClient.js";
import { reportContext } from "../services/insights.js";
import { latestReport } from "../services/reportStore.js";

export const chatSchema = z.strictObject({
  message: z.string().trim().min(1, "Message is empty").max(1000),
  history: z
    .array(z.strictObject({ user: z.string().max(2000), bot: z.string().max(4000) }))
    .max(20)
    .default([]),
  language: z.string().regex(/^[A-Za-z ]{2,30}$/).default("English"),
  useReport: z.boolean().default(true), // combine symptoms with the latest lab report
});

export const conditionsQuery = z.strictObject({
  search: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});
export const conditionParams = z.strictObject({ name: z.string().trim().min(1).max(120) });

export async function chat(req, res) {
  const { message, history, language, useReport } = req.valid.body;
  const latest = useReport ? await latestReport(req.user.id) : null;
  const context = reportContext(latest);
  const reply = await ai.chat({ message, history: history.slice(-6), language, report_context: context });
  res.json({ ...reply, reportDate: context ? latest.reportDate : null });
}

export async function listConditions(req, res) {
  const { search, limit } = req.valid.query;
  res.json(await ai.conditions(search, limit));
}

export async function getCondition(req, res) {
  res.json(await ai.condition(req.valid.params.name));
}

export async function status(_req, res) {
  let aiStatus = null;
  try {
    aiStatus = await ai.status();
  } catch {
    /* AI service down - still answer */
  }
  res.json({
    server: "ok",
    ai: aiStatus
      ? { online: true, aiEnabled: aiStatus.ai_enabled, searchMode: aiStatus.search_mode, ocrEngine: aiStatus.ocr_engine }
      : { online: false },
  });
}
