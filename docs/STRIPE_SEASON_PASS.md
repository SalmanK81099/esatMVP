# Exam Season Pass – One-Time Payment

This document describes how the Exam Season Pass (one-time payment) works and how the £/week calculations are done.

## Overview

The Exam Season Pass is a **one-time payment** that grants full access until the exam date (1 October 2026). It uses Stripe `mode: "payment"` instead of `mode: "subscription"`, and is tracked in the `one_time_purchases` table rather than `subscriptions`.

## How the One-Time Payment Flow Works

### 1. Checkout

1. User selects "Exam Season Pass" on the pricing page
2. `POST /api/stripe/create-checkout-session` is called with `planType: "season_pass"`
3. The API creates a Checkout session with `mode: "payment"` (not subscription)
4. The correct price ID is chosen server-side via `getSeasonPassPriceId()` based on **today's date**
5. User is redirected to Stripe Checkout and pays once

### 2. Webhook

1. After payment, Stripe sends `checkout.session.completed`
2. The webhook checks: `mode === "payment"` and `metadata.planType === "season_pass"`
3. It calls `upsertOneTimePurchase(session, EXAM_DATE)`
4. A row is inserted into `one_time_purchases` with:
   - `user_id` – from the customers table (lookup by Stripe customer ID)
   - `access_until` – `"2026-10-01"` (exam date)
   - `amount_paid`, `price_id`, `product_id`, etc.

### 3. Access Verification

- `GET /api/subscription/status` checks the `one_time_purchases` table
- It looks for rows where `user_id` matches and `access_until >= today`
- If found, it returns `tier: "season_pass"` and `hasFullAccess: true`
- Access ends automatically when `access_until` is in the past (no cancellation needed)

## Date-Based Price Selection

The price charged depends on **when** the user purchases:

| Purchase Date | Price | Environment Variable |
|---------------|-------|----------------------|
| Before 1 April 2026 | £74 | `STRIPE_PRICE_SEASON_74` |
| 1 April – 15 May 2026 | £84 | `STRIPE_PRICE_SEASON_84` |
| 16 May – 10 June 2026 | £94 | `STRIPE_PRICE_SEASON_94` |
| After 10 June 2026 | £94 | `STRIPE_PRICE_SEASON_94` |

Implementation in `src/lib/stripe/prices.ts`:

```ts
const SEASON_PASS_CUTOFFS = [
  { until: new Date("2026-04-01"), priceIdEnv: "STRIPE_PRICE_SEASON_74" },
  { until: new Date("2026-05-16"), priceIdEnv: "STRIPE_PRICE_SEASON_84" },
  { until: new Date("2026-06-10"), priceIdEnv: "STRIPE_PRICE_SEASON_94" },
];

for (const { until, priceIdEnv } of SEASON_PASS_CUTOFFS) {
  if (now < until) return process.env[priceIdEnv];
}
return process.env.STRIPE_PRICE_SEASON_94;  // fallback
```

## £/Week Calculations

### Weeks Until Exam

Exam date is fixed: **1 October 2026**.

```
weeks = ceil((examDate - now) / (7 days in ms))
```

Minimum 1 week to avoid division by zero.

### Per-Plan £/Week

| Plan | Calculation |
|------|-------------|
| Weekly | £8 (fixed) |
| Monthly | £25 ÷ 4 = £6.25 |
| Season Pass | `seasonPrice ÷ weeks` (varies by purchase date and time left) |

**Example:** If there are 32 weeks until the exam and the Season Pass is £74 today:
- Season Pass: £74 ÷ 32 ≈ **£2.31/week**
- Weekly: £8/week
- Monthly: £6.25/week  

So the Season Pass has the lowest £/week for longer prep periods.

### Best-Value Logic

In `src/lib/stripe/best-value.ts`:

1. Compute `pricePerWeek` for each paid plan (Weekly, Monthly, Season Pass)
2. Pick the plan with the **lowest** `pricePerWeek`
3. Special case: when `best.id === "season_pass"` and `weeks >= 17` (4+ months), show: *"If you plan to prepare for 4+ months, this will save you money."*

## Flow Diagram

```
User selects Exam Season Pass on pricing page
                    ↓
getSeasonPassPriceId() → selects price_74 / price_84 / price_94 based on today
                    ↓
Stripe Checkout (mode: "payment", one-time)
                    ↓
User pays
                    ↓
Webhook: checkout.session.completed
                    ↓
upsertOneTimePurchase() → INSERT into one_time_purchases
                    ↓
access_until = "2026-10-01"
                    ↓
Subscription status API checks one_time_purchases
                    ↓
tier = "season_pass", hasFullAccess = true
```

## Database: `one_time_purchases`

| Column | Purpose |
|--------|---------|
| `user_id` | Links to auth.users |
| `stripe_payment_intent_id` | Stripe payment reference |
| `price_id` | Which Stripe price was used |
| `product_id` | Stripe product |
| `amount_paid` | Amount in smallest currency unit (pence) |
| `currency` | e.g. "gbp" |
| `access_until` | Date access expires (exam date) |
| `created_at` | Purchase timestamp |

Access is valid while `access_until >= today`. No recurring billing or cancellation logic.
