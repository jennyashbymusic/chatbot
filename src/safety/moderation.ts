import { config } from "../config";
import { ModerationResult } from "../types";
import { matchesCrisisKeyword } from "./keywordList";

/**
 * Runs before every inbound fan message is allowed anywhere near Claude's
 * personality logic (Section 6). Combines the OpenAI Moderation API with a
 * keyword backup so a moderation-API outage never becomes a silent bypass.
 *
 * Fail-safe by design: if the OpenAI call errors or the key is missing, we
 * fall back to keyword-only detection rather than skipping moderation.
 */
export async function moderateMessage(text: string): Promise<ModerationResult> {
  const keywordHits = matchesCrisisKeyword(text);

  let openaiFlagged = false;
  let openaiCategories: string[] = [];
  let openaiRan = false;

  if (config.openai.apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: JSON.stringify({ input: text }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          results: { flagged: boolean; categories: Record<string, boolean> }[];
        };
        const result = data.results[0];
        openaiFlagged = result.flagged;
        openaiCategories = Object.entries(result.categories)
          .filter(([, v]) => v)
          .map(([k]) => k);
        openaiRan = true;
      } else {
        console.error(
          `[moderation] OpenAI Moderation API returned ${response.status}; falling back to keyword-only detection`,
        );
      }
    } catch (err) {
      console.error("[moderation] OpenAI Moderation API call failed; falling back to keyword-only detection", err);
    }
  }

  const flagged = openaiFlagged || keywordHits.length > 0;
  const categories = [
    ...openaiCategories,
    ...keywordHits.map((kw) => `keyword:${kw}`),
  ];

  return {
    flagged,
    categories,
    source: openaiRan ? "openai" : keywordHits.length > 0 ? "keyword" : "none",
  };
}
