import twilio from "twilio";
import { config } from "../config";

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!config.twilio.accountSid) {
    throw new Error("TWILIO_ACCOUNT_SID is not configured");
  }

  if (!client) {
    if (config.twilio.apiKeySid && config.twilio.apiKeySecret) {
      // API Key auth: the account SID must be passed explicitly since the
      // first two args authenticate as the key, not the account.
      client = twilio(config.twilio.apiKeySid, config.twilio.apiKeySecret, {
        accountSid: config.twilio.accountSid,
      });
    } else if (config.twilio.authToken) {
      client = twilio(config.twilio.accountSid, config.twilio.authToken);
    } else {
      throw new Error(
        "Configure either TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET, or TWILIO_AUTH_TOKEN, to authenticate the Twilio REST client",
      );
    }
  }
  return client;
}

export async function sendSms(params: { to: string; body: string }): Promise<void> {
  if (!config.twilio.phoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER is not configured");
  }
  const client = getClient();
  await client.messages.create({
    to: params.to,
    from: config.twilio.phoneNumber,
    body: params.body,
  });
}

export async function sendMms(params: { to: string; body?: string; mediaUrl: string }): Promise<void> {
  if (!config.twilio.phoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER is not configured");
  }
  const client = getClient();
  await client.messages.create({
    to: params.to,
    from: config.twilio.phoneNumber,
    body: params.body,
    mediaUrl: [params.mediaUrl],
  });
}

/**
 * Validates that an inbound webhook request actually came from Twilio, using
 * the X-Twilio-Signature header. Call this before trusting any webhook body.
 */
export function isValidTwilioRequest(params: {
  signature: string | undefined;
  fullUrl: string;
  body: Record<string, unknown>;
}): boolean {
  if (!config.twilio.authToken) {
    throw new Error("TWILIO_AUTH_TOKEN is not configured");
  }
  if (!params.signature) return false;

  return twilio.validateRequest(config.twilio.authToken, params.signature, params.fullUrl, params.body as Record<string, string>);
}
