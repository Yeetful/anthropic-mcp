import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  ssr: {
    noExternal: ["@x402/next", "@x402/core", "@x402/evm", "@coinbase/x402"],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    testTimeout: 20_000,
    setupFiles: ["./tests/setup.ts"],
    server: {
      deps: {
        // Inline the x402 v2 packages (and next) so vitest transforms them and
        // can resolve subpath imports like `next/server`.
        inline: ["@x402/next", "@x402/core", "@x402/evm", "@coinbase/x402", "next"],
      },
    },
  },
});
