import { AsyncLocalStorage } from "node:async_hooks";
import type { NextRequest } from "next/server";
import { paymentProxy, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator as cdpFacilitator } from "@coinbase/x402";
import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402/extensions/bazaar";
import { reportUsage } from "yeetful/server";
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

// Bazaar discovery block — built with the SDK's canonical MCP shape
// (declareDiscoveryExtension → { bazaar: { info: { input: { type: "mcp",
// toolName, inputSchema, … } }, schema } }).
//
// The previous hand-rolled version used the HTTP/body discovery shape
// (type:"http", method, body) for an MCP resource: the Bazaar indexer didn't
// recognize it, rendered the extension as `{}`, and flagged
// "INPUT SCHEMA PRESENT: no". `inputSchema` here is the JSON Schema of the
// TOOL'S arguments — exactly the field the validator checks. One tool per
// discovery block; ask_claude is the primary surface (claude_chat is
// described in `description`). Model + max_tokens stay server-controlled.
// Returns the already-keyed record: { bazaar: { info, schema } }.
const discovery = declareDiscoveryExtension({
  toolName: "ask_claude",
  description:
    "Single-prompt Claude Haiku 4.5 completion (≤256 output tokens). A multi-turn claude_chat tool is also exposed on the same endpoint. Model and max_tokens are server-controlled.",
  transport: "streamable-http",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "The user prompt to complete." },
      system: { type: "string", description: "Optional system prompt." },
    },
    required: ["prompt"],
    additionalProperties: false,
  },
  example: { prompt: "What is the capital of France?" },
  output: {
    example: {
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: "The capital of France is Paris." }] },
    },
  },
});

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
    extensions: discovery,
  },
};

const cdpReady = !!appConfig.cdpApiKeyId && !!appConfig.cdpApiKeySecret;
const facilitatorClient = new HTTPFacilitatorClient(
  cdpReady ? cdpFacilitator : { url: "https://x402.org/facilitator" },
);

const server = new x402ResourceServer(facilitatorClient)
  .register(appConfig.network, new ExactEvmScheme())
  // Processes + validates the bazaar discovery payload on the way out — without
  // this the extension may be emitted unrecognized (or stripped to `{}`).
  .registerExtension(bazaarResourceServerExtension);

/* ─────────────────────────  Yeetful earn-tracking  ─────────────────────────
 * Report every settled payment to your Yeetful dashboard so earnings show up.
 * Active only when both YEETFUL_API_KEY and YEETFUL_MCP_SLUG are set.
 *
 * CORE: one `onAfterSettle` hook + one fire-and-forget `reportUsage(...)`.
 * `reportUsage` never throws, self-times-out, and is never awaited — so
 * telemetry can't slow, block, or break a settlement.
 * ───────────────────────────────────────────────────────────────────────── */
const earnTrackingEnabled = !!appConfig.yeetfulApiKey && !!appConfig.yeetfulMcpSlug;

if (earnTrackingEnabled) {
  server.onAfterSettle(async ({ result }) => {
    reportUsage({
      apiKey: appConfig.yeetfulApiKey!,
      mcp: appConfig.yeetfulMcpSlug!,
      amountUsd: Number(appConfig.priceUsd), // your list price, in USD
      payer: result.payer, // paying agent's wallet
      txHash: result.transaction,
      network: appConfig.networkName,
      tool: await currentTool(), // optional — see below; resolves instantly
    });
  });
}

/* OPTIONAL: per-tool breakdown ──────────────────────────────────────────────
 * The MCP tool name (`params.name`) is in the JSON-RPC body, which the settle
 * hook doesn't receive — and the handler consumes the original body, so we
 * must NOT read it. Instead we parse a CLONE at proxy entry and pass the
 * already-pending promise through AsyncLocalStorage to the hook. Drop this
 * whole block (and the `tool` line above) if you don't want per-tool data. */
const toolNameStore = new AsyncLocalStorage<Promise<string | undefined>>();
const currentTool = () => toolNameStore.getStore() ?? Promise.resolve(undefined);

async function extractTool(req: NextRequest): Promise<string | undefined> {
  try {
    const body = (await req.clone().json()) as { params?: { name?: unknown } };
    return typeof body?.params?.name === "string" ? body.params.name : undefined;
  } catch {
    return undefined; // no/invalid JSON body (e.g. the 402 probe) — fine.
  }
}

// syncFacilitatorOnStart=true (default): v2 fetches the facilitator's supported
// kinds via initialize() before it can emit the challenge for exact/<network>.
const paymentGate = paymentProxy(routes, server);

export const proxy = earnTrackingEnabled
  ? (req: NextRequest) => toolNameStore.run(extractTool(req), () => paymentGate(req))
  : paymentGate;

// Gate only the MCP transport routes; homepage and /api/info stay free.
export const config = {
  matcher: ["/api/mcp/:path*"],
};
