import type { Network } from "@x402/core/types";

// x402 v2 uses CAIP-2 network ids. Map legacy v1 names for back-compat so an
// existing X402_NETWORK=base / base-sepolia keeps working.
function toCaip2(n: string): Network {
  const map: Record<string, string> = {
    base: "eip155:8453",
    "base-sepolia": "eip155:84532",
  };
  return (map[n] ?? n) as Network;
}

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
  // is what makes a half-cent flat charge sustainable: worst case is
  // ~$0.0063/call (5K-token input cap $0.005 + 256-token output cap $0.0013),
  // typical chat-sized calls run $0.002–0.003. Switching to Sonnet or Opus
  // without raising the price will lose money on every call.
  defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL ?? "claude-haiku-4-5",
  // No fallback address — fail loudly if PAYMENT_ADDRESS isn't set so
  // misconfigured deploys don't silently route USDC to someone else's wallet.
  paymentAddress: required("PAYMENT_ADDRESS") as `0x${string}`,
  network: toCaip2(process.env.X402_NETWORK ?? "base"),
  // Human-readable network name (e.g. "base"). The CAIP-2 `network` above is
  // what x402 puts on the wire; this is the human name Yeetful earn-tracking
  // wants for `reportUsage({ network })`.
  networkName: process.env.X402_NETWORK ?? "base",
  priceUsd: process.env.X402_PRICE_USD ?? "0.005",
  // Yeetful earn-tracking (optional): when BOTH are set, every settled payment
  // is reported to your Yeetful dashboard so earnings show up. Unset = the
  // server still runs, just un-tracked.
  yeetfulApiKey: process.env.YEETFUL_API_KEY,
  yeetfulMcpSlug: process.env.YEETFUL_MCP_SLUG,
  // CDP credentials are read directly by `@coinbase/x402`'s `facilitator` export
  // from process.env.CDP_API_KEY_ID / CDP_API_KEY_SECRET — exposed here only
  // for validation / debug surfaces.
  cdpApiKeyId: process.env.CDP_API_KEY_ID,
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET,
} as const;

export function priceString(): `$${string}` {
  return `$${config.priceUsd}`;
}
