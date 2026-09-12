import { getSupabase } from "./supabaseClient";
import { FanMemory } from "../types";

export async function getFanMemory(fanId: string): Promise<FanMemory | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("fan_memory")
    .select("*")
    .eq("fan_id", fanId)
    .maybeSingle();

  if (error) throw error;
  return (data as FanMemory | null) ?? null;
}

export async function upsertFanMemory(params: {
  fanId: string;
  summary: string;
  keyFacts: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("fan_memory").upsert({
    fan_id: params.fanId,
    summary: params.summary,
    key_facts: params.keyFacts,
    last_updated: new Date().toISOString(),
  });
  if (error) throw error;
}
