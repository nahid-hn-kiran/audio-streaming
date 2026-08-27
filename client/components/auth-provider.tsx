"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export type CurrentUser = { id: string; name: string; email: string; role: "USER" | "ADMIN"; emailVerified: boolean };
type AuthContextValue = { user: CurrentUser | null; status: "loading" | "authenticated" | "unauthenticated"; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const refresh = useCallback(async () => {
    try { const result = await apiFetch<{ user: CurrentUser | null }>("/api/me"); setUser(result.user); setStatus(result.user ? "authenticated" : "unauthenticated"); }
    catch (error) { if (error instanceof ApiError && error.status === 401) { setUser(null); setStatus("unauthenticated"); } else { setUser(null); setStatus("unauthenticated"); } }
  }, []);
  // Initial session hydration is an intentional external synchronization.
  useEffect(() => { void refresh(); }, [refresh]); // eslint-disable-line react-hooks/set-state-in-effect
  const logout = useCallback(async () => { await authClient.signOut(); setUser(null); setStatus("unauthenticated"); }, []);
  const value = useMemo(() => ({ user, status, refresh, logout }), [user, status, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used within AuthProvider"); return value; }
