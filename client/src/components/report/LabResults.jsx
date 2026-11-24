import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check } from "lucide-react";

import RangeBar from "./RangeBar.jsx";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "normal", label: "Normal" },
];

function rangeText(low, high, unit) {
  if (low != null && high != null) return `${low} – ${high} ${unit}`;
  if (high != null) return `≤ ${high} ${unit}`;
  if (low != null) return `≥ ${low} ${unit}`;
  return "-";
}

function StatusBadge({ status, severity }) {
  if (status === "normal")
    return <span className="chip bg-leaf-100 text-leaf-700 dark:bg-leaf-900 dark:text-leaf-200"><Check size={12} /> Normal</span>;
  const strong = severity === "abnormal";
  const Icon = status === "high" ? ArrowUp : ArrowDown;
  const color = status === "high"
    ? strong ? "bg-red-100 text-red-700" : "bg-saffron-100 text-saffron-700"
    : strong ? "bg-sky-200 text-sky-800" : "bg-sky-100 text-sky-700";
  const label = status === "high" ? "High" : "Low";
  return <span className={`chip ${color}`}><Icon size={12} /> {strong ? label : `Slightly ${status}`}</span>;
}

/** Every lab value as a card with a range bar, filterable. */
export default function LabResults({ tests }) {
  const [filter, setFilter] = useState("all");
  const visible = tests.filter((t) =>
    filter === "all" ? true : filter === "normal" ? t.status === "normal" : t.status !== "normal");

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? tests.length
            : tests.filter((t) => (f.key === "normal" ? t.status === "normal" : t.status !== "normal")).length;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === f.key ? "bg-leaf-600 text-white" : "bg-leaf-50 text-leaf-700 hover:bg-leaf-100 dark:bg-leaf-900 dark:text-leaf-200"}`}>
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <motion.div layout className="grid gap-3 md:grid-cols-2">
        <AnimatePresence>
          {visible.map((t) => (
            <motion.div key={t.key} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl border border-leaf-100 bg-white p-4 dark:border-leaf-900 dark:bg-leaf-950/60">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-leaf-900 dark:text-leaf-50">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.category} · {t.info}</p>
                </div>
                <StatusBadge status={t.status} severity={t.severity} />
              </div>
              {t.check && (
                <p className="mt-2 rounded-xl bg-saffron-50 px-3 py-2 text-xs font-semibold text-saffron-700 dark:bg-saffron-700/10 dark:text-saffron-300">
                  ⚠ Unusual value - please check your paper report. {t.check_hint}
                </p>
              )}
              <div className="mt-3 flex items-end justify-between">
                <p className="font-display text-2xl font-bold text-leaf-900 dark:text-leaf-50">
                  {t.value.toLocaleString("en-IN")} <span className="text-sm font-normal text-slate-400">{t.unit}</span>
                </p>
                <p className="text-right text-xs text-slate-400">
                  Normal: {rangeText(t.low, t.high, t.unit)}
                  <br />
                  <span title={t.range_source === "report" ? "Range printed on your lab report" : "Standard adult range"}>
                    {t.range_source === "report" ? "from your lab" : "standard range"}
                  </span>
                </p>
              </div>
              <div className="mt-3"><RangeBar value={t.value} low={t.low} high={t.high} status={t.status} /></div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
