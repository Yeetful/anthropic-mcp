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
