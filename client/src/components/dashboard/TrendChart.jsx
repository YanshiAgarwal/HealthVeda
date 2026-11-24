import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const shortDate = (d) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const STATUS_COLOR = { normal: "#37965b", high: "#dc2626", low: "#0ea5e9" };

/** One parameter over time. The green band is its normal range. */
export default function TrendChart({ trend }) {
  const data = trend.points.map((p) => ({ ...p, label: shortDate(p.date) }));
  const latest = trend.points.at(-1);
  const values = data.map((d) => d.value);
  const lo = latest.low ?? Math.min(...values) * 0.8;
  const hi = latest.high ?? Math.max(...values) * 1.2;
  const domain = [Math.floor(Math.min(lo, ...values) * 0.9), Math.ceil(Math.max(hi, ...values) * 1.1)];

  const Dot = ({ cx, cy, payload }) => (
    <circle cx={cx} cy={cy} r={6} fill={STATUS_COLOR[payload.status] || "#37965b"} stroke="#fff" strokeWidth={2} />
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#8dcea233" vertical={false} />
        <ReferenceArea y1={lo} y2={hi} fill="#37965b" fillOpacity={0.12} ifOverflow="extendDomain" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8a9a90" }} axisLine={false} tickLine={false} />
        <YAxis domain={domain} tick={{ fontSize: 12, fill: "#8a9a90" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, _n, item) => [`${v} ${trend.unit} (${item.payload.status})`, trend.name]}
          contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(0,0,0,.2)" }}
        />
        <Line type="monotone" dataKey="value" stroke="#267847" strokeWidth={3} dot={<Dot />} activeDot={{ r: 8 }} animationDuration={1000} />
      </LineChart>
    </ResponsiveContainer>
  );
}
