import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, BookOpen, Bot, Droplets, FileText, Languages, LineChart, Mic, ScanSearch, Sparkles, Wind,
} from "lucide-react";

import { getStatus } from "../api/healthveda.js";

const FEATURES = [
  { to: "/chat", icon: Bot, title: "Veda Assistant", color: "from-leaf-500 to-leaf-700",
    text: "Describe your symptoms - by typing or speaking in 10 Indian languages - and get Ayurvedic guidance from our RAG-powered AI." },
  { to: "/report", icon: FileText, title: "Report Analyzer", color: "from-saffron-400 to-saffron-600",
    text: "Upload a PDF or even a phone photo of your report (OCR). See every value on a colour-coded range bar, a health score, and Ayurvedic care for each concern." },
  { to: "/dashboard", icon: LineChart, title: "Health Dashboard", color: "from-violet-400 to-purple-600",
    text: "Your encrypted medical history: track glucose, cholesterol, BP and more across reports, with personal insights on what is improving." },
  { to: "/dosha", icon: Wind, title: "Dosha Quiz", color: "from-sky-400 to-indigo-500",
    text: "Discover your Prakriti - Vata, Pitta or Kapha - in 10 questions, with diet, lifestyle and yoga tips for your body type." },
  { to: "/remedies", icon: BookOpen, title: "Remedy Explorer", color: "from-emerald-400 to-teal-600",
    text: "Browse 400+ conditions with their herbs, home formulations, yoga and prevention advice." },
  { to: "/wellness", icon: Droplets, title: "Wellness Tools", color: "from-pink-400 to-rose-500",
    text: "BMI calculator, water tracker and a daily Dinacharya routine checklist." },
];

const STEPS = [
  { icon: Mic, title: "Tell or upload", text: "Speak your symptoms or upload your lab report." },
  { icon: ScanSearch, title: "AI understands", text: "Hybrid search over an Ayurveda dataset + book finds the right knowledge." },
  { icon: Sparkles, title: "Get guidance", text: "Simple explanations, herbs, diet and yoga - plus when to see a doctor." },
];

function StatusPill() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    getStatus().then(setStatus).catch(() => setStatus({ offline: true }));
  }, []);
  if (!status) return null;
  const online = !status.offline && status.ai?.online;
  const label = status.offline ? "Server offline"
    : !status.ai?.online ? "AI service offline"
    : status.ai.aiEnabled ? "AI online" : "Running in offline mode";
  return (
    <span className="chip bg-white/80 text-leaf-700 shadow-soft dark:bg-leaf-900 dark:text-leaf-200">
      <span className={`h-2 w-2 rounded-full ${online ? "animate-pulse bg-leaf-500" : "bg-red-500"}`} />
      {label}
    </span>
  );
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 md:pt-24">
        <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-leaf-300/40 blur-3xl dark:bg-leaf-700/30" />
        <div className="pointer-events-none absolute -right-10 top-32 h-72 w-72 rounded-full bg-saffron-300/40 blur-3xl dark:bg-saffron-600/20" />

        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <StatusPill />
            <h1 className="mt-5 font-display text-5xl font-bold leading-tight text-leaf-900 dark:text-leaf-50 md:text-6xl">
              Ancient wisdom,
              <br />
              <span className="bg-gradient-to-r from-leaf-600 to-saffron-500 bg-clip-text text-transparent">
                modern intelligence.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg">
              HealthVeda combines Ayurveda with AI. Chat with an Ayurvedic assistant in your own
              language, understand your lab reports in plain words, and discover natural ways to
              stay in balance.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/chat" className="btn-primary">
                Talk to Veda Assistant <ArrowRight size={18} />
              </Link>
              <Link to="/report" className="btn-secondary">
                Analyze a report
              </Link>
            </div>
          </motion.div>

          {/* Floating preview cards */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }} className="relative mx-auto h-80 w-full max-w-md">
            <motion.div animate={{ y: [0, -12, 0] }} transition={{ repeat: Infinity, duration: 5 }}
              className="card absolute left-0 top-0 w-72">
              <p className="text-xs font-bold uppercase text-leaf-600">You</p>
              <p className="mt-1">I have a dry cough and sore throat 🤒</p>
              <p className="mt-3 text-xs font-bold uppercase text-saffron-500">HealthVeda</p>
              <p className="mt-1 text-sm">Try warm turmeric milk with ginger at bedtime, and tulsi tea twice a day…</p>
            </motion.div>
            <motion.div animate={{ y: [0, 12, 0] }} transition={{ repeat: Infinity, duration: 6 }}
              className="card absolute bottom-0 right-0 w-64">
              <p className="text-xs font-bold uppercase text-slate-400">Fasting glucose</p>
              <p className="font-display text-3xl font-bold text-saffron-500">118 <span className="text-sm">mg/dL</span></p>
              <div className="mt-3 h-2 rounded-full bg-gradient-to-r from-sky-300 via-leaf-400 to-red-400" />
              <p className="mt-2 text-xs">Slightly high → Ayurvedic care: Jamun, Gudmar, Fenugreek</p>
            </motion.div>
            <motion.div animate={{ rotate: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 7 }}
              className="absolute right-6 top-6 grid h-16 w-16 place-items-center rounded-2xl bg-saffron-500 text-white shadow-soft">
              <Languages size={30} />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="section-title text-center">Everything for your wellbeing</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.to} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <Link to={f.to} className="card group block h-full transition hover:-translate-y-1">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${f.color} text-white`}>
                  <f.icon size={24} />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">{f.title}</h3>
                <p className="mt-2 text-sm">{f.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-leaf-600 transition group-hover:gap-2">
                  Open <ArrowRight size={16} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="section-title text-center">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="text-center">
              <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-600 text-white shadow-soft">
                <s.icon size={28} />
                <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-saffron-500 text-xs font-bold">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-leaf-900 dark:text-leaf-50">{s.title}</h3>
              <p className="mt-1 text-sm">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-2 gap-4 rounded-3xl bg-gradient-to-r from-leaf-700 to-leaf-900 p-8 text-center text-white md:grid-cols-4">
          {[["400+", "Ayurvedic conditions"], ["23", "Lab markers checked"], ["10", "Chat languages"], ["3", "Doshas explained"]].map(
            ([n, label]) => (
              <div key={label}>
                <p className="font-display text-4xl font-bold text-saffron-300">{n}</p>
                <p className="text-sm text-leaf-100">{label}</p>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
