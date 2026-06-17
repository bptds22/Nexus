// SERVER-ONLY — Stripe SDK singleton.
// Shared by checkout + webhook routes. Never import client-side.

import Stripe from "stripe";

let instance: Stripe | null = null;

export function getStripe(): Stripe {
  if (instance) return instance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  instance = new Stripe(key, {
    typescript: true,
  });

  return instance;
}
