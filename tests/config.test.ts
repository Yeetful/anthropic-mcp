import { describe, it, expect, beforeEach, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return import("@/lib/config");
}

describe("config", () => {
  beforeEach(() => {
    delete process.env.X402_PRICE_USD;
    delete process.env.X402_NETWORK;
    delete process.env.PAYMENT_ADDRESS;
    delete process.env.ANTHROPIC_DEFAULT_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("defaults to the agent's USDC wallet on Base mainnet", async () => {
    const mod = await loadConfig();
    expect(mod.config.paymentAddress).toBe(
      "0x66268791B55e1F5fA585D990326519F101407257",
    );
    expect(mod.config.network).toBe("base");
  });

  it("formats the price as an x402 USD string", async () => {
    process.env.X402_PRICE_USD = "0.25";
    const mod = await loadConfig();
    expect(mod.priceString()).toBe("$0.25");
  });

  it("throws a clear error when ANTHROPIC_API_KEY is missing", async () => {
    const mod = await loadConfig();
    expect(() => mod.config.anthropicApiKey()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("accepts a custom default model", async () => {
    process.env.ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-7";
    const mod = await loadConfig();
    expect(mod.config.defaultModel).toBe("claude-opus-4-7");
  });
});
