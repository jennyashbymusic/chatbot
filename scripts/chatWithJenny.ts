/**
 * Local terminal chat with Jenny — exercises the same moderation + LLM code
 * paths as production, but skips Twilio/Telnyx and Supabase entirely. Lets
 * you test personality/prompt changes and the crisis-response override for
 * free, without any SMS provider or carrier registration.
 */
import readline from "node:readline/promises";
import { moderateMessage } from "../src/safety/moderation";
import { CRISIS_RESPONSE_MESSAGE } from "../src/safety/crisisResponse";
import { generateJennyReply } from "../src/llm";
import { PromptContext } from "../src/personality/systemPrompt";

async function main() {
  console.log("Chatting with Jenny locally (Ctrl+C to quit). No SMS, no database — just this terminal.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const recentMessages: PromptContext["recentMessages"] = [];

  for (;;) {
    const input = await rl.question("You: ").catch(() => null);
    if (input === null) return;
    if (!input.trim()) continue;

    const moderation = await moderateMessage(input);
    if (moderation.flagged) {
      console.log(`\n[moderation flagged: ${moderation.categories.join(", ") || moderation.source}]`);
      console.log(`Jenny: ${CRISIS_RESPONSE_MESSAGE}\n`);
      continue;
    }

    recentMessages.push({ role: "fan", text: input });

    const reply = await generateJennyReply(
      {
        fanName: null,
        memorySummary: null,
        keyFacts: null,
        recentMessages: recentMessages.slice(0, -1).slice(-10),
      },
      input,
    );

    recentMessages.push({ role: "jenny", text: reply });
    console.log(`Jenny: ${reply}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
