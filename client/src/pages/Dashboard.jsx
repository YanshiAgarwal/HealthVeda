import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bot, ChevronRight, ClipboardList, FilePlus2, Info, Repeat, Sparkles,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { reports as reportsApi } from "../api/healthveda.js";
import { FullPageLoader } from "../components/auth/ProtectedRoute.jsx";
import ScoreRing from "../components/common/ScoreRing.jsx";
import TrendChart from "../components/dashboard/TrendChart.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const INSIGHT_STYLE = {
  improved: { icon: ArrowDownRight, cls: "bg-leaf-50 text-leaf-700 dark:bg-leaf-900/40 dark:text-leaf-200" },
  worsened: { icon: ArrowUpRight, cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  pattern: { icon: Repeat, cls: "bg-saffron-50 text-saffron-700 dark:bg-saffron-700/10 dark:text-saffron-300" },
  summary: { icon: Info, cls: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
};

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function EmptyState({ onDemo, busy }) {
  return (
    <div className="card mx-auto max-w-2xl text-center">
      <ClipboardList className="mx-auto text-leaf-400" size={48} />
      <h2 className="mt-4 font-display text-2xl font-bold text-leaf-900 dark:text-leaf-50">Your health history starts here</h2>
      <p className="mt-2">Upload your lab reports (PDF or photo). HealthVeda tracks every value over time and tells you what is improving.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/report" className="btn-primary"><FilePlus2 size={18} /> Upload my first report</Link>
        <button onClick={onDemo} disabled={busy} className="btn-secondary">
          <Sparkles size={18} /> {busy ? "Creating…" : "Load 3 demo reports"}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [trends, all] = await Promise.all([reportsApi.trends(), reportsApi.list()]);
      setData(trends);
      setList(all.reports);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  // Parameters with 2+ readings can be charted; abnormal ones first
  const chartable = useMemo(() => {
    if (!data) return [];
    return Object.values(data.trends)
      .filter((t) => t.points.length >= 2)
      .sort((a, b) => (a.points.at(-1).status === "normal") - (b.points.at(-1).status === "normal"));
  }, [data]);
  const current = chartable.find((t) => t.key === selected) ?? chartable[0];

  async function loadDemo() {
    setBusy(true);
    try {
      await reportsApi.demoHistory();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <FullPageLoader />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-saffron-500">My health dashboard</p>
          <h1 className="font-display text-4xl font-bold text-leaf-900 dark:text-leaf-50">Namaste, {user.name.split(" ")[0]} 🙏</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/report" className="btn-primary"><FilePlus2 size={18} /> Add report</Link>
          <Link to="/chat" className="btn-secondary"><Bot size={18} /> Ask Veda</Link>
        </div>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {data && data.reportCount === 0 && <EmptyState onDemo={loadDemo} busy={busy} />}

      {data && data.reportCount > 0 && (
        <>
          {/* Score + score history + insights */}
          <div className="grid gap-6 lg:grid-cols-[auto_1fr_1fr]">
            <div className="card flex flex-col items-center justify-center text-center">
              <ScoreRing score={data.latest.healthScore} label="latest score" />
              <p className="mt-3 text-sm">{fmtDate(data.latest.reportDate)}</p>
              <p className="text-xs text-slate-400">{data.reportCount} report(s) on file</p>
            </div>

            <div className="card">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-leaf-900 dark:text-leaf-50"><Activity size={18} /> Health score over time</h2>
              {data.scoreHistory.length < 2 ? (
                <p className="mt-6 text-sm">Add one more report to see how your score changes.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.scoreHistory.map((s) => ({ ...s, label: fmtDate(s.date) }))} margin={{ top: 10, right: 10, left: -25 }}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#37965b" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#37965b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a9a90" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#8a9a90" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: "none" }} />
                    <Area type="monotone" dataKey="score" stroke="#267847" strokeWidth={3} fill="url(#scoreFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-leaf-900 dark:text-leaf-50"><Sparkles size={18} /> Personal insights</h2>
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {data.insights.map((insight, i) => {
                  const style = INSIGHT_STYLE[insight.type] ?? INSIGHT_STYLE.summary;
                  return (
                    <motion.li key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className={`flex gap-2 rounded-2xl p-3 text-sm ${style.cls}`}>
                      <style.icon size={18} className="mt-0.5 shrink-0" /> {insight.message}
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Parameter trends */}
          <div className="card">
            <h2 className="font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">Parameter trends</h2>
            {chartable.length === 0 ? (
              <p className="mt-2 text-sm">Trends appear once the same test is in two or more reports.</p>
            ) : (
              <>
                <p className="text-sm">The green band is the normal range. Dots: green = normal, red = high, blue = low.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {chartable.map((t) => {
                    const status = t.points.at(-1).status;
                    return (
                      <button key={t.key} onClick={() => setSelected(t.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          current?.key === t.key ? "bg-leaf-600 text-white"
                            : "bg-leaf-50 text-leaf-700 hover:bg-leaf-100 dark:bg-leaf-900 dark:text-leaf-200"}`}>
                        {status !== "normal" && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />}
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                {current && (
                  <motion.div key={current.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                    <TrendChart trend={current} />
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* Report list */}
          <div className="card">
            <h2 className="mb-4 font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">My reports</h2>
            <ul className="divide-y divide-leaf-100 dark:divide-leaf-900">
              {list.map((r) => (
                <li key={r.id}>
                  <Link to={`/reports/${r.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl p-3 transition hover:bg-leaf-50 dark:hover:bg-leaf-900/40">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl font-display text-lg font-bold text-white ${
                      r.healthScore >= 80 ? "bg-leaf-600" : r.healthScore >= 60 ? "bg-saffron-500" : "bg-red-500"}`}>
                      {r.healthScore}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-leaf-900 dark:text-leaf-50">{r.title}</p>
                      <p className="text-xs text-slate-400">{fmtDate(r.reportDate)} · {r.testCount} values · {r.attentionCount} need attention</p>
                    </div>
                    <div className="hidden flex-wrap gap-1 md:flex">
                      {r.concerns.slice(0, 3).map((c) => <span key={c} className="chip bg-saffron-50 text-saffron-700 dark:bg-saffron-700/10 dark:text-saffron-300">{c}</span>)}
                    </div>
                    <ChevronRight size={18} className="text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
