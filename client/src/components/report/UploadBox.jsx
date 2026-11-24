import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, ClipboardPaste, FileUp, Sparkles } from "lucide-react";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain";
const MAX_MB = 15; // read in the browser, so larger scans are fine
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Upload a report: drag & drop / browse / phone camera / paste text.
 * The user also picks the date the test was done (needed for trends).
 */
export default function UploadBox({ onFile, onText, onSample, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [text, setText] = useState("");
  const [reportDate, setReportDate] = useState(today);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  function pick(file) {
    setError("");
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File is too large (max ${MAX_MB} MB).`);
    onFile(file, { reportDate });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <label className="mx-auto flex max-w-xs items-center justify-center gap-2 text-sm font-semibold">
        Test date
        <input type="date" value={reportDate} max={today()} onChange={(e) => setReportDate(e.target.value)}
          className="input w-auto py-2" />
      </label>

      {!pasteMode ? (
        <motion.div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
          onClick={() => !disabled && fileRef.current.click()}
          animate={{ scale: dragging ? 1.02 : 1 }}
          className={`card cursor-pointer border-2 border-dashed py-14 text-center transition ${
            dragging ? "border-leaf-500 bg-leaf-50 dark:bg-leaf-900/40" : "border-leaf-200 hover:border-leaf-400 dark:border-leaf-800"}`}
        >
          <motion.span animate={{ y: dragging ? -8 : [0, -6, 0] }} transition={{ repeat: dragging ? 0 : Infinity, duration: 2 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-leaf-600 text-white shadow-soft">
            <FileUp size={30} />
          </motion.span>
          <h3 className="mt-4 font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">
            {dragging ? "Drop it here!" : "Drag & drop your lab report"}
          </h3>
          <p className="mt-1 text-sm">PDF (digital or scanned), photo (JPG / PNG / WEBP) or TXT · max {MAX_MB} MB</p>
          <p className="mt-1 text-xs text-slate-400">Read on your device with OCR (computer vision) - the file itself is never uploaded</p>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
        </motion.div>
      ) : (
        <div className="card space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} maxLength={50000}
            className="input font-mono text-sm"
            placeholder={"Paste your report text here, e.g.\nHemoglobin 13.5 g/dL 13.0 - 17.0\nFasting Glucose 105 mg/dL 70 - 99\nBlood Pressure 130/85"} />
          <button onClick={() => onText(text, { reportDate })} disabled={disabled || text.trim().length < 10} className="btn-primary w-full">
            Analyze & save
          </button>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={() => cameraRef.current.click()} className="btn-secondary sm:hidden" disabled={disabled}>
          <Camera size={18} /> Take a photo
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button onClick={onSample} className="btn-secondary" disabled={disabled}>
          <Sparkles size={18} /> Try a sample report
        </button>
        <button onClick={() => setPasteMode(!pasteMode)} className="btn-secondary" disabled={disabled}>
          {pasteMode ? <><FileUp size={18} /> Upload a file instead</> : <><ClipboardPaste size={18} /> Paste report text</>}
        </button>
      </div>
    </div>
  );
}
