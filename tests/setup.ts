// Default env for tests. Individual tests may override or delete these
// (see tests/config.test.ts which exercises the missing-PAYMENT_ADDRESS path).
process.env.PAYMENT_ADDRESS ??= "0x66268791B55e1F5fA585D990326519F101407257";
process.env.X402_NETWORK ??= "base";
process.env.X402_PRICE_USD ??= "0.01";
