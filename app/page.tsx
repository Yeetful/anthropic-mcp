import { config, priceString } from "@/lib/config";

export default function Home() {
  return (
    <main style={{ maxWidth: 760 }}>
      <h1>anthropic-mcp</h1>
      <p>
        An MCP server that proxies Anthropic inference, gated by{" "}
        <a href="https://x402.org" style={{ color: "#7dd3fc" }}>
          x402
        </a>{" "}
        stablecoin payments.
      </p>

      <h2>Endpoint</h2>
      <pre style={pre}>POST /api/mcp/mcp</pre>

      <h2>Payment</h2>
      <ul>
        <li>
          <strong>Network:</strong> {config.network}
        </li>
        <li>
          <strong>Price:</strong> {priceString()} USDC per call
        </li>
        <li>
          <strong>Receiving wallet:</strong> <code>{config.paymentAddress}</code>
        </li>
      </ul>

      <h2>Tools exposed</h2>
      <ul>
        <li>
          <code>ask_claude</code> — single-prompt text completion.
        </li>
        <li>
          <code>claude_chat</code> — multi-turn chat with a messages array.
        </li>
      </ul>

      <p>
        Unpaid requests receive <code>HTTP 402 Payment Required</code> with the
        payment details. Pay with an x402 client (e.g. <code>x402-fetch</code>)
        and retry to receive the MCP response.
      </p>
    </main>
  );
}

const pre = {
  background: "#161618",
  border: "1px solid #27272a",
  padding: "0.75rem 1rem",
  borderRadius: 6,
  overflowX: "auto" as const,
};
