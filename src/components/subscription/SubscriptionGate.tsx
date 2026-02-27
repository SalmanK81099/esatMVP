"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeCTA } from "./UpgradeCTA";

type FeatureKey = "roadmap" | "question_bank" | "mental_maths" | "drill" | "solutions" | "analytics";

interface SubscriptionGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  roadmap: "the full roadmap",
  question_bank: "unlimited questions",
  mental_maths: "all mental maths modules",
  drill: "drill mode",
  solutions: "solutions and stats",
  analytics: "analytics",
};

export function SubscriptionGate({ feature, children, fallback }: SubscriptionGateProps) {
  const { hasFullAccess, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg bg-surface-subtle h-24" />
    );
  }

  if (!hasFullAccess) {
    if (fallback) return <>{fallback}</>;
    return <UpgradeCTA feature={FEATURE_LABELS[feature]} />;
  }

  return <>{children}</>;
}
