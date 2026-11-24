import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Check, Eye, EyeOff, Leaf, Lock, ShieldCheck, X } from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";

// Same rules as the server (server/src/utils/passwordPolicy.js)
const PASSWORD_RULES = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[a-z]/i.test(p), label: "Contains a letter" },
  { test: (p) => /\d/.test(p), label: "Contains a number" },
];

function PasswordInput({ value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        className="input pr-12" required maxLength={128} autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-leaf-600">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/** One component for both /login and /register. */
export default function AuthPage({ mode = "login" }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goTo = location.state?.from || "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={goTo} replace />;

  const passwordOk = PASSWORD_RULES.every((r) => r.test(password));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      navigate(goTo, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
        <h1 className="font-display text-5xl font-bold leading-tight text-leaf-900 dark:text-leaf-50">
          Your health story,<br /><span className="text-saffron-500">safe in one place.</span>
        </h1>
        <ul className="mt-8 space-y-4">
          {[
            [Lock, "Reports encrypted with AES-256 before they are stored"],
            [ShieldCheck, "Only you can see your medical history"],
            [Leaf, "Ayurvedic guidance that knows your latest report"],
          ].map(([Icon, text]) => (
            <li key={text} className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-100 text-leaf-700 dark:bg-leaf-900 dark:text-leaf-200"><Icon size={20} /></span>
              {text}
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="card mx-auto w-full max-w-md space-y-4">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-leaf-900 dark:text-leaf-50">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm">{isRegister ? "Start tracking your health in minutes." : "Log in to see your health dashboard."}</p>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle size={18} className="shrink-0" /> {error}
          </div>
        )}

        {isRegister && (
          <label className="block text-sm font-semibold">Full name
            <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" required
              minLength={2} maxLength={80} autoComplete="name" />
          </label>
        )}
        <label className="block text-sm font-semibold">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1"
            required maxLength={254} autoComplete="email" />
        </label>
        <label className="block text-sm font-semibold">Password
          <div className="mt-1">
            <PasswordInput value={password} onChange={setPassword}
              autoComplete={isRegister ? "new-password" : "current-password"} />
          </div>
        </label>

        {isRegister && (
          <ul className="space-y-1 text-xs">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.label} className={`flex items-center gap-1 ${ok ? "text-leaf-600" : "text-slate-400"}`}>
                  {ok ? <Check size={14} /> : <X size={14} />} {rule.label}
                </li>
              );
            })}
          </ul>
        )}

        <button type="submit" disabled={busy || (isRegister && !passwordOk)} className="btn-primary w-full">
          {busy ? "Please wait…" : isRegister ? "Create account" : "Log in"}
        </button>

        <p className="text-center text-sm">
          {isRegister ? "Already have an account? " : "New to HealthVeda? "}
          <Link to={isRegister ? "/login" : "/register"} state={location.state} className="font-semibold text-leaf-600 hover:underline">
            {isRegister ? "Log in" : "Create an account"}
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
