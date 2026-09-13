import crypto from "node:crypto";
import { config } from "../config";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

async function sendMessage(params: { to: string; text: string; mediaUrls?: string[] }): Promise<void> {
  if (!config.telnyx.apiKey) {
    throw new Error("TELNYX_API_KEY is not configured");
  }
  if (!config.telnyx.phoneNumber) {
    throw new Error("TELNYX_PHONE_NUMBER is not configured");
  }

  const response = await fetch(`${TELNYX_API_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.telnyx.apiKey}`,
    },
    body: JSON.stringify({
      from: config.telnyx.phoneNumber,
      to: params.to,
      text: params.text,
      ...(params.mediaUrls ? { media_urls: params.mediaUrls } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Telnyx send failed: ${response.status} ${await response.text()}`);
  }
}

export async function sendSms(params: { to: string; body: string }): Promise<void> {
  await sendMessage({ to: params.to, text: params.body });
}

export async function sendMms(params: { to: string; body?: string; mediaUrl: string }): Promise<void> {
  await sendMessage({ to: params.to, text: params.body ?? "", mediaUrls: [params.mediaUrl] });
}

const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Telnyx signs webhooks with Ed25519 over `${timestamp}|${raw_body}`, using
 * two headers (telnyx-signature-ed25519, telnyx-timestamp) verified against
 * the account's public key from Mission Control. Deliberately not using the
 * SDK's webhooks.unwrap() here — as of telnyx-node@7 it's wired to the
 * Standard Webhooks library, which expects different header names and
 * rejects genuine Telnyx webhooks. Verifying manually with Node's built-in
 * Ed25519 support instead.
 */
export function isValidTelnyxRequest(params: {
  signature: string | undefined;
  timestamp: string | undefined;
  rawBody: Buffer;
}): boolean {
  if (!config.telnyx.publicKey) {
    throw new Error("TELNYX_PUBLIC_KEY is not configured");
  }
  if (!params.signature || !params.timestamp) return false;

  const timestampSeconds = Number(params.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signedPayload = Buffer.concat([Buffer.from(`${params.timestamp}|`, "utf8"), params.rawBody]);

  try {
    const publicKeyObject = crypto.createPublicKey({
      key: {
        kty: "OKP",
        crv: "Ed25519",
        x: base64ToBase64Url(config.telnyx.publicKey),
      },
      format: "jwk",
    });

    return crypto.verify(null, signedPayload, publicKeyObject, Buffer.from(params.signature, "base64"));
  } catch (err) {
    console.error("[telnyx] Signature verification threw", err);
    return false;
  }
}

function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
