import { moderateMessage } from "./safety/moderation";
import { CRISIS_RESPONSE_MESSAGE, alertHumanOfCrisisFlag } from "./safety/crisisResponse";
import { findOrCreateFanByPhone, decrementCredit } from "./db/fans";
import { getFanMemory, upsertFanMemory } from "./db/memory";
import { logMessage, getRecentMessages, countMessagesThisMonth } from "./db/conversations";
import { generateJennyReply, updateFanMemorySummary } from "./claude/client";
import { sendSms, sendMms } from "./messaging/twilio";
import { generateVoiceNote } from "./voice/elevenlabs";
import { config } from "./config";

// Middle of the 15-20/mo range from Section 5. Adjust once real usage data comes in.
const FREE_TIER_MONTHLY_LIMIT = 18;

// Rough approximation of "half as voice notes" from Section 5's cost model —
// tune once real usage data exists.
const VOICE_NOTE_PROBABILITY = 0.5;

/**
 * The full inbound-message pipeline described in Section 4:
 * moderate -> (crisis override) OR (paywall check -> Claude -> memory update
 * -> reply) -> log everything.
 */
export async function handleInboundMessage(params: { fromPhoneNumber: string; body: string }): Promise<void> {
  const { fromPhoneNumber, body } = params;

  const fan = await findOrCreateFanByPhone(fromPhoneNumber);
  const moderation = await moderateMessage(body);

  await logMessage({
    fan_id: fan.id,
    message_direction: "inbound",
    message_text: body,
    flagged: moderation.flagged,
    human_override: false,
  });

  if (moderation.flagged) {
    console.warn(`[safety] Message from fan ${fan.id} flagged (${moderation.source}): ${moderation.categories.join(", ")}`);

    await sendSms({ to: fromPhoneNumber, body: CRISIS_RESPONSE_MESSAGE });
    await logMessage({
      fan_id: fan.id,
      message_direction: "outbound",
      message_text: CRISIS_RESPONSE_MESSAGE,
      flagged: true,
      human_override: false,
    });
    await alertHumanOfCrisisFlag({ fanId: fan.id, phoneNumber: fromPhoneNumber, messageText: body });
    return;
  }

  if (fan.subscription_tier === "free") {
    const messagesThisMonth = await countMessagesThisMonth(fan.id);
    if (messagesThisMonth > FREE_TIER_MONTHLY_LIMIT) {
      if (fan.credits_remaining > 0) {
        await decrementCredit(fan.id);
      } else {
        const paywallReply = await generateJennyReply(
          {
            fanName: fan.name,
            memorySummary: null,
            keyFacts: null,
            recentMessages: [],
          },
          "[SYSTEM NOTE: this fan has hit their free monthly message limit and has no credits left. Reply in character, tying it to your betrayal/self-protection theme, and imply they can support you to keep talking — do not sound like a system message.]",
        );
        await sendSms({ to: fromPhoneNumber, body: paywallReply });
        await logMessage({
          fan_id: fan.id,
          message_direction: "outbound",
          message_text: paywallReply,
          flagged: false,
          human_override: false,
        });
        return;
      }
    }
  }

  const memory = await getFanMemory(fan.id);
  const recentRows = await getRecentMessages(fan.id, 10);
  const recentMessages = recentRows.map((row) => ({
    role: (row.message_direction === "inbound" ? "fan" : "jenny") as "fan" | "jenny",
    text: row.message_text,
  }));

  const reply = await generateJennyReply(
    {
      fanName: fan.name,
      memorySummary: memory?.summary ?? null,
      keyFacts: memory?.key_facts ?? null,
      recentMessages,
    },
    body,
  );

  const useVoiceNote =
    fan.subscription_tier === "voice" &&
    Boolean(config.elevenlabs.apiKey) &&
    Math.random() < VOICE_NOTE_PROBABILITY;

  if (useVoiceNote) {
    try {
      // NOTE: hosting the generated audio somewhere publicly reachable (e.g. a
      // Supabase Storage bucket) still needs to be wired up before this path
      // is production-ready — see Section 7 open items.
      const audioBuffer = await generateVoiceNote(reply);
      const mediaUrl = await uploadVoiceNoteAndGetUrl(audioBuffer);
      await sendMms({ to: fromPhoneNumber, mediaUrl });
    } catch (err) {
      console.error("[voice] Falling back to SMS text reply after voice-note generation failed", err);
      await sendSms({ to: fromPhoneNumber, body: reply });
    }
  } else {
    await sendSms({ to: fromPhoneNumber, body: reply });
  }

  await logMessage({
    fan_id: fan.id,
    message_direction: "outbound",
    message_text: reply,
    flagged: false,
    human_override: false,
  });

  void refreshFanMemory(fan.id, memory, [...recentMessages, { role: "fan", text: body }, { role: "jenny", text: reply }]);
}

async function refreshFanMemory(
  fanId: string,
  memory: Awaited<ReturnType<typeof getFanMemory>>,
  recentMessages: { role: "fan" | "jenny"; text: string }[],
): Promise<void> {
  try {
    const updated = await updateFanMemorySummary({
      previousSummary: memory?.summary ?? null,
      previousKeyFacts: memory?.key_facts ?? {},
      recentMessages,
    });
    await upsertFanMemory({ fanId, summary: updated.summary, keyFacts: updated.keyFacts });
  } catch (err) {
    console.error(`[memory] Failed to refresh memory summary for fan ${fanId}`, err);
  }
}

/**
 * TODO (Section 7 open item): wire this up to Supabase Storage (or another
 * public object store) once the Voice tier is being built out. Twilio needs a
 * publicly reachable URL, not raw bytes.
 */
async function uploadVoiceNoteAndGetUrl(_audioBuffer: Buffer): Promise<string> {
  throw new Error("Voice-note hosting is not implemented yet — see Section 7 open items");
}
