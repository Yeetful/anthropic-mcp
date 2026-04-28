import type { Network } from "x402-next";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  // Default to Haiku 4.5 — its per-token cost (~$1 in / $5 out per million)
  // is what makes a $0.01 flat charge sustainable. Switching to Sonnet or
  // Opus without raising the price will lose money on every call.
  defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL ?? "claude-haiku-4-5",
  // No fallback address — fail loudly if PAYMENT_ADDRESS isn't set so
  // misconfigured deploys don't silently route USDC to someone else's wallet.
  paymentAddress: required("PAYMENT_ADDRESS") as `0x${string}`,
  network: (process.env.X402_NETWORK ?? "base") as Network,
  priceUsd: process.env.X402_PRICE_USD ?? "0.01",
  // CDP credentials are read directly by `@coinbase/x402`'s `facilitator` export
  // from process.env.CDP_API_KEY_ID / CDP_API_KEY_SECRET — exposed here only
  // for validation / debug surfaces.
  cdpApiKeyId: process.env.CDP_API_KEY_ID,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
} as const;

export function priceString(): `$${string}` {
  return `$${config.priceUsd}`;
}
