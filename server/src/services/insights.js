/**
 * insights.js - turns a user's report HISTORY into trends and personal insights.
 * Pure functions (no database), so they are easy to test.
 *
 * How "better" or "worse" is decided: we measure how far a value is OUTSIDE
 * its normal range (0 = inside the range). If that distance shrinks between
 * two reports, the parameter improved.
 */

/** 0 when inside the normal range, otherwise the relative gap (0.25 = 25 % outside). */
export function distanceFromNormal({ value, low, high }) {
  if (low != null && value < low) return (low - value) / low;
  if (high != null && value > high) return (value - high) / high;
  return 0;
}

/**
 * reports: [{ reportDate, tests: [...] }] (any order)
 * returns: { key: { name, unit, category, points: [{date, value, status, low, high}] } }
 */
export function buildTrends(reports) {
  const sorted = [...reports].sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));
  const trends = {};
  for (const report of sorted) {
    for (const t of report.tests ?? []) {
      trends[t.key] ??= { key: t.key, name: t.name, unit: t.unit, category: t.category, points: [] };
      trends[t.key].points.push({
        date: report.reportDate, reportId: report.id, value: t.value, status: t.status, low: t.low, high: t.high,
      });
    }
  }
  return trends;
}

const fmt = (n) => Number(n.toFixed(2)).toLocaleString("en-IN");

/** Plain-language insights from the trends, most important first. */
export function buildInsights(trends, latestReport) {
  const insights = [];

  for (const trend of Object.values(trends)) {
    const pts = trend.points;
    if (pts.length < 2) continue;
    const prev = pts.at(-2);
    const last = pts.at(-1);
    const before = distanceFromNormal(prev);
    const now = distanceFromNormal(last);
    const change = `${fmt(prev.value)} → ${fmt(last.value)} ${trend.unit}`;

    if (before > 0 && now === 0) {
      insights.push({ type: "improved", priority: 2, parameter: trend.name,
        message: `${trend.name} is back in the normal range (${change}). Well done!` });
    } else if (before === 0 && now > 0) {
      insights.push({ type: "worsened", priority: 0, parameter: trend.name,
        message: `${trend.name} has moved out of the normal range (${change}). Consider discussing it with your doctor.` });
    } else if (now > 0 && now < before - 0.02) {
      insights.push({ type: "improved", priority: 2, parameter: trend.name,
        message: `${trend.name} is improving (${change}) but is still ${last.status}.` });
    } else if (now > before + 0.02) {
      insights.push({ type: "worsened", priority: 1, parameter: trend.name,
        message: `${trend.name} is getting further from normal (${change}).` });
    }

    // Three or more readings rising/falling in a row
    if (pts.length >= 3) {
      const last3 = pts.slice(-3).map((p) => p.value);
      const rising = last3[0] < last3[1] && last3[1] < last3[2];
      const falling = last3[0] > last3[1] && last3[1] > last3[2];
      if ((rising || falling) && now > 0) {
        insights.push({ type: "pattern", priority: 1, parameter: trend.name,
          message: `${trend.name} has been ${rising ? "rising" : "falling"} across your last 3 reports.` });
      }
    }
  }

  if (latestReport) {
    const attention = (latestReport.tests ?? []).filter((t) => t.status !== "normal");
    insights.push(
      attention.length
        ? { type: "summary", priority: 3, message: `Your latest report has ${attention.length} value(s) that need attention.` }
        : { type: "summary", priority: 3, message: "All values in your latest report are in the normal range." },
    );
  }

  return insights.sort((a, b) => a.priority - b.priority);
}

/** Short text about the latest report, given to the chatbot as context. */
export function reportContext(report) {
  if (!report) return null;
  const abnormal = (report.tests ?? []).filter((t) => t.status !== "normal").slice(0, 15);
  if (!abnormal.length) return null;
  const range = (t) =>
    t.low != null && t.high != null ? `${t.low}-${t.high}` : t.high != null ? `below ${t.high}` : `above ${t.low}`;
  const date = new Date(report.reportDate).toISOString().slice(0, 10);
  const lines = abnormal.map((t) => `- ${t.name}: ${t.value} ${t.unit} (${t.status}; normal ${range(t)})`);
  const concerns = (report.concerns ?? []).map((c) => c.name).join(", ");
  return `Report date ${date}:\n${lines.join("\n")}${concerns ? `\nPossible concerns: ${concerns}` : ""}`;
}
