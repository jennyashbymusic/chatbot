import { getSupabase } from "./supabaseClient";
import { Fan } from "../types";

export async function findOrCreateFanByPhone(phoneNumber: string): Promise<Fan> {
  const supabase = getSupabase();

  const { data: existing, error: findError } = await supabase
    .from("fans")
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing as Fan;

  const { data: created, error: insertError } = await supabase
    .from("fans")
    .insert({ phone_number: phoneNumber })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created as Fan;
}

export async function decrementCredit(fanId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("decrement_fan_credit", { p_fan_id: fanId });
  if (error) throw error;
}

export async function setSubscriptionTier(params: {
  stripeCustomerId: string;
  tier: Fan["subscription_tier"];
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("fans")
    .update({ subscription_tier: params.tier })
    .eq("stripe_customer_id", params.stripeCustomerId);
  if (error) throw error;
}

export async function addCredits(params: { stripeCustomerId: string; credits: number }): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("add_fan_credits", {
    p_stripe_customer_id: params.stripeCustomerId,
    p_credits: params.credits,
  });
  if (error) throw error;
}
