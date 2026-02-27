/**
 * Exam Season Pass price selection based on purchase date
 * Now - 1 April: £74
 * 1 April - 15 May: £84
 * 16 May - 10 June: £94
 */

const SEASON_PASS_CUTOFFS = [
  { until: new Date("2026-04-01"), priceIdEnv: "STRIPE_PRICE_SEASON_74" },
  { until: new Date("2026-05-16"), priceIdEnv: "STRIPE_PRICE_SEASON_84" },
  { until: new Date("2026-06-10"), priceIdEnv: "STRIPE_PRICE_SEASON_94" },
] as const;

export function getSeasonPassPriceId(): string | null {
  const now = new Date();
  for (const { until, priceIdEnv } of SEASON_PASS_CUTOFFS) {
    if (now < until) {
      return process.env[priceIdEnv] ?? null;
    }
  }
  return null;
}

export function getPriceIdForPlan(planType: "weekly" | "monthly" | "season_pass"): string | null {
  switch (planType) {
    case "weekly":
      return process.env.STRIPE_PRICE_WEEKLY ?? null;
    case "monthly":
      return process.env.STRIPE_PRICE_MONTHLY ?? null;
    case "season_pass":
      return getSeasonPassPriceId();
    default:
      return null;
  }
}
