import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured");
  }
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  }
  return client;
}
