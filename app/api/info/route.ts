import { NextResponse } from "next/server";
import { config, priceString } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    name: "anthropic-mcp",
    mcpEndpoint: "/api/mcp/mcp",
    payment: {
      network: config.network,
      priceUsd: priceString(),
      payTo: config.paymentAddress,
      protocol: "x402",
      asset: "USDC",
      facilitator:
        config.cdpApiKeyId && config.cdpApiKeySecret
          ? "coinbase-cdp"
          : "x402.org-public",
      // Whether this deployment is wired up to be indexed by Bazaar /
      // agent.market. Requires CDP creds + Base mainnet (CAIP-2 eip155:8453).
      bazaarIndexable:
        Boolean(config.cdpApiKeyId && config.cdpApiKeySecret) &&
        config.network === "eip155:8453",
    },
    tools: [
      {
        name: "ask_claude",
        description: "Single-prompt Claude inference.",
      },
      {
        name: "claude_chat",
        description: "Multi-turn Claude chat.",
      },
    ],
  });
}
