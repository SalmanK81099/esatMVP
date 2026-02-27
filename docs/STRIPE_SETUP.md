# Stripe Payment Integration

This document describes how Stripe subscriptions and one-time payments work in ESAT MVP, and how to set everything up.

## Overview

The app supports four tiers:

| Tier | Price | Billing | Features |
|------|-------|---------|----------|
| **Free** | £0 | - | Mental maths (addition only), first 3 roadmap items, 10 question bank questions, no solutions/stats/drills |
| **Weekly** | £8/week | Recurring | Full access |
| **Monthly** | £25/month | Recurring | Full access (£6.25/week) |
| **Exam Season Pass** | £74–£94 | One-time | Full access until exam (1 Oct 2026), price varies by purchase date |

For details on the Exam Season Pass flow, date-based pricing, and £/week calculations, see [STRIPE_SEASON_PASS.md](./STRIPE_SEASON_PASS.md).

### Exam Season Pass pricing (by purchase date)

- **Now – 1 April**: £74
- **1 April – 15 May**: £84
- **16 May – 10 June**: £94

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   Pricing   │────▶│ POST /api/stripe/     │────▶│   Stripe    │
│   Page      │     │ create-checkout-session│     │   Checkout  │
└─────────────┘     └──────────────────────┘     └─────────────┘
       │                         │                        │
       │                         │                        │
       ▼                         ▼                        ▼
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│ useSubscr.  │◀────│ GET /api/subscription │     │  Webhooks   │
│ hook        │     │ /status               │     │  → Supabase │
└─────────────┘     └──────────────────────┘     └─────────────┘
       │                         │                        │
       │                         ▼                        ▼
       │                 ┌──────────────────┐     ┌─────────────┐
       └────────────────│   Supabase       │◀────│ products,   │
                         │ subscriptions,  │     │ prices,     │
                         │ customers       │     │ subscriptions│
                         └──────────────────┘     └─────────────┘
```

## File Structure

| Path | Purpose |
|------|---------|
| `src/lib/stripe/config.ts` | Stripe client initialization |
| `src/lib/stripe/prices.ts` | Date-based price selection for Exam Season Pass |
| `src/lib/stripe/best-value.ts` | Best-value plan calculation (£/week) |
| `src/lib/stripe/supabase-admin.ts` | Customer creation, webhook handlers (product/price/subscription upsert) |
| `src/app/api/stripe/create-checkout-session/route.ts` | Creates Stripe Checkout session |
| `src/app/api/stripe/create-portal-link/route.ts` | Creates Stripe Customer Portal session |
| `src/app/api/webhooks/route.ts` | Stripe webhook handler |
| `src/app/api/subscription/status/route.ts` | Returns user's tier and full-access flag |
| `src/hooks/useSubscription.ts` | Client hook for subscription status |
| `src/app/pricing/page.tsx` | Pricing page with best-value logic |

## Setup

### 1. Environment Variables

Add to `.env.local`:

```env
# Stripe (required for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Stripe Price IDs (from Dashboard, after creating products)
STRIPE_PRICE_WEEKLY=price_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_SEASON_74=price_...
STRIPE_PRICE_SEASON_84=price_...
STRIPE_PRICE_SEASON_94=price_...
```

### 2. Supabase Migration

Run the Stripe migration to create the required tables:

```bash
supabase db push
```

Or run the SQL manually from `supabase/migrations/20260226000000_stripe_subscriptions.sql` in the Supabase SQL Editor.

**Tables created:**

- `customers` – Maps `auth.users.id` to `stripe_customer_id`
- `products` – Synced from Stripe (id, name, active, image)
- `prices` – Synced from Stripe (id, product_id, unit_amount, interval, etc.)
- `subscriptions` – User subscriptions (status, price_id, current_period_end)
- `one_time_purchases` – Exam Season Pass purchases (access_until)

### 3. Stripe Dashboard – Products and Prices

Create the following in [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products):

**Product: ESAT Weekly**

- Price: £8, recurring, every week

**Product: ESAT Monthly**

- Price: £25, recurring, every month

**Product: Exam Season Pass**

- Price 1: £74 one-time
- Price 2: £84 one-time
- Price 3: £94 one-time

Copy each Price ID (e.g. `price_1ABC...`) into the matching env var.

### 4. Stripe Webhook

1. Go to [Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Add endpoint: `https://your-domain.com/api/webhooks`
3. Select events:
   - `product.created`, `product.updated`, `product.deleted`
   - `price.created`, `price.updated`, `price.deleted`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `checkout.session.completed`
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 5. Customer Portal

1. Go to [Settings → Billing → Customer portal](https://dashboard.stripe.com/test/settings/billing/portal)
2. Enable: Update payment methods, Update subscriptions, Cancel subscriptions
3. Add the products/prices you want customers to manage
4. Set business information and links

### 6. Local Development – Webhooks

Stripe cannot call `localhost` directly. Use the Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks
```

This prints a signing secret (e.g. `whsec_...`). Set `STRIPE_WEBHOOK_SECRET` to this value in `.env.local` for local testing.

## How It Works

### Checkout Flow

1. User clicks a plan on the pricing page
2. `POST /api/stripe/create-checkout-session` creates a Stripe Checkout session
3. User is redirected to Stripe Checkout
4. After payment, Stripe redirects to `NEXT_PUBLIC_SITE_URL/pricing?success=true`
5. Stripe sends webhooks; we sync subscription or one-time purchase to Supabase

### Webhook Flow

- **product/price events**: Upsert or delete in `products` and `prices` tables
- **checkout.session.completed** (subscription): Create/update subscription in `subscriptions`
- **checkout.session.completed** (payment, Exam Season Pass): Insert into `one_time_purchases` with `access_until` = exam date
- **customer.subscription.***: Upsert `subscriptions`; if the price doesn't exist yet, we fetch it from Stripe and upsert it first

### Subscription Status

`GET /api/subscription/status` returns:

- `tier`: `"free"` | `"weekly"` | `"monthly"` | `"season_pass"`
- `hasFullAccess`: `true` if the user can access all features

Tier is inferred from the subscription `price_id` using the env vars.

### Feature Gating

- **Roadmap**: Free users see first 3 items; paid users see full roadmap
- **Mental maths**: Free users see addition only; paid see all modules
- **Past papers drill**: Blocked for free; `SubscriptionGate` shows upgrade CTA
- **Question bank**: 10 free questions; solutions gated for free
- **SubscriptionGate**: Wraps paid features and shows `UpgradeCTA` when `!hasFullAccess`

### Manage Subscription

- Profile page: "Manage subscription" opens Stripe Customer Portal
- Navbar: "Pricing" link for quick access

## Best Value Logic

On the pricing page, users can enter "I'm preparing for X weeks". The app then:

1. Computes £/week for each plan
2. Marks the plan with lowest £/week as "Best value"
3. Shows: "If you plan to prepare for 4+ months, this will save you money" for Exam Season Pass when weeks ≥ 17

## Troubleshooting

### Webhook returns 400 – "Subscription upsert failed: foreign key constraint"

The subscription referenced a `price_id` that didn't exist in our `prices` table. The webhook handler now fetches and upserts the price (and product) from Stripe before upserting the subscription. Ensure products and prices are created in Stripe and that the webhook is receiving `price.created`/`price.updated` events.

### "Current plan" shows Free when I have a subscription

- Check `STRIPE_PRICE_WEEKLY` and `STRIPE_PRICE_MONTHLY` match the price IDs in your subscriptions
- Ensure `GET /api/subscription/status` returns the correct tier for your user

### Webhooks not firing locally

- Run `stripe listen --forward-to localhost:3000/api/webhooks`
- Use the printed signing secret for `STRIPE_WEBHOOK_SECRET`
- Keep the CLI running while testing checkout

### Test Cards

Use [Stripe test cards](https://stripe.com/docs/testing#cards) for checkout testing, e.g. `4242 4242 4242 4242`.
