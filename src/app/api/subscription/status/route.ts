import { NextRequest, NextResponse } from "next/server";
import { requireRouteUser } from "@/lib/supabase/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireRouteUser(request);
    if (error || !user) {
      return NextResponse.json({ tier: "free", hasFullAccess: false }, { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check active subscription
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, status, current_period_end, price_id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("current_period_end", { ascending: false })
      .limit(1);

    const activeSub = subs?.[0];
    if (activeSub) {
      const periodEnd = new Date(activeSub.current_period_end);
      if (periodEnd > new Date()) {
        const tier = inferTierFromPriceId(activeSub.price_id);
        return NextResponse.json({
          tier,
          hasFullAccess: true,
          subscriptionStatus: activeSub.status,
          currentPeriodEnd: activeSub.current_period_end,
        });
      }
    }

    // Check one-time purchase (Exam Season Pass)
    const today = new Date().toISOString().slice(0, 10);
    const { data: purchases } = await supabase
      .from("one_time_purchases")
      .select("access_until")
      .eq("user_id", user.id)
      .gte("access_until", today)
      .order("created_at", { ascending: false })
      .limit(1);

    const validPurchase = purchases?.[0];
    if (validPurchase) {
      const accessUntil = new Date(validPurchase.access_until + "T23:59:59");
      if (accessUntil >= new Date()) {
        return NextResponse.json({
          tier: "season_pass",
          hasFullAccess: true,
          accessUntil: validPurchase.access_until,
        });
      }
    }

    return NextResponse.json({
      tier: "free",
      hasFullAccess: false,
    });
  } catch (err) {
    console.error("[subscription/status]", err);
    return NextResponse.json({ tier: "free", hasFullAccess: false }, { status: 200 });
  }
}

function inferTierFromPriceId(priceId: string | null): "weekly" | "monthly" | "season_pass" | "free" {
  if (!priceId) return "free";
  const weekly = process.env.STRIPE_PRICE_WEEKLY;
  const monthly = process.env.STRIPE_PRICE_MONTHLY;
  if (priceId === weekly) return "weekly";
  if (priceId === monthly) return "monthly";
  return "free";
}
