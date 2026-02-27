import { NextRequest, NextResponse } from "next/server";
import { requireRouteUser } from "@/lib/supabase/auth";
import { stripe } from "@/lib/stripe/config";
import { createOrRetrieveCustomer } from "@/lib/stripe/supabase-admin";
import { getPriceIdForPlan } from "@/lib/stripe/prices";

export const dynamic = "force-dynamic";

type PlanType = "weekly" | "monthly" | "season_pass";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireRouteUser(request);
    if (error || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planType = (body.planType ?? "monthly") as PlanType;

    const priceId = getPriceIdForPlan(planType);
    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured for this plan" },
        { status: 400 }
      );
    }

    const customerId = await createOrRetrieveCustomer(user.id, user.email);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const isRecurring = planType !== "season_pass";
    const successUrl = `${siteUrl}/pricing?success=true`;
    const cancelUrl = `${siteUrl}/pricing?canceled=true`;

    if (isRecurring) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId: user.id, planType },
        subscription_data: { metadata: { userId: user.id, planType } },
      });
      return NextResponse.json({ url: session.url });
    }

    // One-time payment (Exam Season Pass)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user.id, planType: "season_pass" },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[create-checkout-session]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
