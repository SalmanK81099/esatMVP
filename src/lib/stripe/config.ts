import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY ?? "";

if (!secretKey) {
  console.warn("[Stripe] STRIPE_SECRET_KEY not set - payment features will not work");
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-02-25.clover",
  appInfo: {
    name: "ESAT MVP",
    version: "0.1.0",
  },
});
