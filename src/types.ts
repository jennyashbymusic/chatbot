export type SubscriptionTier = "free" | "basic" | "voice";

export interface Fan {
  id: string;
  phone_number: string;
  name: string | null;
  first_contact_date: string;
  source: string | null;
  subscription_tier: SubscriptionTier;
  credits_remaining: number;
  stripe_customer_id: string | null;
}

export interface FanMemory {
  fan_id: string;
  summary: string;
  key_facts: Record<string, unknown>;
  last_updated: string;
}

export type MessageDirection = "inbound" | "outbound";

export interface ConversationRow {
  id?: string;
  fan_id: string;
  message_direction: MessageDirection;
  message_text: string;
  timestamp?: string;
  flagged: boolean;
  human_override: boolean;
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  source: "openai" | "keyword" | "none";
}
