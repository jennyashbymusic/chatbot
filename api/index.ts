import { createApp } from "../src/app";

// Vercel entry point. An Express app instance is itself a valid
// (req, res) request handler, so exporting it directly is all Vercel needs —
// no adapter package required. All routes (/webhooks/sms, /webhooks/stripe,
// /health) are handled internally by Express; vercel.json rewrites every
// path to this one function.
export default createApp();
