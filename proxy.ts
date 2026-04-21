import { paymentMiddleware, type RouteConfig } from "x402-next";
import { config as appConfig, priceString } from "@/lib/config";

const routeConfig: RouteConfig = {
  price: priceString(),
  network: appConfig.network,
  config: {
    description:
      "Anthropic-backed MCP server over Streamable HTTP. Exposes ask_claude (single-prompt completion) and claude_chat (multi-turn) tools. Pay-per-call in USDC.",
    mimeType: "application/json",
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
            "For tools/call: { name: 'ask_claude' | 'claude_chat', arguments: {...} }. ask_claude takes { prompt, system?, model?, max_tokens? }. claude_chat takes { messages: [{role: 'user'|'assistant', content}], system?, model?, max_tokens? }.",
        },
      },
    },
    outputSchema: {
      type: "object",
      description:
        "MCP JSON-RPC 2.0 response. On tools/call success, result.content is an array of { type: 'text', text: string } blocks containing Claude's reply.",
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
  },
};

const routes = {
  "/api/mcp": routeConfig,
  "/api/mcp/*": routeConfig,
};

const facilitator = appConfig.facilitatorUrl
  ? { url: appConfig.facilitatorUrl as `${string}://${string}` }
  : undefined;

export const proxy = paymentMiddleware(
  appConfig.paymentAddress,
  routes,
  facilitator,
);
