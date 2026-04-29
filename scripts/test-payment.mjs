#!/usr/bin/env node
/**
 * End-to-end paid request against the live MCP endpoint.
 *
 * USAGE:
 *   PRIVATE_KEY=0x... npm run test:payment
 *
 * Optional env:
 *   ENDPOINT  — defaults to https://anthropic.yeetful.com/api/mcp/mcp
 *   PROMPT    — the prompt to send. Defaults to a tiny smoke test.
 *
 * SAFETY:
 *   - Use a fresh wallet on Base with only a few cents of USDC and a
 *     little ETH for gas. NEVER paste a wallet that holds real funds.
 *   - This script signs and submits a real on-chain payment; you cannot
 *     refund yourself if you point ENDPOINT at someone else's server.
 *   - The PRIVATE_KEY env var is read once and never logged.
 */

import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const ENDPOINT = process.env.ENDPOINT ?? "https://anthropic.yeetful.com/api/mcp/mcp";
const PROMPT = process.env.PROMPT ?? "Say hi in 5 words.";

if (!process.env.PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY env var is required.");
  console.error("Example: PRIVATE_KEY=0xabc... npm run test:payment");
  process.exit(1);
}

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

console.log(`→ POST ${ENDPOINT}`);
console.log(`  paying from: ${account.address}`);
console.log(`  prompt: ${JSON.stringify(PROMPT)}`);
console.log("");

const t0 = Date.now();
const res = await fetchWithPayment(ENDPOINT, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    // MCP Streamable HTTP requires both — server may respond with JSON or SSE.
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "ask_claude",
      arguments: { prompt: PROMPT },
    },
  }),
});
const elapsed = Date.now() - t0;

console.log(`← ${res.status} ${res.statusText}  (${elapsed}ms)`);

const paymentHeader = res.headers.get("x-payment-response");
if (paymentHeader) {
  try {
    const decoded = decodeXPaymentResponse(paymentHeader);
    console.log("  payment settled:");
    console.log(`    txHash:  ${decoded.transaction ?? decoded.txHash ?? "(no field)"}`);
    console.log(`    network: ${decoded.network ?? "(no field)"}`);
    console.log(`    payer:   ${decoded.payer ?? "(no field)"}`);
  } catch {
    console.log(`  x-payment-response (raw): ${paymentHeader}`);
  }
} else {
  console.log("  WARNING: no x-payment-response header — payment may not have settled.");
}

// MCP Streamable HTTP may respond with either application/json or
// text/event-stream depending on what the client advertised. Handle both.
const contentType = res.headers.get("content-type") ?? "";
const raw = await res.text();
let body;
if (contentType.includes("text/event-stream")) {
  // SSE frame looks like:  event: message\n data: {...}\n\n
  // We want the first `data:` payload's JSON.
  const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
  body = dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : { raw };
} else {
  body = JSON.parse(raw);
}
console.log("");
console.log("response body:");
console.log(JSON.stringify(body, null, 2));

if (res.status !== 200) {
  process.exit(2);
}
