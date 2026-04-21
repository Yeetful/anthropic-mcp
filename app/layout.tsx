import type { ReactNode } from "react";

export const metadata = {
  title: "anthropic-mcp — x402-gated Claude inference",
  description:
    "An MCP server that proxies Anthropic inference behind an x402 USDC paywall on Base.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          margin: 0,
          padding: "2rem",
          lineHeight: 1.6,
          background: "#0b0b0d",
          color: "#e6e6e6",
        }}
      >
        {children}
      </body>
    </html>
  );
}
