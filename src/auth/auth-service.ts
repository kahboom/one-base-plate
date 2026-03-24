import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/client";

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { user: null, session: null, error: "Supabase not configured" };
  const redirect =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}/`
      : undefined;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: redirect ? { emailRedirectTo: redirect } : undefined,
  });
  return { user: data.user, session: data.session, error: error?.message ?? null };
}

export async function resendSignupConfirmation(email: string): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { error: "Supabase not configured" };
  const { error } = await client.auth.resend({ type: "signup", email });
  return { error: error?.message ?? null };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { user: null, session: null, error: "Supabase not configured" };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { user: data.user, session: data.session, error: error?.message ?? null };
}

export async function signOut(): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { error: "Supabase not configured" };
  const { error } = await client.auth.signOut();
  return { error: error?.message ?? null };
}

export async function getSession(): Promise<{ session: Session | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { session: null, error: null };
  const { data, error } = await client.auth.getSession();
  return { session: data.session, error: error?.message ?? null };
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): (() => void) | undefined {
  const client = getSupabaseClient();
  if (!client) return undefined;
  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
