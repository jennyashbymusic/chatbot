import { config } from "../config";
import * as twilio from "./twilio";
import * as telnyx from "./telnyx";

/**
 * Which SMS provider actually sends Jenny's replies is switchable via
 * MESSAGING_PROVIDER, same pattern as src/llm/index.ts — e.g. to fall back to
 * Telnyx while Twilio's trial account is blocked on custom-template
 * restrictions. Inbound webhook handling stays provider-specific (see
 * src/app.ts) since Twilio and Telnyx use entirely different payload shapes.
 */
const provider = config.messaging.provider === "telnyx" ? telnyx : twilio;

export const sendSms = provider.sendSms;
export const sendMms = provider.sendMms;
