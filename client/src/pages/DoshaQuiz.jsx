import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Apple, PersonStanding, RotateCcw, Sun, Wind } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { account } from "../api/healthveda.js";
import PageHeader from "../components/common/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { DOSHAS, QUESTIONS } from "../data/doshaQuiz.js";

const SAVE_KEY = "healthveda-dosha";

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

function Result({ scores, onRetake }) {
  const total = scores.vata + scores.pitta + scores.kapha;
  const data = Object.keys(DOSHAS).map((key) => ({
    key, name: DOSHAS[key].name, value: scores[key], color: DOSHAS[key].color,
  }));
  const top = [...data].sort((a, b) => b.value - a.value)[0];
  const dosha = DOSHAS[top.key];

  const tips = [
    { icon: Apple, title: "Diet", items: dosha.diet },
    { icon: Sun, title: "Lifestyle", items: dosha.lifestyle },
    { icon: PersonStanding, title: "Yoga", items: dosha.yoga },
  ];

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
      <div className="card grid items-center gap-6 md:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={60} outerRadius={100} paddingAngle={4} animationDuration={1200}>
                {data.map((d) => <Cell key={d.key} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${Math.round((v / total) * 100)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-saffron-500">Your dominant dosha</p>
          <h2 className="mt-1 font-display text-5xl font-bold" style={{ color: dosha.color }}>
            {dosha.emoji} {dosha.name}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{dosha.elements}</p>
          <p className="mt-4 leading-relaxed">{dosha.summary}</p>
          <div className="mt-4 space-y-2">
            {data.map((d) => (
              <div key={d.key} className="flex items-center gap-3 text-sm">
                <span className="w-12 font-semibold">{d.name}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-leaf-900">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: d.color }}
                    initial={{ width: 0 }} animate={{ width: `${(d.value / total) * 100}%` }} transition={{ duration: 1 }} />
                </div>
                <span className="w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tips.map((t, i) => (
          <motion.div key={t.title} className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-leaf-900 dark:text-leaf-50">
              <t.icon size={20} className="text-leaf-600" /> {t.title}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {t.items.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <button onClick={onRetake} className="btn-secondary"><RotateCcw size={18} /> Retake quiz</button>
      </div>
    </motion.div>
  );
}

export default function DoshaQuiz() {
  const [answers, setAnswers] = useState([]); // e.g. ["vata", "pitta", ...]
  const [saved, setSaved] = useState(loadSaved);
  const { user, setUser } = useAuth();
  const current = answers.length;

  function choose(dosha) {
    const next = [...answers, dosha];
    setAnswers(next);
    if (next.length === QUESTIONS.length) {
      const scores = { vata: 0, pitta: 0, kapha: 0 };
      next.forEach((d) => scores[d]++);
      setSaved(scores);
      // Logged in? Remember the dominant dosha in the user's profile
      if (user) {
        const dominant = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
        account.update({ dosha: dominant }).then((d) => setUser(d.user)).catch(() => {});
      }
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(scores));
      } catch {
        /* ignore */
      }
    }
  }

  function retake() {
    setAnswers([]);
    setSaved(null);
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeader icon={Wind} eyebrow="Prakriti Quiz" title="Discover your dosha"
        subtitle="Ayurveda says each of us is a unique mix of Vata, Pitta and Kapha. Answer 10 quick questions to find yours." />

      {saved ? (
        <Result scores={saved} onRetake={retake} />
      ) : (
        <div className="mx-auto max-w-2xl">
          {/* Progress */}
          <div className="mb-6">
            <div className="mb-2 flex justify-between text-sm">
              <span>Question {current + 1} of {QUESTIONS.length}</span>
              <span>{Math.round((current / QUESTIONS.length) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-leaf-100 dark:bg-leaf-900">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-saffron-400"
                animate={{ width: `${(current / QUESTIONS.length) * 100}%` }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={current} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }} className="card">
              <h2 className="font-display text-2xl font-bold text-leaf-900 dark:text-leaf-50">{QUESTIONS[current].question}</h2>
              <div className="mt-6 space-y-3">
                {Object.entries(QUESTIONS[current].options).map(([dosha, text]) => (
                  <motion.button key={dosha} onClick={() => choose(dosha)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full rounded-2xl border-2 border-leaf-100 p-4 text-left font-medium transition hover:border-leaf-500 hover:bg-leaf-50 dark:border-leaf-900 dark:hover:bg-leaf-900/50">
                    {text}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {current > 0 && (
            <button onClick={() => setAnswers(answers.slice(0, -1))} className="mt-4 flex items-center gap-1 text-sm text-leaf-600">
              <ArrowLeft size={16} /> Previous question
            </button>
          )}
        </div>
      )}
    </div>
  );
}
