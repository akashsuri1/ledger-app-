import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../api/authApi";
import type { BootstrapDto, PreferencePatch, PreferencesDto } from "../api/types";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bootstrap, setBootstrap] = useState<BootstrapDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshBootstrap = useCallback(async () => {
    try {
      const value = await authApi.bootstrap();
      setBootstrap(value);
      setError(null);
      return value;
    } catch (cause) {
      if (cause instanceof Error && "status" in cause && cause.status === 401) {
        setBootstrap(null);
        setError(null);
        return null;
      }
      setError(cause instanceof Error ? cause.message : "Unable to load your LedgerFlow account.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void refreshBootstrap()); }, [refreshBootstrap]);
  useEffect(() => {
    const signedOut = () => { setBootstrap(null); setLoading(false); };
    window.addEventListener("ledgerflow:auth-required", signedOut);
    return () => window.removeEventListener("ledgerflow:auth-required", signedOut);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try { await authApi.login({ email, password }); await refreshBootstrap(); }
    catch (cause) { setLoading(false); throw cause; }
  }, [refreshBootstrap]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await authApi.register({ name, email, password });
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setBootstrap(null);
  }, []);

  const updatePreferences = useCallback(async (patch: PreferencePatch): Promise<PreferencesDto> => {
    const value = await authApi.updatePreferences(patch);
    setBootstrap((current) => current ? { ...current, preferences: value } : current);
    return value;
  }, []);

  const value = useMemo(() => ({
    user: bootstrap?.user ?? null,
    companies: bootstrap?.companies ?? [],
    preferences: bootstrap?.preferences ?? null,
    loading,
    error,
    login,
    register,
    logout,
    forgotPassword: authApi.forgotPassword,
    resetPassword: authApi.resetPassword,
    refreshBootstrap,
    updatePreferences,
  }), [bootstrap, error, loading, login, logout, refreshBootstrap, register, updatePreferences]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
