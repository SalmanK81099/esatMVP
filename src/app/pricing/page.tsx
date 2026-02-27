"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSupabaseSession } from "@/components/auth/SupabaseSessionProvider";
import { useSubscription } from "@/hooks/useSubscription";
import {
  getBestValuePlan,
  getPlanComparisons,
  getWeeksUntilExam,
  getSeasonPassPrice,
  type PlanId,
} from "@/lib/stripe/best-value";
import { Check, Zap, Crown, ArrowRight } from "lucide-react";

const FEATURES = {
  free: [
    "Mental maths: Addition module only",
    "Past papers: First 3 roadmap items",
    "Question Bank: 10 free questions",
    "No solutions or stats overview",
    "No drills / flashcard mode",
  ],
  paid: [
    "Full mental maths access",
    "Full roadmap & past papers",
    "Unlimited Question Bank",
    "Solutions & stats overview",
    "Drills & flashcard mode",
  ],
};

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSupabaseSession();
  const { tier } = useSubscription();
  const [weeksInput, setWeeksInput] = useState<number | "">("");
  const [loading, setLoading] = useState<string | null>(null);

  const weeksUntilExam = getWeeksUntilExam();
  const weeks = typeof weeksInput === "number" ? weeksInput : weeksUntilExam;
  const { plan: bestPlan, reason } = getBestValuePlan(weeks);
  const comparisons = getPlanComparisons(weeks);
  const seasonPrice = getSeasonPassPrice();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      router.replace("/pricing");
      window.history.replaceState({}, "", "/pricing");
    }
  }, [searchParams, router]);

  const handleCheckout = async (planType: PlanId) => {
    if (planType === "free") return;
    if (!session?.user) {
      router.push("/login?redirect=/pricing");
      return;
    }
    setLoading(planType);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error ?? "Failed");
    } catch (err) {
      console.error(err);
      setLoading(null);
    }
  };

  return (
    <Container size="xl" className="py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-text mb-2">Choose your plan</h1>
        <p className="text-text-muted max-w-xl mx-auto">
          Prepare for ESAT / TMUA. Full access to past papers, mental maths, and
          question bank.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <label className="text-sm text-text-muted">
            I&apos;m preparing for
          </label>
          <input
            type="number"
            min={1}
            max={52}
            placeholder={`${weeksUntilExam} weeks`}
            value={weeksInput === "" ? "" : weeksInput}
            onChange={(e) => {
              const v = e.target.value;
              setWeeksInput(v === "" ? "" : Math.max(1, parseInt(v, 10) || 1));
            }}
            className="w-24 px-3 py-2 rounded-lg bg-surface border border-border text-text"
          />
          <span className="text-sm text-text-muted">weeks</span>
        </div>
        {weeks >= 17 && (
          <p className="mt-4 text-primary font-medium flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            {reason}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Free */}
        <Card
          variant="flat"
          className="p-6 flex flex-col"
        >
          <div className="font-semibold text-text mb-1">Free</div>
          <div className="text-2xl font-bold text-text mb-4">£0</div>
          <ul className="space-y-2 text-sm text-text-muted flex-1 mb-6">
            {FEATURES.free.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="w-full" disabled>
            {tier === "free" ? "Current plan" : "Downgrade via profile"}
          </Button>
        </Card>

        {/* Weekly */}
        <Card
          variant={bestPlan === "weekly" ? "elevated" : "default"}
          className={`p-6 flex flex-col relative ${bestPlan === "weekly" ? "ring-2 ring-primary" : ""}`}
        >
          {bestPlan === "weekly" && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded">
              Best value
            </div>
          )}
          <div className="font-semibold text-text mb-1">Weekly</div>
          <div className="text-2xl font-bold text-text mb-1">£8</div>
          <div className="text-sm text-text-muted mb-4">per week</div>
          <ul className="space-y-2 text-sm text-text-muted flex-1 mb-6">
            {FEATURES.paid.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            variant={tier === "weekly" ? "secondary" : "primary"}
            className="w-full"
            onClick={() => handleCheckout("weekly")}
            disabled={!!loading || tier === "weekly"}
          >
            {loading === "weekly" ? "Loading…" : tier === "weekly" ? "Current plan" : "Subscribe"}
          </Button>
        </Card>

        {/* Monthly */}
        <Card
          variant={bestPlan === "monthly" ? "elevated" : "default"}
          className={`p-6 flex flex-col relative ${bestPlan === "monthly" ? "ring-2 ring-primary" : ""}`}
        >
          {bestPlan === "monthly" && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded">
              Best value
            </div>
          )}
          <div className="font-semibold text-text mb-1">Monthly</div>
          <div className="text-2xl font-bold text-text mb-1">£25</div>
          <div className="text-sm text-text-muted mb-4">£6.25/week</div>
          <ul className="space-y-2 text-sm text-text-muted flex-1 mb-6">
            {FEATURES.paid.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            variant={tier === "monthly" ? "secondary" : "primary"}
            className="w-full"
            onClick={() => handleCheckout("monthly")}
            disabled={!!loading || tier === "monthly"}
          >
            {loading === "monthly" ? "Loading…" : tier === "monthly" ? "Current plan" : "Subscribe"}
          </Button>
        </Card>

        {/* Exam Season Pass */}
        <Card
          variant={bestPlan === "season_pass" ? "elevated" : "default"}
          className={`p-6 flex flex-col relative ${bestPlan === "season_pass" ? "ring-2 ring-primary" : ""}`}
        >
          {bestPlan === "season_pass" && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded flex items-center gap-1">
              <Crown className="w-3 h-3" /> Best value
            </div>
          )}
          <div className="font-semibold text-text mb-1">Exam Season Pass</div>
          <div className="text-2xl font-bold text-text mb-1">£{seasonPrice}</div>
          <div className="text-sm text-text-muted mb-4">
            one-time · access until exam (Oct 2026)
          </div>
          <div className="text-xs text-text-muted mb-2">
            ≈ £{(seasonPrice / weeks).toFixed(1)}/week
          </div>
          <ul className="space-y-2 text-sm text-text-muted flex-1 mb-6">
            {FEATURES.paid.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            variant={tier === "season_pass" ? "secondary" : "primary"}
            className="w-full"
            onClick={() => handleCheckout("season_pass")}
            disabled={!!loading || tier === "season_pass"}
          >
            {loading === "season_pass" ? "Loading…" : tier === "season_pass" ? "Current plan" : "Get access"}
          </Button>
        </Card>
      </div>

      <div className="mt-12 text-center">
        {!session?.user ? (
          <p className="text-text-muted text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to subscribe. Already have access?{" "}
            <Link href="/profile" className="text-primary hover:underline inline-flex items-center gap-1">
              Manage subscription <ArrowRight className="w-4 h-4" />
            </Link>
          </p>
        ) : (
          <p className="text-text-muted text-sm">
            <Link href="/profile" className="text-primary hover:underline inline-flex items-center gap-1">
              Manage subscription <ArrowRight className="w-4 h-4" />
            </Link>
          </p>
        )}
      </div>
    </Container>
  );
}
