import express from "express";
import { config } from "./config";
import { isValidTwilioRequest } from "./messaging/twilio";
import { handleInboundMessage } from "./orchestrator";
import { constructStripeEvent, handleStripeEvent } from "./billing/stripe";

const app = express();

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
    // reply is sent asynchronously via the Twilio REST API in the orchestrator.
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

app.listen(config.port, () => {
  console.log(`Jenny Ashby backend listening on port ${config.port}`);
});
