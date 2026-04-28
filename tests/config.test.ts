import { describe, it, expect, beforeEach, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return import("@/lib/config");
}

const TEST_WALLET = "0x66268791B55e1F5fA585D990326519F101407257";

describe("config", () => {
  beforeEach(() => {
    delete process.env.X402_PRICE_USD;
    delete process.env.X402_NETWORK;
    delete process.env.PAYMENT_ADDRESS;
    delete process.env.ANTHROPIC_DEFAULT_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CDP_API_KEY_ID;
    delete process.env.CDP_API_KEY_SECRET;
  });

  it("requires PAYMENT_ADDRESS at module load — no silent fallback", async () => {
    await expect(loadConfig()).rejects.toThrow(/PAYMENT_ADDRESS/);
  });

  it("defaults to Base mainnet when X402_NETWORK is unset", async () => {
    process.env.PAYMENT_ADDRESS = TEST_WALLET;
    const mod = await loadConfig();
    expect(mod.config.paymentAddress).toBe(TEST_WALLET);
    expect(mod.config.network).toBe("base");
  });

  it("formats the price as an x402 USD string", async () => {
    process.env.PAYMENT_ADDRESS = TEST_WALLET;
    process.env.X402_PRICE_USD = "0.25";
    const mod = await loadConfig();
    expect(mod.priceString()).toBe("$0.25");
  });

  it("throws a clear error when ANTHROPIC_API_KEY is missing", async () => {
    process.env.PAYMENT_ADDRESS = TEST_WALLET;
    const mod = await loadConfig();
    expect(() => mod.config.anthropicApiKey()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("accepts a custom default model", async () => {
    process.env.PAYMENT_ADDRESS = TEST_WALLET;
    process.env.ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-7";
    const mod = await loadConfig();
    expect(mod.config.defaultModel).toBe("claude-opus-4-7");
  });

  it("exposes CDP credentials when set", async () => {
    process.env.PAYMENT_ADDRESS = TEST_WALLET;
    process.env.CDP_API_KEY_ID = "key-id";
    process.env.CDP_API_KEY_SECRET = "key-secret";
    const mod = await loadConfig();
    expect(mod.config.cdpApiKeyId).toBe("key-id");
    expect(mod.config.cdpApiKeySecret).toBe("key-secret");
  });
});
