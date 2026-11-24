import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, FileSearch, Pencil, Printer, Trash2, X } from "lucide-react";

import { reports } from "../api/healthveda.js";
import { FullPageLoader } from "../components/auth/ProtectedRoute.jsx";
import ReportResults from "../components/report/ReportResults.jsx";

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rawText, setRawText] = useState(null);
  const [form, setForm] = useState({ title: "", reportDate: "" });

  useEffect(() => {
    reports.get(id)
      .then(({ report }) => {
        setReport(report);
        setForm({ title: report.title, reportDate: report.reportDate.slice(0, 10) });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function save(event) {
    event.preventDefault();
    try {
      const { report: updated } = await reports.update(id, form);
      setReport((r) => ({ ...r, title: updated.title, reportDate: updated.reportDate }));
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove() {
    await reports.remove(id);
    navigate("/dashboard", { replace: true });
  }

  async function toggleText() {
    if (rawText !== null) return setRawText(null);
    const { report: full } = await reports.get(id, true);
    setRawText(full.extractedText || "(no text stored)");
  }

  if (error && !report) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-red-500">{error}</p>
        <Link to="/dashboard" className="btn-secondary mt-6">Back to dashboard</Link>
      </div>
    );
  }
  if (!report) return <FullPageLoader />;

  const actions = (
    <>
      <button onClick={() => setEditing(!editing)} className="btn-secondary px-4 py-2 text-sm"><Pencil size={16} /> Edit</button>
      <button onClick={toggleText} className="btn-secondary px-4 py-2 text-sm"><FileSearch size={16} /> {rawText === null ? "Original text" : "Hide text"}</button>
      <button onClick={() => window.print()} className="btn-secondary px-4 py-2 text-sm"><Printer size={16} /> Print / PDF</button>
      <button onClick={() => setConfirmDelete(true)} className="btn-secondary border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40">
        <Trash2 size={16} /> Delete
      </button>
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-10">
      <Link to="/dashboard" className="no-print inline-flex items-center gap-1 text-sm font-semibold text-leaf-600"><ArrowLeft size={16} /> My health dashboard</Link>

      {location.state?.justUploaded && (
        <div className="no-print flex items-center gap-2 rounded-2xl bg-leaf-50 p-4 text-sm text-leaf-700 dark:bg-leaf-900/40 dark:text-leaf-200">
          <CheckCircle2 size={18} /> Report analysed, encrypted and saved to your history.
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <motion.form key="edit" onSubmit={save} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="no-print card flex flex-wrap items-end gap-3 overflow-hidden">
            <label className="flex-1 text-sm font-semibold">Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} required className="input mt-1" />
            </label>
            <label className="text-sm font-semibold">Test date
              <input type="date" value={form.reportDate} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, reportDate: e.target.value })} required className="input mt-1" />
            </label>
            <button className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          </motion.form>
        )}
        {confirmDelete && (
          <motion.div key="del" role="alertdialog" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="no-print flex flex-wrap items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <Trash2 size={20} />
            <p className="flex-1 text-sm"><b>Delete this report permanently?</b> It will be removed from your history and trends. This can't be undone.</p>
            <button onClick={remove} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="btn-secondary px-4 py-2 text-sm"><X size={16} /> Keep it</button>
          </motion.div>
        )}
      </AnimatePresence>

      {rawText !== null && (
        <pre className="card max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs">{rawText}</pre>
      )}

      <ReportResults report={report} actions={actions} />
    </div>
  );
}
