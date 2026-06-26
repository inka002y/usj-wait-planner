export const appEnv = {
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim(),
  supabaseAnonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
};

export function hasSupabaseReadConfig(): boolean {
  return appEnv.supabaseUrl.length > 0 && appEnv.supabaseAnonKey.length > 0;
}
