/**
 * Prompt text shared across LLM providers (src/llm/anthropic.ts, src/llm/gemini.ts)
 * so switching providers via LLM_PROVIDER never risks the two implementations
 * drifting apart.
 */

export function buildMemoryUpdatePrompt(params: {
  previousSummary: string | null;
  previousKeyFacts: Record<string, unknown>;
  recentMessages: { role: "fan" | "jenny"; text: string }[];
}): string {
  return `
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
}

export function parseMemoryUpdateResponse(text: string): { summary: string; keyFacts: Record<string, unknown> } {
  // Models sometimes wrap JSON in a ```json fence despite instructions not to;
  // strip that before parsing rather than failing the whole memory update.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  return { summary: parsed.summary, keyFacts: parsed.key_facts ?? {} };
}
