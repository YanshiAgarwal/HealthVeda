import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { Logo, NAV_LINKS } from "./Navbar.jsx";

export default function Footer() {
  return (
    <footer className="no-print mt-20 border-t border-leaf-100 bg-white/60 dark:border-leaf-900 dark:bg-leaf-950/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm">
            Ancient Ayurvedic wisdom meets modern AI - understand your body, your reports and
            your natural path to balance.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-leaf-600">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex gap-3 rounded-2xl bg-saffron-50 p-4 text-sm text-saffron-700 dark:bg-saffron-700/10 dark:text-saffron-300">
          <ShieldAlert className="shrink-0" size={20} />
          <p>
            HealthVeda gives general wellness information only. It is not a substitute for a
            doctor. In an emergency call <b>112</b> or <b>108</b>.
          </p>
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} HealthVeda · Final Year Project
      </p>
    </footer>
  );
}
