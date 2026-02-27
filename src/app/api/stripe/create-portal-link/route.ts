import { NextRequest, NextResponse } from "next/server";
import { requireRouteUser } from "@/lib/supabase/auth";
import { stripe } from "@/lib/stripe/config";
import { createOrRetrieveCustomer } from "@/lib/stripe/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireRouteUser(request);
    if (error || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerId = await createOrRetrieveCustomer(user.id, user.email);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/profile`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[create-portal-link]", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
