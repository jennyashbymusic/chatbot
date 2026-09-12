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
    accountSid: optional("TWILIO_ACCOUNT_SID"),
    authToken: optional("TWILIO_AUTH_TOKEN"),
    phoneNumber: optional("TWILIO_PHONE_NUMBER"),
  },

  anthropic: {
    apiKey: optional("ANTHROPIC_API_KEY"),
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
