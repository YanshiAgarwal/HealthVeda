import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Stacked bars: how many values are normal vs need attention, per body system. */
export default function CategoryChart({ categories }) {
  const data = categories.map((c) => ({
    name: c.category,
    Normal: c.normal,
    "Needs attention": c.total - c.normal,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#8dcea233" vertical={false} />
        <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#8a9a90" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#8a9a90" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#37965b11" }}
          contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 10px 30px -10px rgba(0,0,0,.2)" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Normal" stackId="a" fill="#37965b" radius={[0, 0, 6, 6]} />
        <Bar dataKey="Needs attention" stackId="a" fill="#fd7c10" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
