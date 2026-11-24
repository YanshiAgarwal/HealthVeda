import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, FileText, Info, Lock, RotateCcw, ScanText } from "lucide-react";

import { reports } from "../api/healthveda.js";
import PageHeader from "../components/common/PageHeader.jsx";
import ReportResults from "../components/report/ReportResults.jsx";
import UploadBox from "../components/report/UploadBox.jsx";

const MAX_TEXT = 50_000; // the server accepts up to 50,000 characters

/** Real progress while the report is read and analysed. */
function Progress({ label, fraction }) {
  return (
    <div className="card mx-auto max-w-md text-center" role="status" aria-live="polite">
      <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-leaf-600 text-white">
        <ScanText size={28} />
      </motion.span>
      <p className="mt-5 font-semibold text-leaf-900 dark:text-leaf-50">{label}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-leaf-100 dark:bg-leaf-900">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-saffron-400"
          animate={{ width: `${Math.round(fraction * 100)}%` }} transition={{ ease: "easeOut" }} />
      </div>
      <p className="mt-3 text-xs text-slate-400">Your file is processed on this device. Only the extracted text is sent, encrypted at rest.</p>
    </div>
  );
}

export default function ReportAnalyzer() {
  const navigate = useNavigate();
  const [state, setState] = useState("upload"); // upload | working | sample
  const [progress, setProgress] = useState({ label: "", fraction: 0 });
  const [sample, setSample] = useState(null);
  const [error, setError] = useState(null);

  async function run(task) {
    setError(null);
    setState("working");
    setProgress({ label: "Starting…", fraction: 0.02 });
    try {
      await task();
    } catch (e) {
      setError(e);
      setState("upload");
    }
  }

  const step = (label, fraction) => setProgress({ label, fraction });

  async function analyseAndSave(text, details) {
    step("Analysing values & finding Ayurvedic care…", 0.92);
    const { report } = await reports.fromText(text.slice(0, MAX_TEXT), details);
    navigate(`/reports/${report.id}`, { state: { justUploaded: true } });
  }

  const onFile = (file, { reportDate }) =>
    run(async () => {
      const { readReportFile } = await import("../ocr/readReport.js"); // loaded only when needed
      const doc = await readReportFile(file, (label, fraction) => step(label, fraction * 0.9));
      if (doc.text.length > MAX_TEXT) doc.warnings.push("This report is very long; only the first part was analysed.");
      await analyseAndSave(doc.text, {
        reportDate,
        filename: file.name,
        fileHash: doc.fileHash,
        extraction: {
          method: doc.method,
          pages: doc.pages,
          ...(doc.method === "ocr" && { ocrEngine: "tesseract.js", ocrConfidence: Math.round(doc.ocrConfidence * 10) / 10 }),
          warnings: doc.warnings.slice(0, 5),
        },
      });
    });

  const onText = (text, { reportDate }) => run(() => analyseAndSave(text, { reportDate }));

  const onSample = () =>
    run(async () => {
      step("Analysing the sample report…", 0.5);
      const result = await reports.sample();
      setSample(result.analysis);
      setState("sample");
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {state !== "sample" && (
        <PageHeader icon={FileText} eyebrow="Report Analyzer" title="Understand your lab report"
          subtitle="Upload a PDF or a photo of your report. Every value is explained, saved securely to your history, and linked to Ayurvedic care." />
      )}

      <AnimatePresence mode="wait">
        {state === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {error && (
              <div role="alert" className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle size={18} /> {error.message}
                {error.code === "DUPLICATE_REPORT" && <Link to="/dashboard" className="font-semibold underline">Open my reports</Link>}
              </div>
            )}
            <UploadBox onFile={onFile} onText={onText} onSample={onSample} />
            <p className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-2 text-center text-xs text-slate-400">
              <Lock size={14} /> Files are read on your device. Only the extracted text is sent and it is encrypted (AES-256) before storage.
            </p>
          </motion.div>
        )}
        {state === "working" && (
          <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Progress label={progress.label} fraction={progress.fraction} />
          </motion.div>
        )}
        {state === "sample" && sample && (
          <motion.div key="sample" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl bg-sky-50 p-4 text-sm text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <Info size={18} /> This is a sample report - it is not saved to your history.
            </div>
            <ReportResults report={{ ...sample, title: "Sample report" }}
              actions={<button onClick={() => setState("upload")} className="btn-primary px-4 py-2 text-sm"><RotateCcw size={16} /> Upload my report</button>} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
