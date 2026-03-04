import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { stripe } from "./config";
import { toDateTime } from "./helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Product/Price types for webhook upserts
interface ProductRecord {
  id: string;
  active: boolean;
  name: string;
  description: string | null;
  image: string | null;
  metadata: Record<string, unknown> | null;
}

interface PriceRecord {
  id: string;
  product_id: string;
  active: boolean;
  currency: string;
  type: "one_time" | "recurring";
  unit_amount: number | null;
  interval: "day" | "week" | "month" | "year" | null;
  interval_count: number | null;
  trial_period_days: number | null;
}

interface SubscriptionRecord {
  id: string;
  user_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  price_id: string;
  quantity: number;
  cancel_at_period_end: boolean;
  created: string;
  current_period_start: string;
  current_period_end: string;
  ended_at: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
}

export const upsertProductRecord = async (product: Stripe.Product) => {
  const data: ProductRecord = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description ?? null,
    image: product.images?.[0] ?? null,
    metadata: product.metadata as Record<string, unknown> | null,
  };
  const { error } = await supabaseAdmin.from("products").upsert([data]);
  if (error) throw new Error(`Product upsert failed: ${error.message}`);
};

export const upsertPriceRecord = async (
  price: Stripe.Price,
  retryCount = 0,
  maxRetries = 3
): Promise<void> => {
  const data: PriceRecord = {
    id: price.id,
    product_id: typeof price.product === "string" ? price.product : price.product.id,
    active: price.active,
    currency: price.currency,
    type: price.type as "one_time" | "recurring",
    unit_amount: price.unit_amount ?? null,
    interval: (price.recurring?.interval as "day" | "week" | "month" | "year") ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? null,
  };
  const { error } = await supabaseAdmin.from("prices").upsert([data]);
  if (error?.message?.includes("foreign key")) {
    if (retryCount < maxRetries) {
      await new Promise((r) => setTimeout(r, 2000));
      return upsertPriceRecord(price, retryCount + 1, maxRetries);
    }
    throw new Error(`Price upsert failed after ${maxRetries} retries: ${error.message}`);
  }
  if (error) throw new Error(`Price upsert failed: ${error.message}`);
};

export const deleteProductRecord = async (product: Stripe.Product) => {
  const { error } = await supabaseAdmin.from("products").delete().eq("id", product.id);
  if (error) throw new Error(`Product delete failed: ${error.message}`);
};

export const deletePriceRecord = async (price: Stripe.Price) => {
  const { error } = await supabaseAdmin.from("prices").delete().eq("id", price.id);
  if (error) throw new Error(`Price delete failed: ${error.message}`);
};

export const createOrRetrieveCustomer = async (uuid: string, email: string) => {
  const { data: existing, error: queryError } = await supabaseAdmin
    .from("customers")
    .select("stripe_customer_id")
    .eq("id", uuid)
    .maybeSingle();

  if (queryError) throw new Error(`Customer lookup failed: ${queryError.message}`);

  let stripeCustomerId: string | undefined;
  if (existing?.stripe_customer_id) {
    const cust = await stripe.customers.retrieve(existing.stripe_customer_id);
    stripeCustomerId = cust.id;
  } else {
    const list = await stripe.customers.list({ email });
    stripeCustomerId = list.data[0]?.id;
  }

  if (!stripeCustomerId) {
    const newCustomer = await stripe.customers.create({
      email,
      metadata: { supabaseUUID: uuid },
    });
    stripeCustomerId = newCustomer.id;
  }

  const { error: upsertError } = await supabaseAdmin.from("customers").upsert(
    [{ id: uuid, stripe_customer_id: stripeCustomerId }],
    { onConflict: "id" }
  );
  if (upsertError) throw new Error(`Customer upsert failed: ${upsertError.message}`);

  return stripeCustomerId;
};

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction = false
) => {
  const { data: customerData, error: custError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  if (custError || !customerData) throw new Error("Customer lookup failed");

  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"],
  });
  const firstItem = sub.items.data[0];
  const priceId = typeof firstItem?.price === "string" ? firstItem.price : firstItem?.price?.id;
  if (!priceId || !firstItem) throw new Error("No price on subscription");

  // Ensure price (and product) exist before subscription upsert - they may not have been synced yet
  // (e.g. created in Stripe Dashboard before webhook, or subscription event arrived before price event)
  const priceObj = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const productId = typeof priceObj.product === "string" ? priceObj.product : priceObj.product?.id;
  if (productId) {
    const productObj =
      typeof priceObj.product === "object" ? priceObj.product : await stripe.products.retrieve(productId);
    await upsertProductRecord(productObj as Stripe.Product);
  }
  await upsertPriceRecord(priceObj);

  const data: SubscriptionRecord = {
    id: sub.id,
    user_id: customerData.id,
    status: sub.status,
    metadata: sub.metadata as Record<string, unknown> | null,
    price_id: priceId,
    quantity: firstItem.quantity ?? 1,
    cancel_at_period_end: sub.cancel_at_period_end,
    created: toDateTime(sub.created).toISOString(),
    current_period_start: toDateTime(firstItem.current_period_start).toISOString(),
    current_period_end: toDateTime(firstItem.current_period_end).toISOString(),
    ended_at: sub.ended_at ? toDateTime(sub.ended_at).toISOString() : null,
    cancel_at: sub.cancel_at ? toDateTime(sub.cancel_at).toISOString() : null,
    canceled_at: sub.canceled_at ? toDateTime(sub.canceled_at).toISOString() : null,
    trial_start: sub.trial_start ? toDateTime(sub.trial_start).toISOString() : null,
    trial_end: sub.trial_end ? toDateTime(sub.trial_end).toISOString() : null,
  };

  const { error } = await supabaseAdmin.from("subscriptions").upsert([data], {
    onConflict: "id",
  });
  if (error) throw new Error(`Subscription upsert failed: ${error.message}`);
};

const EXAM_DATE = new Date("2026-10-01");

export const upsertOneTimePurchase = async (
  session: Stripe.Checkout.Session,
  accessUntil: Date = EXAM_DATE
) => {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) return;

  const { data: customerData, error: custError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  if (custError || !customerData) return;

  const lineItem = session.line_items?.data?.[0];
  const priceId = lineItem?.price?.id;
  const productId = typeof lineItem?.price?.product === "string"
    ? lineItem.price.product
    : lineItem?.price?.product?.id;
  const amount = lineItem?.amount_total ?? 0;
  const currency = (lineItem?.currency ?? "gbp").toLowerCase();

  await supabaseAdmin.from("one_time_purchases").insert({
    user_id: customerData.id,
    stripe_payment_intent_id: session.payment_intent as string | null,
    price_id: priceId ?? null,
    product_id: productId ?? null,
    amount_paid: amount,
    currency,
    access_until: accessUntil.toISOString().slice(0, 10),
    metadata: session.metadata as Record<string, unknown> | null,
  });
};
