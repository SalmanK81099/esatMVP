import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/config";
import {
  upsertProductRecord,
  upsertPriceRecord,
  deleteProductRecord,
  deletePriceRecord,
  manageSubscriptionStatusChange,
  upsertOneTimePurchase,
} from "@/lib/stripe/supabase-admin";

const RELEVANT_EVENTS = new Set([
  "product.created",
  "product.updated",
  "product.deleted",
  "price.created",
  "price.updated",
  "price.deleted",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const EXAM_DATE = new Date("2026-10-01");

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json("Webhook secret not found", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(`Webhook Error: ${msg}`, { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "product.created":
      case "product.updated":
        await upsertProductRecord(event.data.object as Stripe.Product);
        break;
      case "price.created":
      case "price.updated":
        await upsertPriceRecord(event.data.object as Stripe.Price);
        break;
      case "price.deleted":
        await deletePriceRecord(event.data.object as Stripe.Price);
        break;
      case "product.deleted":
        await deleteProductRecord(event.data.object as Stripe.Product);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await manageSubscriptionStatusChange(
          sub.id,
          sub.customer as string,
          event.type === "customer.subscription.created"
        );
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          await manageSubscriptionStatusChange(
            session.subscription as string,
            session.customer as string,
            true
          );
        } else if (session.mode === "payment" && session.metadata?.planType === "season_pass") {
          await upsertOneTimePurchase(session, EXAM_DATE);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[webhooks]", err);
    return NextResponse.json("Webhook handler failed", { status: 400 });
  }

  return NextResponse.json({ received: true });
}
