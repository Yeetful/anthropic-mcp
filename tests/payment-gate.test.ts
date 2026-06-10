import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.PAYMENT_ADDRESS = "0x66268791B55e1F5fA585D990326519F101407257";
  // base-sepolia (eip155:84532) so the public x402.org facilitator advertises
  // support for the exact scheme — the v2 proxy needs that to emit the
  // challenge. The envelope shape is identical to mainnet.
  process.env.X402_NETWORK = "base-sepolia";
  process.env.X402_PRICE_USD = "0.01";
});

describe("x402 payment gate (v2)", () => {
  it("returns HTTP 402 with a v2 PAYMENT-REQUIRED header challenge", async () => {
    const { proxy } = await import("@/proxy");

    const req = new NextRequest("https://example.test/api/mcp/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    const res = await proxy(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(402);

    // v2 delivers the challenge in a base64 PAYMENT-REQUIRED response header.
    const header = res!.headers.get("PAYMENT-REQUIRED");
    expect(header).toBeTruthy();
    const challenge = JSON.parse(Buffer.from(header!, "base64").toString("utf8"));

    expect(challenge.x402Version).toBe(2);
    expect(challenge.resource?.url).toBeTruthy();
    expect(challenge.resource?.mimeType).toBe("application/json");

    const accept = challenge.accepts[0];
    expect(accept.scheme).toBe("exact");
    expect(accept.network).toBe("eip155:84532");
    expect(accept.payTo.toLowerCase()).toBe(
      "0x66268791B55e1F5fA585D990326519F101407257".toLowerCase(),
    );
    // 0.01 USDC = 10000 atomic units (USDC has 6 decimals). v2 uses `amount`.
    expect(accept.amount).toBe("10000");

    // Bazaar discovery extension is present at the top level, in the CANONICAL
    // MCP shape — the indexer rejects anything else (it rendered our old
    // hand-rolled http-shaped block as `{}` / "input schema present: no").
    const bazaar = challenge.extensions?.bazaar;
    expect(bazaar?.info).toBeTruthy();
    expect(bazaar?.schema).toBeTruthy();
    expect(bazaar.info.input.type).toBe("mcp");
    expect(bazaar.info.input.toolName).toBe("ask_claude");
    // The field the Bazaar "INPUT SCHEMA PRESENT" quality signal checks:
    expect(bazaar.info.input.inputSchema?.properties?.prompt).toBeTruthy();
    expect(bazaar.info.input.inputSchema?.required).toContain("prompt");
  });

  it("publishes payment details on the public /api/info endpoint", async () => {
    const { GET } = await import("@/app/api/info/route");
    const res = await GET();
    const body = await res.json();

    expect(body.payment.network).toBe("eip155:84532");
    expect(body.payment.payTo).toBe(
      "0x66268791B55e1F5fA585D990326519F101407257",
    );
    expect(body.payment.priceUsd).toBe("$0.01");
    expect(body.payment.protocol).toBe("x402");
    expect(body.payment.asset).toBe("USDC");
    expect(body.tools.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(["ask_claude", "claude_chat"]),
    );
  });
});
