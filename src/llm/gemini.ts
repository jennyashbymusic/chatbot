import { GoogleGenAI } from "@google/genai";
import { config } from "../config";
import { JENNY_SYSTEM_PROMPT, PromptContext, buildUserContextBlock } from "../personality/systemPrompt";
import { buildMemoryUpdatePrompt, parseMemoryUpdateResponse } from "./prompts";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!config.gemini.apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return client;
}

export async function generateJennyReply(ctx: PromptContext, newFanMessage: string): Promise<string> {
  const ai = getClient();

  const userContent = `${buildUserContextBlock(ctx)}\n\nNew message from fan:\n${newFanMessage}`;

  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: userContent,
    config: {
      systemInstruction: JENNY_SYSTEM_PROMPT,
      maxOutputTokens: 300,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini response contained no text");
  }
  return text.trim();
}

export async function updateFanMemorySummary(params: {
  previousSummary: string | null;
  previousKeyFacts: Record<string, unknown>;
  recentMessages: { role: "fan" | "jenny"; text: string }[];
}): Promise<{ summary: string; keyFacts: Record<string, unknown> }> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: buildMemoryUpdatePrompt(params),
    config: {
      maxOutputTokens: 400,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini response contained no text");
  }

  return parseMemoryUpdateResponse(text);
}
