import { motion } from "framer-motion";

/**
 * Shows where a value sits compared with its normal range:
 *   [  low  |■■■ normal ■■■|  high  ]   with a moving marker for the value.
 */
export default function RangeBar({ value, low, high, status }) {
  // Work out the scale: normal range sits in the middle half of the bar
  const lo = low ?? 0;
  const hi = high ?? (low ? low * 2 : value * 2 || 1);
  const span = hi - lo || 1;
  const min = Math.max(0, lo - span * 0.5);
  const max = hi + span * 0.5;
  const pct = (v) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  const markerColor = status === "normal" ? "bg-leaf-600" : status === "high" ? "bg-red-500" : "bg-sky-500";

  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
      <div className="absolute h-full rounded-full bg-leaf-300 dark:bg-leaf-500"
        style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
      <motion.div
        initial={{ left: "0%" }}
        animate={{ left: `${pct(value)}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${markerColor}`}
      />
    </div>
  );
}
