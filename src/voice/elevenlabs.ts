import { config } from "../config";

/**
 * Generates a voice-note audio buffer for the Voice tier (Section 5). Callers
 * are responsible for uploading/hosting the resulting audio somewhere
 * publicly reachable and passing that URL to Twilio's mediaUrl — Twilio can't
 * take raw bytes directly.
 */
export async function generateVoiceNote(text: string): Promise<Buffer> {
  if (!config.elevenlabs.apiKey || !config.elevenlabs.voiceId) {
    throw new Error("ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID are not configured");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.elevenlabs.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs request failed: ${response.status} ${await response.text()}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
