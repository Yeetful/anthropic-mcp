# anthropic-mcp

An [x402](https://x402.org)-gated MCP server that proxies Anthropic inference over Streamable HTTP. Pay in USDC on Base, get a Claude response.

## How it works

1. Client calls `POST /api/mcp/mcp` with an MCP JSON-RPC request.
2. The Next.js proxy (`proxy.ts`, Next.js 16's replacement for `middleware.ts`) returns **HTTP 402 Payment Required** with an x402 payment challenge describing the required USDC amount, network, and receiving wallet.
3. Client signs an EIP-3009 `transferWithAuthorization` for the challenge using an x402 client helper (e.g. `x402-fetch` / `x402-axios`) and retries the request with an `X-PAYMENT` header.
4. The x402 facilitator verifies + settles the payment on Base. On success, the request is forwarded to the MCP handler, which invokes the Anthropic SDK using the operator's `ANTHROPIC_API_KEY`.
5. The MCP tool result (Claude's text response) is returned.

## Tools exposed

| Tool          | Purpose                                 |
| ------------- | --------------------------------------- |
| `ask_claude`  | Single-prompt text completion.          |
| `claude_chat` | Multi-turn chat with a `messages` array.|

## Setup

```bash
cd anthropic-mcp
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY
npm run dev
```

Defaults:
- Receiving wallet: `0x66268791B55e1F5fA585D990326519F101407257`
- Network: `base` (mainnet). Set `X402_NETWORK=base-sepolia` for test USDC.
- Price: `$0.01` per inference call. Override with `X402_PRICE_USD`.
- Default model: `claude-sonnet-4-6`. Override with `ANTHROPIC_DEFAULT_MODEL`.

### Facilitator

- **Mainnet (`base`):** the middleware defaults to Coinbase CDP's hosted facilitator bundled with `x402-next`.
- **Testnet (`base-sepolia`):** set `X402_FACILITATOR_URL=https://x402.org/facilitator`.

## Endpoints

| Path              | Gated | Description                     |
| ----------------- | ----- | ------------------------------- |
| `/`               | no    | Human-readable summary page.    |
| `/api/info`       | no    | JSON describing pricing + tools. |
| `/api/mcp/mcp`    | yes   | MCP Streamable HTTP endpoint.    |

## Testing

```bash
npm test
```

Three test suites:
- `tests/config.test.ts` — env parsing, price formatting, default wallet.
- `tests/anthropic.test.ts` — the Anthropic SDK wrapper, with a mocked client.
- `tests/payment-gate.test.ts` — the proxy returns a valid 402 x402 challenge pointing at the configured wallet, and `/api/info` publishes the right payment metadata.

### Manually validating the live 402

```bash
curl -i -X POST http://localhost:3000/api/mcp/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

You should see `HTTP/1.1 402 Payment Required` and a JSON body containing `accepts[].payTo` equal to the configured wallet.

### Paying with an x402 client

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

const res = await fetchWithPayment("http://localhost:3000/api/mcp/mcp", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "ask_claude",
      arguments: { prompt: "What is the capital of France?" },
    },
  }),
});
console.log(await res.json());
```
