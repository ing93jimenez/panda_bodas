import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Cliente con privilegios de servidor. Nunca se expone al navegador. */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseSecret(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const BUCKET = "media";
