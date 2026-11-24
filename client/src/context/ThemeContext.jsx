// Light / dark mode for the whole app. Remembers the choice in the browser.
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

function initialTheme() {
  try {
    const saved = localStorage.getItem("healthveda-theme");
    if (saved) return saved;
  } catch {
    /* storage blocked - fall through */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("healthveda-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
