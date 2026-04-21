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
  defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL ?? "claude-sonnet-4-6",
  paymentAddress: (process.env.PAYMENT_ADDRESS ??
    "0x66268791B55e1F5fA585D990326519F101407257") as `0x${string}`,
  network: (process.env.X402_NETWORK ?? "base") as Network,
  priceUsd: process.env.X402_PRICE_USD ?? "0.01",
  facilitatorUrl: process.env.X402_FACILITATOR_URL,
} as const;

export function priceString(): `$${string}` {
  return `$${config.priceUsd}`;
}
