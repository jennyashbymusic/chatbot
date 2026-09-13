import "dotenv/config";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(optional("PORT") ?? 3000),

  twilio: {
    // Account SID (starts with AC) — required regardless of which auth style
    // below is used, since it's how the REST client knows which account to hit.
    accountSid: optional("TWILIO_ACCOUNT_SID"),
    // The real Account Auth Token (from the Console's main Account Info panel).
    // This is ONLY used to verify inbound webhook signatures — Twilio signs
    // webhooks with this token specifically, not an API Key Secret, so there's
    // no way to substitute an API key here.
    authToken: optional("TWILIO_AUTH_TOKEN"),
    // Optional: authenticate the REST client with an API Key (SK...) + Secret
    // instead of the main Auth Token — Twilio's recommended pattern, since it
    // can be revoked independently. Falls back to accountSid/authToken if unset.
    apiKeySid: optional("TWILIO_API_KEY_SID"),
    apiKeySecret: optional("TWILIO_API_KEY_SECRET"),
    phoneNumber: optional("TWILIO_PHONE_NUMBER"),
  },

  llm: {
    // "anthropic" (default) or "gemini" — lets Jenny's brain be swapped
    // without touching any calling code, e.g. to use Gemini's free tier while
    // Anthropic credits aren't funded yet.
    provider: (optional("LLM_PROVIDER") ?? "anthropic") as "anthropic" | "gemini",
  },

  anthropic: {
    apiKey: optional("ANTHROPIC_API_KEY"),
  },

  gemini: {
    apiKey: optional("GEMINI_API_KEY"),
    model: optional("GEMINI_MODEL") ?? "gemini-2.5-flash",
  },

  openai: {
    apiKey: optional("OPENAI_API_KEY"),
  },

  elevenlabs: {
    apiKey: optional("ELEVENLABS_API_KEY"),
    voiceId: optional("ELEVENLABS_VOICE_ID"),
  },

  supabase: {
    url: optional("SUPABASE_URL"),
    serviceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
  },

  stripe: {
    secretKey: optional("STRIPE_SECRET_KEY"),
    webhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
    priceBasic: optional("STRIPE_PRICE_BASIC"),
    priceVoice: optional("STRIPE_PRICE_VOICE"),
  },

  crisisAlertWebhookUrl: optional("CRISIS_ALERT_WEBHOOK_URL"),
};

export { required };
