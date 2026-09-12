import { getSupabase } from "./supabaseClient";
import { ConversationRow } from "../types";

export async function logMessage(row: ConversationRow): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("conversations").insert(row);
  if (error) throw error;
}

export async function getRecentMessages(fanId: string, limit = 10): Promise<ConversationRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("fan_id", fanId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data as ConversationRow[]) ?? []).reverse();
}

export async function countMessagesThisMonth(fanId: string): Promise<number> {
  const supabase = getSupabase();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("fan_id", fanId)
    .eq("message_direction", "inbound")
    .gte("timestamp", startOfMonth.toISOString());

  if (error) throw error;
  return count ?? 0;
}
