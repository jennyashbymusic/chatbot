/**
 * Backup keyword net for crisis-adjacent language. This runs regardless of
 * whether the OpenAI Moderation API call succeeds, as a redundant safety net
 * per Section 6 of the master build doc. Keep this list conservative enough to
 * avoid constant false positives, but err toward flagging when unsure — a
 * false positive costs a slightly awkward reply, a false negative costs a lot
 * more.
 */
export const CRISIS_KEYWORDS: string[] = [
  "kill myself",
  "killing myself",
  "want to die",
  "wanna die",
  "end my life",
  "ending my life",
  "suicide",
  "suicidal",
  "self harm",
  "self-harm",
  "cutting myself",
  "hurt myself",
  "hurting myself",
  "no reason to live",
  "not worth living",
  "better off dead",
  "overdose",
  "od on",
];

export function matchesCrisisKeyword(text: string): string[] {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.filter((kw) => lower.includes(kw));
}
