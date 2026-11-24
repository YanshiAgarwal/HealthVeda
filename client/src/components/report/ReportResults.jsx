// The full, interactive view of one analysed report.
// Used by the Report Analyzer (just uploaded / sample) and the saved report page.
import { motion } from "framer-motion";
import {
  AlertCircle, AlertTriangle, Calendar, FileText, HelpCircle, Lightbulb, ScanText, Sparkles, User,
} from "lucide-react";

import ScoreRing from "../common/ScoreRing.jsx";
import CategoryChart from "./CategoryChart.jsx";
import ConcernCard from "./ConcernCard.jsx";
import LabResults from "./LabResults.jsx";

/** The sample endpoint returns snake_case; saved reports are camelCase. */
export function normalizeReport(r) {
  return {
    ...r,
    healthScore: r.healthScore ?? r.health_score ?? 0,
    riskLevel: r.riskLevel ?? r.risk_level ?? "Unknown",
    aiPowered: r.aiPowered ?? r.ai_powered ?? false,
    tests: r.tests ?? [],
    concerns: r.concerns ?? [],
    categories: r.categories ?? [],
    summary: r.summary ?? {},
    extraction: r.extraction ?? {},
  };
}

function ListCard({ icon: Icon, title, items, color }) {
  if (!items?.length) return null;
  return (
    <div className="card">
      <h3 className={`flex items-center gap-2 font-display text-lg font-bold ${color}`}><Icon size={20} /> {title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex gap-2 text-sm">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />{item}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

const METHOD_LABEL = { "pdf-text": "Digital PDF", ocr: "OCR scan", text: "Pasted text", sample: "Sample" };

export default function ReportResults({ report: raw, actions }) {
  const report = normalizeReport(raw);
  const { patient, summary, extraction } = report;
  const riskColor = { Low: "text-leaf-600", Moderate: "text-saffron-500", High: "text-red-500" }[report.riskLevel] || "";
  const attention = report.tests.filter((t) => t.status !== "normal").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        {report.title && <h1 className="mr-2 font-display text-2xl font-bold text-leaf-900 dark:text-leaf-50">{report.title}</h1>}
        {report.reportDate && (
          <span className="chip bg-white text-slate-600 shadow-soft dark:bg-leaf-950 dark:text-leaf-200">
            <Calendar size={14} /> {new Date(report.reportDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </span>
        )}
        {report.filename && <span className="chip bg-leaf-100 text-leaf-700 dark:bg-leaf-900 dark:text-leaf-200"><FileText size={14} /> {report.filename}</span>}
        {patient?.name && (
          <span className="chip bg-white text-slate-600 shadow-soft dark:bg-leaf-950 dark:text-leaf-200">
            <User size={14} /> {patient.name}{patient.age ? `, ${patient.age}` : ""}{patient.gender ? ` · ${patient.gender}` : ""}
          </span>
        )}
        {extraction.method && (
          <span className="chip bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            <ScanText size={14} /> {METHOD_LABEL[extraction.method] || extraction.method}
            {extraction.ocr_confidence != null && ` · ${Math.round(extraction.ocr_confidence)}% confidence`}
          </span>
        )}
        {extraction.where === "browser" && (
          <span className="chip bg-leaf-50 text-leaf-700 dark:bg-leaf-900/40 dark:text-leaf-200" title="The original file never left your device">
            Read on your device
          </span>
        )}
        <span className={`chip ${report.aiPowered ? "bg-saffron-100 text-saffron-700" : "bg-slate-100 text-slate-600"}`}>
          <Sparkles size={14} /> {report.aiPowered ? "AI summary" : "Rule-based summary"}
        </span>
        {actions && <div className="no-print ml-auto flex flex-wrap gap-2">{actions}</div>}
      </div>

      {extraction.warnings?.map((w) => (
        <div key={w} className="flex items-center gap-2 rounded-2xl bg-saffron-50 p-4 text-sm text-saffron-700 dark:bg-saffron-700/10 dark:text-saffron-300">
          <AlertTriangle size={18} className="shrink-0" /> {w}
        </div>
      ))}

      {report.tests.length === 0 ? (
        <div className="card text-center">
          <AlertCircle className="mx-auto text-saffron-500" size={40} />
          <h3 className="mt-3 font-display text-xl font-bold">No lab values recognised</h3>
          <p className="mt-1 text-sm">We couldn't find known tests in this file. Try a clearer scan, or paste the text.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[auto_1fr_1fr]">
            <div className="card flex flex-col items-center justify-center">
              <ScoreRing score={report.healthScore} />
              <p className="mt-3 text-sm">Risk level: <b className={riskColor}>{report.riskLevel}</b></p>
            </div>
            <div className="card">
              <h3 className="font-display text-lg font-bold text-leaf-900 dark:text-leaf-50">Overview</h3>
              <p className="mt-2 leading-relaxed">{summary.overview}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["Values", report.tests.length, "text-leaf-700 dark:text-leaf-200"],
                  ["Normal", report.tests.length - attention, "text-leaf-600"],
                  ["Attention", attention, "text-saffron-500"]].map(([label, n, c]) => (
                  <div key={label} className="rounded-2xl bg-leaf-50 p-3 dark:bg-leaf-900/40">
                    <p className={`font-display text-2xl font-bold ${c}`}>{n}</p>
                    <p className="text-xs">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="font-display text-lg font-bold text-leaf-900 dark:text-leaf-50">By body system</h3>
              <CategoryChart categories={report.categories} />
            </div>
          </div>

          {report.concerns.length > 0 && (
            <div className="card">
              <h3 className="font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">Health concerns & Ayurvedic care</h3>
              <p className="mb-4 text-sm">Tap a concern to see herbs, diet, yoga and prevention tips.</p>
              <div className="space-y-3">
                {report.concerns.map((c, i) => <ConcernCard key={c.name} concern={c} defaultOpen={i === 0} />)}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="mb-4 font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">Your lab values</h3>
            <LabResults tests={report.tests} />
          </div>
        </>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <ListCard icon={AlertCircle} title="Key findings" items={summary.key_points} color="text-saffron-600" />
        <ListCard icon={Lightbulb} title="Recommendations" items={summary.recommendations} color="text-leaf-600" />
        <ListCard icon={HelpCircle} title="Ask your doctor" items={summary.doctor_questions} color="text-sky-600" />
      </div>

      <p className="text-center text-xs text-slate-400">{report.disclaimer}</p>
    </motion.div>
  );
}
