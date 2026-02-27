-- Migration: Stripe subscriptions and one-time purchases
-- Description: Tables for Stripe product sync, customer mapping, subscriptions, and Exam Season Pass

-- ============================================================================
-- CUSTOMERS
-- Maps auth.users.id to Stripe customer_id. Private table, no user access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE NOT NULL
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- No policies: server-side only via service role

CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON customers(stripe_customer_id);

-- ============================================================================
-- PRODUCTS
-- Synced from Stripe via webhooks. Public read-only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  active boolean,
  name text,
  description text,
  image text,
  metadata jsonb
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access on products" ON products;
CREATE POLICY "Allow public read-only access on products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PRICES
-- Synced from Stripe via webhooks. Public read-only.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS prices (
  id text PRIMARY KEY,
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  active boolean,
  description text,
  unit_amount bigint,
  currency text CHECK (char_length(currency) = 3),
  type pricing_type,
  interval pricing_plan_interval,
  interval_count integer,
  trial_period_days integer,
  metadata jsonb
);

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access on prices" ON prices;
CREATE POLICY "Allow public read-only access on prices"
  ON prices FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- SUBSCRIPTION STATUS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'trialing', 'active', 'canceled', 'incomplete',
    'incomplete_expired', 'past_due', 'unpaid', 'paused'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SUBSCRIPTIONS
-- Synced from Stripe via webhooks. Users can view own.
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status subscription_status NOT NULL,
  metadata jsonb,
  price_id text REFERENCES prices(id),
  quantity integer,
  cancel_at_period_end boolean,
  created timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  ended_at timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================================
-- ONE-TIME PURCHASES (Exam Season Pass)
-- Track one-time purchases with access_until date.
-- ============================================================================

CREATE TABLE IF NOT EXISTS one_time_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  price_id text REFERENCES prices(id),
  product_id text REFERENCES products(id),
  amount_paid bigint NOT NULL,
  currency text NOT NULL DEFAULT 'gbp',
  access_until date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

ALTER TABLE one_time_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own one-time purchases" ON one_time_purchases;
CREATE POLICY "Users can view own one-time purchases"
  ON one_time_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_one_time_purchases_user_id ON one_time_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_one_time_purchases_access_until ON one_time_purchases(access_until);
