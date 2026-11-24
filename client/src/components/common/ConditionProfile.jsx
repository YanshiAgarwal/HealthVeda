import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Apple, FlaskConical, HeartPulse, Leaf, PersonStanding, ShieldCheck } from "lucide-react";

// Tabs shown for one Ayurvedic condition profile (from the dataset).
const TABS = [
  { key: "herbs", label: "Herbs", icon: Leaf, fields: [["Ayurvedic herbs", "herbs"], ["Home formulation", "formulation"], ["Other remedies", "remedies"]] },
  { key: "diet", label: "Diet", icon: Apple, fields: [["Diet & lifestyle", "diet"], ["Advice", "advice"]] },
  { key: "yoga", label: "Yoga", icon: PersonStanding, fields: [["Yoga & therapy", "yoga"]] },
  { key: "prevent", label: "Prevent", icon: ShieldCheck, fields: [["Prevention", "prevention"], ["Possible complications", "complications"]] },
  { key: "medical", label: "Medical", icon: FlaskConical, fields: [["Tests doctors use", "tests"], ["Medical treatment", "medical"]] },
];

export function DoshaChips({ doshas }) {
  const colors = { vata: "bg-sky-100 text-sky-700", pitta: "bg-saffron-100 text-saffron-700", kapha: "bg-leaf-100 text-leaf-700" };
  return (
    <div className="flex flex-wrap gap-1">
      {(doshas || "").split(/[,/]/).map((d) => d.trim()).filter(Boolean).map((d) => (
        <span key={d} className={`chip ${colors[d.toLowerCase()] || "bg-slate-100 text-slate-600"}`}>{d}</span>
      ))}
    </div>
  );
}

/** Full condition card with animated tabs. `compact` hides the header. */
export default function ConditionProfile({ profile, compact = false }) {
  const [tab, setTab] = useState("herbs");
  if (!profile) return null;
  const active = TABS.find((t) => t.key === tab);

  return (
    <div>
      {!compact && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-leaf-600">
            <HeartPulse size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Ayurvedic profile</span>
          </div>
          <h3 className="mt-1 font-display text-2xl font-bold text-leaf-900 dark:text-leaf-50">{profile.disease}</h3>
          <p className="mt-1 text-sm"><b>Symptoms:</b> {profile.symptoms}</p>
          <div className="mt-2"><DoshaChips doshas={profile.doshas} /></div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              tab === key ? "text-white" : "text-leaf-700 hover:bg-leaf-50 dark:text-leaf-200 dark:hover:bg-leaf-900"}`}>
            {tab === key && (
              <motion.span layoutId={`tab-bg-${profile.disease}`} className="absolute inset-0 rounded-full bg-leaf-600" />
            )}
            <Icon size={14} className="relative" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="space-y-3">
          {active.fields.filter(([, field]) => profile[field] && profile[field] !== "N/A").map(([title, field]) => (
            <div key={field} className="rounded-2xl bg-leaf-50 p-3 dark:bg-leaf-900/40">
              <p className="text-xs font-bold uppercase tracking-wider text-leaf-600 dark:text-leaf-300">{title}</p>
              <p className="mt-1 text-sm">{profile[field]}</p>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
