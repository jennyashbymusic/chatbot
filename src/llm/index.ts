import { config } from "../config";
import * as anthropic from "./anthropic";
import * as gemini from "./gemini";

/**
 * Which model provider is Jenny's "brain" is switchable via LLM_PROVIDER so
 * either can be used without touching any calling code — e.g. to fall back to
 * Gemini's free tier while Anthropic credits aren't funded yet.
 */
const provider = config.llm.provider === "gemini" ? gemini : anthropic;

export const generateJennyReply = provider.generateJennyReply;
export const updateFanMemorySummary = provider.updateFanMemorySummary;
