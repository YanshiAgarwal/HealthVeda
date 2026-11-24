// Who is logged in? Any component can call useAuth() to find out.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { auth, setSessionExpiredHandler } from "../api/healthveda.js";

const AuthContext = createContext(null);

// Private data kept in this browser - wiped on logout
const PRIVATE_STORAGE_KEYS = ["healthveda-chat"];
function clearPrivateBrowserData() {
  try {
    PRIVATE_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // checking the session on page load

  useEffect(() => {
    auth.me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await auth.login(email, password);
    clearPrivateBrowserData();
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await auth.register(name, email, password);
    clearPrivateBrowserData();
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async ({ everywhere = false } = {}) => {
    try {
      await (everywhere ? auth.logoutAll() : auth.logout());
    } finally {
      clearPrivateBrowserData();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
