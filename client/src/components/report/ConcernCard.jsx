import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Leaf } from "lucide-react";

import ConditionProfile, { DoshaChips } from "../common/ConditionProfile.jsx";

/** One health concern from the report, expandable to show Ayurvedic care. */
export default function ConcernCard({ concern, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const serious = concern.severity === "abnormal";
  const profile = concern.ayurveda;

  return (
    <div className={`overflow-hidden rounded-2xl border ${serious ? "border-red-200 dark:border-red-900" : "border-saffron-200 dark:border-saffron-700/40"} bg-white dark:bg-leaf-950/60`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={`h-3 w-3 shrink-0 rounded-full ${serious ? "bg-red-500" : "bg-saffron-400"}`} />
        <div className="flex-1">
          <p className="font-semibold text-leaf-900 dark:text-leaf-50">{concern.name}</p>
          <p className="text-xs text-slate-400">{concern.evidence.join(" · ")}</p>
        </div>
        {profile && <span className="chip hidden bg-leaf-100 text-leaf-700 sm:inline-flex"><Leaf size={12} /> Ayurvedic care</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={20} /></motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-leaf-100 p-4 dark:border-leaf-900">
              {profile ? (
                <>
                  <p className="mb-2 text-sm">
                    In Ayurveda this relates to <b>{profile.disease}</b>, linked to
                  </p>
                  <div className="mb-4"><DoshaChips doshas={profile.doshas} /></div>
                  <ConditionProfile profile={profile} compact />
                </>
              ) : (
                <p className="text-sm">
                  No specific Ayurvedic entry for this concern in our dataset. Discuss it with your
                  doctor - sunlight, a balanced diet and regular follow-up tests usually help.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
