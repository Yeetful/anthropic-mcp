import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { askClaude, chatClaude } from "@/lib/anthropic";

/**
 * Server-enforced output cap, regardless of what the client requests.
 *
 * Pricing math: at $0.01 per call on Haiku 4.5 (~$1/$5 per million in/out
 * tokens), 256 output tokens cost ~$0.0013 and a few-K-token input adds
 * another ~$0.005. Comfortably under the $0.01 charge.
 *
 * Model is also fixed server-side (never honored from client input) so a
 * caller can't request Opus and bleed the wallet dry.
 */
const MAX_OUTPUT_TOKENS = 256;
const MAX_INPUT_CHARS = 20_000; // ~5K tokens, hard input ceiling.

function clampPrompt(s: string): string {
  return s.length > MAX_INPUT_CHARS ? s.slice(0, MAX_INPUT_CHARS) : s;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ask_claude",
      {
        title: "Ask Claude",
        description:
          "Send a single prompt to Claude Haiku 4.5 and receive a text response (≤256 output tokens). Costs one x402 payment per call.",
        inputSchema: {
          prompt: z
            .string()
            .min(1)
            .describe(`The user prompt. Truncated to ${MAX_INPUT_CHARS} characters.`),
          system: z
            .string()
            .optional()
            .describe(`Optional system instruction. Truncated to ${MAX_INPUT_CHARS} characters.`),
        },
      },
      async ({ prompt, system }) => {
        const text = await askClaude({
          prompt: clampPrompt(prompt),
          system: system ? clampPrompt(system) : undefined,
          maxTokens: MAX_OUTPUT_TOKENS,
          // Model intentionally omitted — server uses ANTHROPIC_DEFAULT_MODEL.
        });
        return { content: [{ type: "text", text }] };
      },
    );

    server.registerTool(
      "claude_chat",
      {
        title: "Claude Chat",
        description:
          "Multi-turn chat with Claude Haiku 4.5 (≤256 output tokens). Pass an array of {role, content} messages.",
        inputSchema: {
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
              }),
            )
            .min(1)
            .max(20)
            .describe("Up to 20 turns. Each message content truncated."),
          system: z.string().optional(),
        },
      },
      async ({ messages, system }) => {
        const text = await chatClaude({
          messages: messages.map((m) => ({
            role: m.role,
            content: clampPrompt(m.content),
          })),
          system: system ? clampPrompt(system) : undefined,
          maxTokens: MAX_OUTPUT_TOKENS,
        });
        return { content: [{ type: "text", text }] };
      },
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

export { handler as GET, handler as POST, handler as DELETE };
