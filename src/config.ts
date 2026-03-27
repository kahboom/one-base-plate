function trimEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Trimmed so accidental spaces/newlines in `.env` do not break requests. */
export const supabaseUrl: string = trimEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
export const supabaseAnonKey: string = trimEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
export const isSupabaseConfigured: boolean =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
