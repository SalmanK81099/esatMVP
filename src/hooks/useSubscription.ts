"use client";

import { useState, useEffect } from "react";

export type SubscriptionTier = "free" | "weekly" | "monthly" | "season_pass";

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  hasFullAccess: boolean;
  isLoading: boolean;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  accessUntil?: string;
}

export function useSubscription(): SubscriptionStatus {
  const [state, setState] = useState<SubscriptionStatus>({
    tier: "free",
    hasFullAccess: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/subscription/status");
        const data = await res.json();
        if (!mounted) return;
        setState({
          tier: data.tier ?? "free",
          hasFullAccess: data.hasFullAccess ?? false,
          isLoading: false,
          subscriptionStatus: data.subscriptionStatus,
          currentPeriodEnd: data.currentPeriodEnd,
          accessUntil: data.accessUntil,
        });
      } catch {
        if (mounted) {
          setState({ tier: "free", hasFullAccess: false, isLoading: false });
        }
      }
    }

    fetchStatus();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
