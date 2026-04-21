import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.PAYMENT_ADDRESS = "0x66268791B55e1F5fA585D990326519F101407257";
  process.env.X402_NETWORK = "base";
  process.env.X402_PRICE_USD = "0.01";
});

describe("x402 payment gate", () => {
  it("returns HTTP 402 with payment requirements when no X-PAYMENT header is sent", async () => {
    const { proxy } = await import("@/proxy");

    const req = new NextRequest("https://example.test/api/mcp/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    const res = await proxy(req, {} as never);
    expect(res).toBeDefined();
    expect(res!.status).toBe(402);

    const body = await res!.json();
    expect(body).toHaveProperty("x402Version");
    expect(Array.isArray(body.accepts)).toBe(true);
    expect(body.accepts.length).toBeGreaterThan(0);

    const accept = body.accepts[0];
    expect(accept.network).toBe("base");
    expect(accept.payTo.toLowerCase()).toBe(
      "0x66268791B55e1F5fA585D990326519F101407257".toLowerCase(),
    );
    // 0.01 USDC = 10000 atomic units (USDC has 6 decimals)
    expect(accept.maxAmountRequired).toBe("10000");
  });

  it("publishes payment details on the public /api/info endpoint", async () => {
    const { GET } = await import("@/app/api/info/route");
    const res = await GET();
    const body = await res.json();

    expect(body.payment.network).toBe("base");
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
