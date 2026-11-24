import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, History, KeyRound, LogOut, Monitor, ShieldCheck, Trash2, UserRound } from "lucide-react";

import { account } from "../api/healthveda.js";
import PageHeader from "../components/common/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const ACTION_LABEL = {
  "auth.register": "Account created", "auth.login": "Logged in", "auth.login_failed": "Failed login attempt",
  "auth.locked": "Account locked (too many attempts)", "auth.logout": "Logged out", "auth.logout_all": "Logged out everywhere",
  "auth.refresh_reuse": "Suspicious session reuse blocked", "user.update": "Profile updated",
  "user.password_change": "Password changed", "user.export": "Data exported", "report.create": "Report added",
  "report.view": "Report viewed", "report.update": "Report edited", "report.delete": "Report deleted",
};

function Section({ icon: Icon, title, children, danger }) {
  return (
    <section className={`card ${danger ? "border-red-200 dark:border-red-900" : ""}`}>
      <h2 className={`mb-4 flex items-center gap-2 font-display text-xl font-bold ${danger ? "text-red-600" : "text-leaf-900 dark:text-leaf-50"}`}>
        <Icon size={20} /> {title}
      </h2>
      {children}
    </section>
  );
}

function Message({ msg }) {
  if (!msg) return null;
  return <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-leaf-600" : "text-red-500"}`}>{msg.text}</p>;
}

const device = (ua = "") =>
  /mobile|android|iphone/i.test(ua) ? "Phone" : /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome"
    : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Browser";

export default function Account() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [profileMsg, setProfileMsg] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [del, setDel] = useState({ password: "", confirm: "" });
  const [delMsg, setDelMsg] = useState(null);

  useEffect(() => {
    account.sessions().then((d) => setSessions(d.sessions)).catch(() => {});
    account.activity().then((d) => setActivity(d.activity)).catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const { user: updated } = await account.update({ name: name.trim() });
      setUser(updated);
      setProfileMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setProfileMsg({ ok: false, text: err.message });
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      await account.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "" });
      setPwMsg({ ok: true, text: "Password changed. Other devices have been logged out." });
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    }
  }

  async function exportData() {
    const data = await account.exportData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "healthveda-my-data.json" });
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount(e) {
    e.preventDefault();
    try {
      await account.remove(del.password);
      await logout().catch(() => {});
      navigate("/", { replace: true });
    } catch (err) {
      setDelMsg({ ok: false, text: err.message });
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeader icon={ShieldCheck} eyebrow="Account & privacy" title="Your account"
        subtitle="Manage your profile, security and your medical data. You are always in control." />

      <div className="space-y-6">
        <Section icon={UserRound} title="Profile">
          <form onSubmit={saveProfile} className="flex flex-wrap items-end gap-3">
            <label className="flex-1 text-sm font-semibold">Name
              <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required className="input mt-1" />
            </label>
            <label className="flex-1 text-sm font-semibold">Email
              <input value={user.email} disabled className="input mt-1 opacity-60" />
            </label>
            <button className="btn-primary">Save</button>
          </form>
          {user.dosha && <p className="mt-3 text-sm">Your dosha (from the quiz): <b className="capitalize">{user.dosha}</b></p>}
          <Message msg={profileMsg} />
        </Section>

        <Section icon={KeyRound} title="Change password">
          <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">Current password
              <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" className="input mt-1" />
            </label>
            <label className="text-sm font-semibold">New password
              <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} maxLength={128} autoComplete="new-password" className="input mt-1" />
            </label>
            <button className="btn-primary">Update</button>
          </form>
          <Message msg={pwMsg} />
        </Section>

        <Section icon={Monitor} title="Where you're logged in">
          <ul className="space-y-2">
            {sessions.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-leaf-50 p-3 text-sm dark:bg-leaf-900/40">
                <Monitor size={18} className="text-leaf-600" />
                <span className="flex-1">{device(s.userAgent)} · {s.ip} · since {new Date(s.createdAt).toLocaleString("en-IN")}</span>
                {i === 0 && <span className="chip bg-leaf-600 text-white">latest</span>}
              </li>
            ))}
          </ul>
          <button onClick={async () => { await logout({ everywhere: true }); navigate("/login"); }} className="btn-secondary mt-4">
            <LogOut size={18} /> Log out of all devices
          </button>
        </Section>

        <Section icon={History} title="Security activity">
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {activity.map((a, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-leaf-100 py-2 dark:border-leaf-900">
                <span className={a.action.includes("failed") || a.action.includes("reuse") || a.action.includes("locked") ? "text-red-500" : ""}>
                  {ACTION_LABEL[a.action] ?? a.action}
                </span>
                <span className="text-xs text-slate-400">{new Date(a.at).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Download} title="Your data">
          <p className="text-sm">Download everything HealthVeda stores about you (profile and all reports) as a JSON file.</p>
          <button onClick={exportData} className="btn-secondary mt-4"><Download size={18} /> Export my data</button>
        </Section>

        <Section icon={Trash2} title="Delete account" danger>
          <p className="text-sm">This permanently deletes your account and <b>all</b> your reports. It cannot be undone.</p>
          <form onSubmit={deleteAccount} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">Password
              <input type="password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} required className="input mt-1" />
            </label>
            <label className="text-sm font-semibold">Type DELETE to confirm
              <input value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value })} required className="input mt-1" />
            </label>
            <button disabled={del.confirm !== "DELETE"} className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-40">
              Delete forever
            </button>
          </form>
          <Message msg={delMsg} />
        </Section>
      </div>
    </div>
  );
}
