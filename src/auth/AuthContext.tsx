import { createContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import * as authService from "./auth-service";
import { isSupabaseConfigured } from "../config";
import { setCurrentUserId } from "../sync/sync-engine";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const defaultState: AuthState = {
  user: null,
  session: null,
  loading: true,
  configured: false,
  signUp: async () => ({ error: "Not initialized" }),
  signIn: async () => ({ error: "Not initialized" }),
  signOut: async () => ({ error: "Not initialized" }),
};

export const AuthContext = createContext<AuthState>(defaultState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    authService
      .getSession()
      .then(({ session: s }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user?.id) {
          setCurrentUserId(s.user.id);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    const unsubscribe = authService.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setCurrentUserId(s?.user?.id ?? null);
      // Session is often delivered here (e.g. INITIAL_SESSION) before getSession() settles or if it hangs.
      setLoading(false);
    });

    return () => unsubscribe?.();
  }, []);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    const result = await authService.signUp(email, password);
    if (!result.error && result.user) {
      setUser(result.user);
      setSession(result.session);
    }
    return { error: result.error };
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const result = await authService.signIn(email, password);
    if (!result.error && result.user) {
      setUser(result.user);
      setSession(result.session);
    }
    return { error: result.error };
  }, []);

  const handleSignOut = useCallback(async () => {
    const result = await authService.signOut();
    if (!result.error) {
      setUser(null);
      setSession(null);
    }
    return result;
  }, []);

  const value: AuthState = {
    user,
    session,
    loading,
    configured: isSupabaseConfigured,
    signUp: handleSignUp,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
