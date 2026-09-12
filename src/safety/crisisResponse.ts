import { config } from "../config";

/**
 * DRAFT ONLY. Per Section 6 of the master build doc, this copy must be
 * reviewed by a qualified clinical/legal reviewer before going live — do not
 * treat this text as final. It intentionally breaks Jenny's character: safety
 * comes before persona consistency.
 */
export const CRISIS_RESPONSE_MESSAGE = `
Hey — I want to pause the usual back-and-forth for a second, because what you just said matters more than staying in character.

I'm an AI, and I'm not equipped to help with what you're describing. Please reach out to people who are:

If you're in the US, you can call or text 988 (Suicide & Crisis Lifeline) anytime, or text HOME to 741741 (Crisis Text Line). If you're outside the US, findahelpline.com has resources by country. If you're in immediate danger, please call 911 (or your local emergency number).

You matter, and this isn't something I can be the right support for. I hope you'll reach out to one of the resources above, or to someone you trust.
`.trim();

export async function alertHumanOfCrisisFlag(params: {
  fanId: string;
  phoneNumber: string;
  messageText: string;
}): Promise<void> {
  const { crisisAlertWebhookUrl } = config;

  if (!crisisAlertWebhookUrl) {
    console.error(
      "[crisis] CRISIS_ALERT_WEBHOOK_URL is not configured — no human alert was sent for a flagged message. Configure this before going live.",
      params,
    );
    return;
  }

  try {
    await fetch(crisisAlertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 Crisis-flagged message from fan ${params.fanId} (${params.phoneNumber}):\n"${params.messageText}"\n\nCrisis response was sent automatically. Please follow up with this fan directly.`,
      }),
    });
  } catch (err) {
    console.error("[crisis] Failed to send human alert webhook", err);
  }
}
