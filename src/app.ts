import express from "express";
import { isValidTwilioRequest } from "./messaging/twilio";
import { isValidTelnyxRequest } from "./messaging/telnyx";
import { handleInboundMessage } from "./orchestrator";
import { constructStripeEvent, handleStripeEvent } from "./billing/stripe";

export function createApp() {
  const app = express();

  // Needed so req.protocol reflects the original https scheme when running
  // behind Vercel's (or any) reverse proxy — otherwise Twilio signature
  // validation below computes the wrong URL and rejects every request.
  app.set("trust proxy", true);

  // Stripe webhook needs the raw body for signature verification, so it must be
  // registered before the JSON body parser.
  app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const signature = req.header("stripe-signature");
      if (!signature) {
        res.status(400).send("Missing stripe-signature header");
        return;
      }
      const event = constructStripeEvent({ rawBody: req.body, signature });
      await handleStripeEvent(event);
      res.status(200).send("ok");
    } catch (err) {
      console.error("[stripe webhook] error", err);
      res.status(400).send("Webhook error");
    }
  });

  // Telnyx also needs the raw body for its Ed25519 signature verification, so
  // this must be registered before the JSON body parser too.
  app.post("/webhooks/telnyx/sms", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const signature = req.header("telnyx-signature-ed25519");
      const timestamp = req.header("telnyx-timestamp");

      if (!isValidTelnyxRequest({ signature, timestamp, rawBody: req.body })) {
        res.status(403).send("Invalid Telnyx signature");
        return;
      }

      const payload = JSON.parse(req.body.toString("utf8"));
      const eventType = payload?.data?.event_type;

      if (eventType !== "message.received") {
        res.status(200).send("ignored");
        return;
      }

      const fromField = payload.data.payload.from;
      const fromPhoneNumber = typeof fromField === "string" ? fromField : fromField?.phone_number;
      const body = payload.data.payload.text as string;

      // See the /webhooks/sms handler below for why it's safe to keep working
      // after responding on a serverless platform.
      res.status(200).send("ok");

      await handleInboundMessage({ fromPhoneNumber, body });
    } catch (err) {
      console.error("[telnyx webhook] error", err);
      if (!res.headersSent) {
        res.status(500).send("Internal error");
      }
    }
  });

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.post("/webhooks/sms", async (req, res) => {
    try {
      const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const signature = req.header("X-Twilio-Signature");

      if (!isValidTwilioRequest({ signature, fullUrl, body: req.body })) {
        res.status(403).send("Invalid Twilio signature");
        return;
      }

      const fromPhoneNumber = req.body.From as string;
      const body = req.body.Body as string;

      // Respond to Twilio immediately; Twilio expects a fast ack and the actual
      // reply is sent asynchronously via the Twilio REST API in the
      // orchestrator. On a serverless platform the function invocation stays
      // alive until this handler's promise settles (it's awaited below), so
      // it's safe to keep working after res.send — just make sure the whole
      // pipeline fits inside the function's configured max duration (see
      // vercel.json).
      res.status(200).set("Content-Type", "text/xml").send("<Response></Response>");

      await handleInboundMessage({ fromPhoneNumber, body });
    } catch (err) {
      console.error("[sms webhook] error", err);
      if (!res.headersSent) {
        res.status(500).send("Internal error");
      }
    }
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
}
