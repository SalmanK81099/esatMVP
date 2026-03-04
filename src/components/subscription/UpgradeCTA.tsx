"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Crown } from "lucide-react";

interface UpgradeCTAProps {
  feature?: string;
  className?: string;
}

export function UpgradeCTA({ feature, className = "" }: UpgradeCTAProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-6 text-center ${className}`}
    >
      <Crown className="w-10 h-10 text-primary mx-auto mb-3 opacity-80" />
      <h3 className="font-semibold text-text mb-1">Upgrade for full access</h3>
      <p className="text-sm text-text-muted mb-4 max-w-sm mx-auto">
        {feature
          ? `Unlock ${feature} and everything else with a paid plan.`
          : "Get full access to past papers, mental maths, question bank, solutions, and more."}
      </p>
      <Link href="/pricing">
        <Button variant="primary">View plans</Button>
      </Link>
    </div>
  );
}
