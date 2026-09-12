# Jenny Ashby — AI Artist Chatbot

Backend for Jenny Ashby, an AI music artist fans text with over SMS. See the
master build doc (shared separately) for the full spec — this README covers
just running what's here.

## Status

Scaffolding for the full pipeline in Section 4 of the spec: Twilio webhook ->
moderation gate -> Claude reply -> Supabase logging/memory -> Stripe billing.
Nothing has real credentials wired in yet — see "Setup" below.

Not yet implemented (see Section 7 of the master doc):
- Voice-note audio hosting (`uploadVoiceNoteAndGetUrl` in `src/orchestrator.ts`
  is a stub — needs a public object store, e.g. Supabase Storage)
- Human-override dashboard/Slack reply path
- AI-disclosure first-contact message
- Legal/clinical review of the crisis-response copy in
  `src/safety/crisisResponse.ts` (marked DRAFT ONLY in the file)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the keys you have. Every
   integration is designed to fail loudly and only when actually called, so
   the server runs fine with some keys missing while you build incrementally.
3. Run the Supabase schema in `src/db/schema.sql` against a fresh Supabase
   project (SQL editor).
4. `npm run dev` to run locally with auto-reload, or `npm run build && npm start`.

## Project layout

- `src/personality/systemPrompt.ts` — Jenny's system prompt and few-shot voice examples
- `src/safety/` — moderation gate (OpenAI Moderation API + keyword backup) and crisis response
- `src/claude/client.ts` — Claude reply generation + fan memory summarization
- `src/db/` — Supabase schema and typed accessors (fans, memory, conversations)
- `src/messaging/twilio.ts` — SMS/MMS send + inbound webhook signature validation
- `src/voice/elevenlabs.ts` — voice-note generation for the Voice tier
- `src/billing/stripe.ts` — subscription/credit-pack webhook handling
- `src/orchestrator.ts` — wires the above into the Section 4 message flow
- `src/app.ts` — the Express app itself (routes, no listener)
- `src/server.ts` — local dev entry point (`app.listen`)
- `api/index.ts` — Vercel entry point (exports the Express app directly)

## Testing the webhook locally

Use `ngrok http 3000` (or similar) to get a public URL, point Twilio's SMS
webhook at `https://<tunnel>/webhooks/sms`, and Stripe's webhook at
`https://<tunnel>/webhooks/stripe`.

## Deploying to Vercel

The app is structured to deploy as-is: `api/index.ts` exports the Express app
directly (an Express app is itself a valid `(req, res)` handler), and
`vercel.json` rewrites every path to that one function so `/webhooks/sms`,
`/webhooks/stripe`, and `/health` all reach it.

1. Push this repo to GitHub, then in the Vercel dashboard: **New Project** →
   import the repo. Framework preset: leave as detected/Other — no build
   command or output directory is needed since this is API-only.
2. In the Vercel project's **Settings → Environment Variables**, add every key
   from `.env.example` with your real values. Do this directly in the
   dashboard rather than committing or scripting real secrets anywhere.
3. Deploy. Point Twilio's SMS webhook at
   `https://<your-project>.vercel.app/webhooks/sms` and Stripe's webhook at
   `https://<your-project>.vercel.app/webhooks/stripe`.
4. Once the GitHub repo is connected, every push to `main` auto-deploys — no
   manual `vercel` CLI step needed for routine updates.

Notes:
- `vercel.json` sets `maxDuration: 30` for the function, since a reply
  involves a Claude call, a couple of Supabase round-trips, and a Twilio send
  — comfortably under 30s, but adjust if your Vercel plan caps function
  duration lower than that.
- The SMS webhook responds to Twilio immediately, then keeps working
  (Claude + Supabase + sending the real reply) before the handler's promise
  resolves. That's safe on Vercel — the function invocation stays alive until
  the handler returns, not until the HTTP response is flushed — just keep the
  whole pipeline within the configured `maxDuration`.
