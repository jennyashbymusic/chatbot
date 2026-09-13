import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { JENNY_SYSTEM_PROMPT, PromptContext, buildUserContextBlock } from "../personality/systemPrompt";
import { buildMemoryUpdatePrompt, parseMemoryUpdateResponse } from "./prompts";

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
 * Periodically (e.g. after a session, or on a schedule) asks the model to fold
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

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    messages: [{ role: "user", content: buildMemoryUpdatePrompt(params) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response contained no text block");
  }

  return parseMemoryUpdateResponse(textBlock.text);
}
