import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * In desktop (Electron) mode, NEXT_PUBLIC_* env vars are baked at build
 * time and may not match the runtime ports. The preload script injects
 * `window.__ELECTRON_CONFIG__` with the correct runtime values.
 */
function getSupabaseUrl(): string {
  if (typeof window !== "undefined") {
    const electronConfig = (window as unknown as Record<string, unknown>).__ELECTRON_CONFIG__ as
      | { supabaseUrl?: string }
      | undefined;
    if (electronConfig?.supabaseUrl) return electronConfig.supabaseUrl;
  }
  return env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseAnonKey(): string {
  if (typeof window !== "undefined") {
    const electronConfig = (window as unknown as Record<string, unknown>).__ELECTRON_CONFIG__ as
      | { supabaseAnonKey?: string }
      | undefined;
    if (electronConfig?.supabaseAnonKey) return electronConfig.supabaseAnonKey;
  }
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
