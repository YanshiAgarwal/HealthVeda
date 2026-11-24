import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutDashboard, Leaf, LogOut, Menu, Moon, Settings, Sun, X } from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";

export const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", private: true },
  { to: "/chat", label: "Veda Assistant" },
  { to: "/report", label: "Report Analyzer" },
  { to: "/dosha", label: "Dosha Quiz" },
  { to: "/remedies", label: "Remedies" },
  { to: "/wellness", label: "Wellness" },
];

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="HealthVeda home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-leaf-600 text-white shadow-soft">
        <Leaf size={20} />
      </span>
      <span className="font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">
        Health<span className="text-saffron-500">Veda</span>
      </span>
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-leaf-50 dark:hover:bg-leaf-900";

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1 rounded-full p-1 pr-2 hover:bg-leaf-100 dark:hover:bg-leaf-900">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-saffron-500 text-xs font-bold text-white">{initials}</span>
        <ChevronDown size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-56 rounded-2xl border border-leaf-100 bg-white p-2 shadow-soft dark:border-leaf-900 dark:bg-night">
            <p className="truncate px-3 py-2 text-xs text-slate-400">{user.email}</p>
            <Link to="/dashboard" onClick={() => setOpen(false)} className={item}><LayoutDashboard size={16} /> Dashboard</Link>
            <Link to="/account" onClick={() => setOpen(false)} className={item}><Settings size={16} /> Account & privacy</Link>
            <button onClick={async () => { setOpen(false); await logout(); navigate("/"); }} className={`${item} text-red-600`}>
              <LogOut size={16} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const links = NAV_LINKS.filter((l) => !l.private || user);

  const linkClass = ({ isActive }) =>
    `rounded-full px-3 py-2 text-sm font-semibold transition xl:px-4 ${
      isActive ? "bg-leaf-600 text-white" : "text-leaf-800 hover:bg-leaf-100 dark:text-leaf-100 dark:hover:bg-leaf-900"
    }`;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-leaf-100/60 bg-cream/80 backdrop-blur-lg dark:border-leaf-900 dark:bg-night/80">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3">
        <Logo />

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => <NavLink key={link.to} to={link.to} className={linkClass}>{link.label}</NavLink>)}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} aria-label="Toggle dark mode"
            className="grid h-10 w-10 place-items-center rounded-full text-leaf-700 transition hover:bg-leaf-100 dark:text-leaf-200 dark:hover:bg-leaf-900">
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {!loading && (user ? <UserMenu /> : (
            <Link to="/login" className="btn-primary px-5 py-2 text-sm">Log in</Link>
          ))}
          <button onClick={() => setOpen(!open)} aria-label="Open menu"
            className="grid h-10 w-10 place-items-center rounded-full text-leaf-700 hover:bg-leaf-100 dark:text-leaf-200 dark:hover:bg-leaf-900 lg:hidden">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden lg:hidden">
            <div className="flex flex-col gap-1 px-4 pb-4">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={linkClass} onClick={() => setOpen(false)}>{link.label}</NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
