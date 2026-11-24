import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Droplets, HeartPulse, Scale, Sunrise } from "lucide-react";

import PageHeader from "../components/common/PageHeader.jsx";
import ScoreRing from "../components/common/ScoreRing.jsx";

// ── Small helper: state that is remembered for TODAY only ────────────────
function useDailyState(key, initial) {
  const today = new Date().toDateString();
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved?.date === today ? saved.value : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ date: today, value }));
    } catch {
      /* ignore */
    }
  }, [key, today, value]);
  return [value, setValue];
}

// ── BMI calculator ───────────────────────────────────────────────────────
const BMI_BANDS = [
  { max: 18.5, label: "Underweight", color: "#38bdf8", tip: "Add nourishing foods like ghee, nuts, dates and warm milk (Vata-balancing)." },
  { max: 25, label: "Healthy", color: "#37965b", tip: "Great! Keep up regular meals, movement and good sleep." },
  { max: 30, label: "Overweight", color: "#fd7c10", tip: "Favour light, warm, spiced meals; walk 30-45 minutes daily (Kapha-balancing)." },
  { max: Infinity, label: "Obese", color: "#dc2626", tip: "Talk to a doctor about a safe plan. Try Surya Namaskar and avoid heavy, sweet food." },
];

function BmiCalculator() {
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(62);
  const bmi = weight / (height / 100) ** 2;
  const band = BMI_BANDS.find((b) => bmi < b.max);
  const markerPct = Math.min(100, Math.max(0, ((bmi - 12) / (40 - 12)) * 100));

  return (
    <div className="card">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">
        <Scale className="text-leaf-600" /> BMI calculator
      </h2>
      {[["Height", height, setHeight, 120, 210, "cm"], ["Weight", weight, setWeight, 30, 150, "kg"]].map(
        ([label, value, setter, min, max, unit]) => (
          <label key={label} className="mt-5 block">
            <div className="flex justify-between text-sm font-semibold">
              <span>{label}</span><span>{value} {unit}</span>
            </div>
            <input type="range" min={min} max={max} value={value} onChange={(e) => setter(Number(e.target.value))}
              className="mt-2 w-full accent-leaf-600" />
          </label>
        ),
      )}

      <div className="mt-6 text-center">
        <motion.p key={bmi.toFixed(1)} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          className="font-display text-5xl font-bold" style={{ color: band.color }}>
          {bmi.toFixed(1)}
        </motion.p>
        <p className="font-semibold" style={{ color: band.color }}>{band.label}</p>
      </div>
      <div className="relative mt-4 h-3 rounded-full bg-gradient-to-r from-sky-400 via-leaf-500 via-40% to-red-500">
        <motion.div animate={{ left: `${markerPct}%` }}
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-800 shadow" />
      </div>
      <p className="mt-4 rounded-2xl bg-leaf-50 p-3 text-sm dark:bg-leaf-900/40">{band.tip}</p>
    </div>
  );
}

// ── Water tracker ────────────────────────────────────────────────────────
function WaterTracker() {
  const goal = 8;
  const [glasses, setGlasses] = useDailyState("healthveda-water", 0);

  return (
    <div className="card">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">
        <Droplets className="text-sky-500" /> Water today
      </h2>
      <p className="mt-1 text-sm">Tap a glass when you drink one. Ayurveda suggests warm water, sipped through the day.</p>
      <div className="mt-6 grid grid-cols-4 gap-3">
        {Array.from({ length: goal }, (_, i) => (
          <motion.button key={i} whileTap={{ scale: 0.85 }} onClick={() => setGlasses(i < glasses ? i : i + 1)}
            aria-label={`Glass ${i + 1}`}
            className="relative h-20 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-sky-200 dark:border-sky-800">
            <motion.div className="absolute bottom-0 w-full bg-gradient-to-t from-sky-500 to-sky-300"
              animate={{ height: i < glasses ? "85%" : "0%" }} transition={{ type: "spring", stiffness: 120 }} />
          </motion.button>
        ))}
      </div>
      <p className="mt-4 text-center font-semibold">
        {glasses} / {goal} glasses {glasses >= goal && "🎉 Goal reached!"}
      </p>
    </div>
  );
}

// ── Dinacharya (Ayurvedic daily routine) ─────────────────────────────────
const ROUTINE = [
  "Wake up before sunrise (Brahma Muhurta)",
  "Drink a glass of warm water",
  "Tongue scraping & oil pulling",
  "15 minutes of yoga or Surya Namaskar",
  "5 minutes of pranayama / meditation",
  "Eat the biggest meal at lunch time",
  "Short walk after meals",
  "Light dinner before 8 pm",
  "Screens off 1 hour before bed",
  "Sleep by 10 pm",
];

function Dinacharya() {
  const [done, setDone] = useDailyState("healthveda-routine", []);
  const percent = Math.round((done.length / ROUTINE.length) * 100);
  const toggle = (item) => setDone(done.includes(item) ? done.filter((d) => d !== item) : [...done, item]);

  return (
    <div className="card lg:col-span-2">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex-1">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">
            <Sunrise className="text-saffron-500" /> Dinacharya - daily routine
          </h2>
          <p className="mt-1 text-sm">
            Ayurveda teaches that a regular daily rhythm keeps all three doshas in balance. Your
            checklist resets every morning.
          </p>
        </div>
        <ScoreRing score={percent} size={120} label="done" />
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {ROUTINE.map((item) => {
          const checked = done.includes(item);
          return (
            <motion.button key={item} onClick={() => toggle(item)} whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left text-sm transition ${
                checked ? "border-leaf-500 bg-leaf-50 dark:bg-leaf-900/50" : "border-leaf-100 hover:border-leaf-300 dark:border-leaf-900"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition ${checked ? "bg-leaf-600 text-white" : "border-2 border-leaf-300"}`}>
                {checked && <Check size={14} />}
              </span>
              <span className={checked ? "line-through opacity-60" : ""}>{item}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default function Wellness() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader icon={HeartPulse} eyebrow="Wellness Tools" title="Small habits, big balance"
        subtitle="Quick tools to track the basics of a healthy Ayurvedic lifestyle. Everything stays in your browser." />
      <div className="grid gap-6 lg:grid-cols-2">
        <BmiCalculator />
        <WaterTracker />
        <Dinacharya />
      </div>
    </div>
  );
}
