import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/endpoints.js";
import { getCsrfToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      setUser(null); // 401 means signed out. Other errors also leave the user signed out.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getCsrfToken()
      .catch(() => {})
      .finally(refresh);
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, setUser, refresh, logout }), [user, loading, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
