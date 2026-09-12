import Stripe from "stripe";
import { config } from "../config";
import { setSubscriptionTier, addCredits } from "../db/fans";

let client: Stripe | null = null;

function getClient(): Stripe {
  if (!config.stripe.secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) {
    client = new Stripe(config.stripe.secretKey);
  }
  return client;
}

export function constructStripeEvent(params: { rawBody: Buffer; signature: string }): Stripe.Event {
  if (!config.stripe.webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  const stripe = getClient();
  return stripe.webhooks.constructEvent(params.rawBody, params.signature, config.stripe.webhookSecret);
}

/**
 * Handles the Stripe events relevant to Section 5's monetization tiers:
 * - checkout.session.completed: initial purchase of a subscription or credit pack
 * - customer.subscription.updated / deleted: tier changes, cancellations, and
 *   payment failures that should downgrade a fan back to free
 *
 * Credit-pack price IDs are looked up by metadata rather than hardcoded here —
 * set `credits: "<n>"` in the Stripe Price's metadata when creating each pack.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const mode = session.mode;

      if (mode === "subscription") {
        const tier = priceIdToTier(session.metadata?.price_id);
        if (tier) await setSubscriptionTier({ stripeCustomerId: customerId, tier });
      } else if (mode === "payment") {
        const credits = Number(session.metadata?.credits ?? 0);
        if (credits > 0) await addCredits({ stripeCustomerId: customerId, credits });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;
      const tier = subscription.status === "active" ? priceIdToTier(priceId) : "free";
      await setSubscriptionTier({ stripeCustomerId: customerId, tier: tier ?? "free" });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      await setSubscriptionTier({ stripeCustomerId: customerId, tier: "free" });
      break;
    }

    default:
      break;
  }
}

function priceIdToTier(priceId: string | undefined): "basic" | "voice" | null {
  if (!priceId) return null;
  if (priceId === config.stripe.priceBasic) return "basic";
  if (priceId === config.stripe.priceVoice) return "voice";
  return null;
}
