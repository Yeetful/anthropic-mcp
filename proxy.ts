import { paymentProxy, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator as cdpFacilitator } from "@coinbase/x402";
import { config as appConfig, priceString } from "@/lib/config";

/**
 * x402 **v2** payment gating for the MCP endpoint (migrated off x402-next v1,
 * which only spoke v2's predecessor and failed agentic.market / Bazaar
 * discovery validation).
 *
 * v2 emits: x402Version 2, a top-level `resource` object, `amount` (not
 * `maxAmountRequired`), the challenge in a base64 `PAYMENT-REQUIRED` response
 * header, and — because the route declares `extensions.bazaar` — a top-level
 * `extensions.bazaar` discovery block.
 *
 * Bazaar only indexes services settled through the CDP facilitator on Base
 * mainnet, so we use `@coinbase/x402`'s `facilitator` (reads CDP_API_KEY_ID /
 * CDP_API_KEY_SECRET) when configured, and fall back to the public x402.org
 * facilitator (testnet, not indexed) for local dev.
 */

const description =
  "Yeetful — Anthropic Claude Haiku 4.5 inference over MCP Streamable HTTP, hosted at anthropic.yeetful.com. Exposes ask_claude (single-prompt completion) and claude_chat (multi-turn) tools, capped at 256 output tokens per call. Pay-per-call in USDC on Base. Operated by yeetful.com. Keywords: yeetful, anthropic, claude, haiku, mcp, x402, inference, llm.";

// Bazaar discovery block (top-level extensions.bazaar). `info` summarizes how an
// agent calls the endpoint + an example output; `schema` is the JSON Schema for
// the MCP JSON-RPC envelope. Model + max_tokens are server-controlled.
// `info` is a concrete example pair; `schema` describes the shape of `info`
// (the HTTP-invocation envelope), and the middleware validates info against it —
// so the two must agree. The rich MCP semantics live in `description`.
const bazaar = {
  info: {
    input: {
      type: "http",
      method: "POST",
      bodyType: "json",
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "ask_claude", arguments: { prompt: "What is the capital of France?" } },
      },
    },
    output: {
      type: "json",
      example: {
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ type: "text", text: "The capital of France is Paris." }] },
      },
    },
  },
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      input: {
        type: "object",
        properties: {
          type: { type: "string", const: "http" },
          method: { type: "string", enum: ["POST"] },
          bodyType: { type: "string", const: "json" },
          body: {
            type: "object",
            description:
              "MCP JSON-RPC 2.0 request. tools/call uses params { name: 'ask_claude' | 'claude_chat', arguments }. ask_claude takes { prompt, system? }; claude_chat takes { messages: [{role,content}], system? }. model + max_tokens are server-controlled.",
          },
        },
        required: ["type", "method"],
        additionalProperties: true,
      },
      output: {
        type: "object",
        properties: {
          type: { type: "string", const: "json" },
          example: { type: "object", additionalProperties: true },
        },
        required: ["type"],
        additionalProperties: true,
      },
    },
    required: ["input"],
  },
} as const;

const routes = {
  // Named param (matches the Next [transport] segment) → cleaner Bazaar
  // discovery metadata than a bare wildcard.
  "/api/mcp/:transport": {
    accepts: {
      scheme: "exact",
      price: priceString(),
      network: appConfig.network,
      payTo: appConfig.paymentAddress,
      maxTimeoutSeconds: 60,
    },
    description,
    mimeType: "application/json",
    extensions: { bazaar },
  },
};

const cdpReady = !!appConfig.cdpApiKeyId && !!appConfig.cdpApiKeySecret;
const facilitatorClient = new HTTPFacilitatorClient(
  cdpReady ? cdpFacilitator : { url: "https://x402.org/facilitator" },
);

const server = new x402ResourceServer(facilitatorClient).register(
  appConfig.network,
  new ExactEvmScheme(),
);

// syncFacilitatorOnStart=true (default): v2 fetches the facilitator's supported
// kinds via initialize() before it can emit the challenge for exact/<network>.
export const proxy = paymentProxy(routes, server);

// Gate only the MCP transport routes; homepage and /api/info stay free.
export const config = {
  matcher: ["/api/mcp/:path*"],
};
