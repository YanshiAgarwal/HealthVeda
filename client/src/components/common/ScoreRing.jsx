import { motion } from "framer-motion";

/** Animated circular score (0-100). Colour changes with the score. */
export default function ScoreRing({ score, size = 180, label = "Health score" }) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = score >= 80 ? "#37965b" : score >= 60 ? "#fd7c10" : "#dc2626";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke}
          className="stroke-leaf-100 dark:stroke-leaf-900" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="font-display text-5xl font-bold"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
    </div>
  );
}
