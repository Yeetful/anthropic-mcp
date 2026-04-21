import { paymentMiddleware, type RouteConfig } from "x402-next";
import { config as appConfig, priceString } from "@/lib/config";

const routeConfig: RouteConfig = {
  price: priceString(),
  network: appConfig.network,
  config: {
    description:
      "Per-request access to an Anthropic-backed MCP inference endpoint.",
    mimeType: "application/json",
  },
};

const routes = {
  "/api/mcp": routeConfig,
  "/api/mcp/*": routeConfig,
};

const facilitator = appConfig.facilitatorUrl
  ? { url: appConfig.facilitatorUrl as `${string}://${string}` }
  : undefined;

export const proxy = paymentMiddleware(
  appConfig.paymentAddress,
  routes,
  facilitator,
);
