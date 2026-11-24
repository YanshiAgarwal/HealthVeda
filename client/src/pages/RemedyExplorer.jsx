import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Search, X } from "lucide-react";

import { getCondition, searchConditions } from "../api/healthveda.js";
import ConditionProfile, { DoshaChips } from "../components/common/ConditionProfile.jsx";
import PageHeader from "../components/common/PageHeader.jsx";

const QUICK_SEARCHES = ["Cough", "Diabetes", "Acidity", "Migraine", "Arthritis", "Anxiety", "Asthma"];
const DOSHA_FILTERS = ["All", "Vata", "Pitta", "Kapha"];

function DetailsModal({ name, onClose }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    getCondition(name).then(setProfile).catch(() => setProfile(undefined));
  }, [name]);

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="card relative max-h-[85vh] w-full max-w-xl overflow-y-auto bg-white dark:bg-night"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 hover:bg-leaf-50 dark:hover:bg-leaf-900" aria-label="Close">
          <X size={20} />
        </button>
        {profile === null && <p>Loading…</p>}
        {profile === undefined && <p>Could not load this condition.</p>}
        {profile && <ConditionProfile profile={profile} />}
      </motion.div>
    </motion.div>
  );
}

export default function RemedyExplorer() {
  const [query, setQuery] = useState("");
  const [dosha, setDosha] = useState("All");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  // Search 300 ms after the user stops typing ("debounce")
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      searchConditions(query)
        .then((data) => { setItems(data); setError(""); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const visible = dosha === "All" ? items : items.filter((i) => i.doshas.toLowerCase().includes(dosha.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <PageHeader icon={BookOpen} eyebrow="Remedy Explorer" title="The Ayurvedic library"
        subtitle="Search 400+ conditions by name, symptom or herb - and open any card for its full Ayurvedic care plan." />

      <div className="mx-auto max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-leaf-400" size={20} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="input py-4 pl-12 text-lg"
            placeholder="Try 'headache', 'tulsi' or 'diabetes'…" />
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {QUICK_SEARCHES.map((q) => (
            <button key={q} onClick={() => setQuery(q)} className="chip bg-white px-3 py-1.5 text-leaf-700 shadow-soft hover:bg-leaf-50 dark:bg-leaf-950 dark:text-leaf-200">
              {q}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-center gap-1">
          {DOSHA_FILTERS.map((d) => (
            <button key={d} onClick={() => setDosha(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${dosha === d ? "bg-leaf-600 text-white" : "text-leaf-700 hover:bg-leaf-100 dark:text-leaf-200 dark:hover:bg-leaf-900"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-8 text-center text-red-500">{error}</p>}
      {!loading && !error && visible.length === 0 && <p className="mt-8 text-center">No conditions found. Try another word.</p>}

      <motion.div layout className={`mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition ${loading ? "opacity-50" : ""}`}>
        <AnimatePresence>
          {visible.map((item) => (
            <motion.button key={item.disease} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }} whileHover={{ y: -4 }} onClick={() => setSelected(item.disease)}
              className="card text-left">
              <h3 className="font-display text-lg font-bold text-leaf-900 dark:text-leaf-50">{item.disease}</h3>
              <p className="mt-1 line-clamp-2 text-sm">{item.symptoms}</p>
              <p className="mt-3 text-xs"><b className="text-leaf-600">Herbs:</b> {item.herbs}</p>
              <div className="mt-3"><DoshaChips doshas={item.doshas} /></div>
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selected && <DetailsModal name={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
