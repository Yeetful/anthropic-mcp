import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { askClaude, chatClaude } from "@/lib/anthropic";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ask_claude",
      {
        title: "Ask Claude",
        description:
          "Send a single prompt to Claude and receive a text response. Costs one x402 payment per call.",
        inputSchema: {
          prompt: z.string().min(1).describe("The user prompt."),
          system: z
            .string()
            .optional()
            .describe("Optional system instruction."),
          model: z
            .string()
            .optional()
            .describe("Override the default Claude model ID."),
          max_tokens: z
            .number()
            .int()
            .positive()
            .max(8192)
            .optional()
            .describe("Max tokens to generate."),
        },
      },
      async ({ prompt, system, model, max_tokens }) => {
        const text = await askClaude({
          prompt,
          system,
          model,
          maxTokens: max_tokens,
        });
        return { content: [{ type: "text", text }] };
      },
    );

    server.registerTool(
      "claude_chat",
      {
        title: "Claude Chat",
        description:
          "Multi-turn chat with Claude. Pass an array of {role, content} messages.",
        inputSchema: {
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
              }),
            )
            .min(1),
          system: z.string().optional(),
          model: z.string().optional(),
          max_tokens: z.number().int().positive().max(8192).optional(),
        },
      },
      async ({ messages, system, model, max_tokens }) => {
        const text = await chatClaude({
          messages,
          system,
          model,
          maxTokens: max_tokens,
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
