export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? "";
export const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
export const isSupabaseConfigured: boolean =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
