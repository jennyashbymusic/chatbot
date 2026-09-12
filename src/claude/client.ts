import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { JENNY_SYSTEM_PROMPT, PromptContext, buildUserContextBlock } from "../personality/systemPrompt";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!config.anthropic.apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

export async function generateJennyReply(ctx: PromptContext, newFanMessage: string): Promise<string> {
  const anthropic = getClient();

  const userContent = `${buildUserContextBlock(ctx)}\n\nNew message from fan:\n${newFanMessage}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system: JENNY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response contained no text block");
  }
  return textBlock.text.trim();
}

/**
 * Periodically (e.g. after a session, or on a schedule) asks Claude to fold
 * new conversation turns into the fan's running memory summary. Per Section 3,
 * this replaces the full transcript with a compact summary + key facts so
 * later calls stay cheap and Jenny's references stay natural rather than
 * exhaustive.
 */
export async function updateFanMemorySummary(params: {
  previousSummary: string | null;
  previousKeyFacts: Record<string, unknown>;
  recentMessages: { role: "fan" | "jenny"; text: string }[];
}): Promise<{ summary: string; keyFacts: Record<string, unknown> }> {
  const anthropic = getClient();

  const prompt = `
You maintain a short running memory summary of a fan for an AI artist persona
named Jenny. Update the summary and key facts below based on the new messages.

Rules:
- The summary should be 2-4 sentences, natural language, capturing durable and
  emotionally relevant info only (not small talk).
- key_facts should be a small JSON object of short, durable facts (e.g. pet
  names, favorite song, big life events). Don't include transient info.
- Do not include anything from a crisis/trauma disclosure verbatim — summarize
  only that "the fan went through something difficult" if relevant, never the
  specifics.

Previous summary: ${params.previousSummary ?? "(none yet)"}
Previous key facts: ${JSON.stringify(params.previousKeyFacts)}

New messages:
${params.recentMessages.map((m) => `${m.role === "fan" ? "Fan" : "Jenny"}: ${m.text}`).join("\n")}

Respond with ONLY a JSON object of the form:
{"summary": "...", "key_facts": {...}}
`.trim();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response contained no text block");
  }

  const parsed = JSON.parse(textBlock.text.trim());
  return { summary: parsed.summary, keyFacts: parsed.key_facts ?? {} };
}
