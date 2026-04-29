import { paymentMiddleware, type RoutesConfig } from "x402-next";
import { facilitator as cdpFacilitator } from "@coinbase/x402";
import { config as appConfig, priceString } from "@/lib/config";

/**
 * x402 payment gating for the MCP endpoint.
 *
 * `discoverable: true` opts each route into Coinbase's Bazaar discovery layer,
 * which is what surfaces the agent on agent.market. Bazaar only indexes
 * services settled through the CDP facilitator on Base mainnet.
 *
 * The CDP `facilitator` import reads CDP_API_KEY_ID and CDP_API_KEY_SECRET
 * from env at request time. In tests / local dev without those creds, fall
 * back to the public x402.org facilitator (testnet-only, NOT indexed by
 * Bazaar).
 *
 * `inputSchema` and `outputSchema` describe the MCP JSON-RPC envelope so
 * Bazaar / agent.market can render a richer listing. They reflect the
 * locked-down tool surface — neither `model` nor `max_tokens` is accepted
 * from clients (server enforces Haiku 4.5 + 256 output tokens).
 */
const sharedConfig = {
  description:
    "Yeetful — Anthropic Claude Haiku 4.5 inference over MCP Streamable HTTP, hosted at anthropic.yeetful.com. Exposes ask_claude (single-prompt completion) and claude_chat (multi-turn) tools, capped at 256 output tokens per call. Pay-per-call in USDC on Base. Operated by yeetful.com. Keywords: yeetful, anthropic, claude, haiku, mcp, x402, inference, llm.",
  mimeType: "application/json",
  maxTimeoutSeconds: 60,
  discoverable: true,
  inputSchema: {
    bodyType: "json",
    bodyFields: {
      jsonrpc: { type: "string", const: "2.0" },
      id: { type: ["string", "number"] },
      method: {
        type: "string",
        enum: ["initialize", "tools/list", "tools/call"],
        description: "MCP JSON-RPC method.",
      },
      params: {
        type: "object",
        description:
          "For tools/call: { name: 'ask_claude' | 'claude_chat', arguments: {...} }. ask_claude takes { prompt, system? }. claude_chat takes { messages: [{role: 'user'|'assistant', content}], system? }. Model and max_tokens are server-controlled and not accepted from the client.",
      },
    },
  },
  outputSchema: {
    type: "object",
    description:
      "MCP JSON-RPC 2.0 response. On tools/call success, result.content is an array of { type: 'text', text: string } blocks containing Claude's reply (≤256 output tokens).",
    properties: {
      jsonrpc: { type: "string", const: "2.0" },
      id: { type: ["string", "number"] },
      result: {
        type: "object",
        properties: {
          content: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text"] },
                text: { type: "string" },
              },
              required: ["type", "text"],
            },
          },
        },
      },
      error: {
        type: "object",
        properties: {
          code: { type: "number" },
          message: { type: "string" },
        },
      },
    },
  },
} as const;

const routes: RoutesConfig = {
  "/api/mcp": {
    price: priceString(),
    network: appConfig.network,
    config: sharedConfig,
  },
  "/api/mcp/*": {
    price: priceString(),
    network: appConfig.network,
    config: sharedConfig,
  },
};

const facilitator = appConfig.cdpApiKeyId && appConfig.cdpApiKeySecret
  ? cdpFacilitator
  : undefined;

export const proxy = paymentMiddleware(
  appConfig.paymentAddress,
  routes,
  facilitator,
);

// Limit proxy execution to the MCP transport routes so the homepage,
// /api/info, and other public surfaces remain free.
export const config = {
  matcher: ["/api/mcp/:path*"],
};
