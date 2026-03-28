import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

const NETWORK_AUTH_HINT =
  'Could not reach Supabase (network error). Check: internet connection; VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env match Project Settings → API with no extra spaces; restart the dev server after editing .env; Supabase project is not paused; VPN or extensions are not blocking *.supabase.co.';

function looksLikeNetworkAuthFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed') ||
    m.includes('econnrefused') ||
    m.includes('err_connection')
  );
}

function mapAuthErrorMessage(message: string | undefined): string | null {
  if (!message) return null;
  return looksLikeNetworkAuthFailure(message) ? NETWORK_AUTH_HINT : message;
}

function mapCaughtAuthError(err: unknown): string {
  if (err instanceof TypeError && looksLikeNetworkAuthFailure(err.message)) {
    return NETWORK_AUTH_HINT;
  }
  if (err instanceof Error) {
    return mapAuthErrorMessage(err.message) ?? err.message;
  }
  return String(err);
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { user: null, session: null, error: 'Supabase not configured' };
  const redirect =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/`
      : undefined;
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: redirect ? { emailRedirectTo: redirect } : undefined,
    });
    return {
      user: data.user,
      session: data.session,
      error: mapAuthErrorMessage(error?.message) ?? null,
    };
  } catch (e) {
    return { user: null, session: null, error: mapCaughtAuthError(e) };
  }
}

export async function resendSignupConfirmation(email: string): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { error: 'Supabase not configured' };
  try {
    const { error } = await client.auth.resend({ type: 'signup', email });
    return { error: mapAuthErrorMessage(error?.message) ?? null };
  } catch (e) {
    return { error: mapCaughtAuthError(e) };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { user: null, session: null, error: 'Supabase not configured' };
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return {
      user: data.user,
      session: data.session,
      error: mapAuthErrorMessage(error?.message) ?? null,
    };
  } catch (e) {
    return { user: null, session: null, error: mapCaughtAuthError(e) };
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { error: 'Supabase not configured' };
  try {
    const { error } = await client.auth.signOut();
    return { error: mapAuthErrorMessage(error?.message) ?? null };
  } catch (e) {
    return { error: mapCaughtAuthError(e) };
  }
}

export async function getSession(): Promise<{ session: Session | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) return { session: null, error: null };
  try {
    const { data, error } = await client.auth.getSession();
    return { session: data.session, error: mapAuthErrorMessage(error?.message) ?? null };
  } catch (e) {
    return { session: null, error: mapCaughtAuthError(e) };
  }
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): (() => void) | undefined {
  const client = getSupabaseClient();
  if (!client) return undefined;
  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
