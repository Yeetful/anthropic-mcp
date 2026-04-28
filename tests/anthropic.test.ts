import { describe, it, expect, vi, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { askClaude, chatClaude } from "@/lib/anthropic";

function makeMockClient(response: {
  content: Array<{ type: string; text?: string }>;
}) {
  const create = vi.fn().mockResolvedValue(response);
  return {
    client: { messages: { create } } as unknown as Anthropic,
    create,
  };
}

describe("askClaude", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5";
  });

  it("forwards prompt, system, and model to the SDK", async () => {
    const { client, create } = makeMockClient({
      content: [{ type: "text", text: "pong" }],
    });

    const text = await askClaude(
      {
        prompt: "ping",
        system: "be terse",
        model: "claude-opus-4-7",
        maxTokens: 16,
      },
      client,
    );

    expect(text).toBe("pong");
    expect(create).toHaveBeenCalledWith({
      model: "claude-opus-4-7",
      max_tokens: 16,
      system: "be terse",
      messages: [{ role: "user", content: "ping" }],
    });
  });

  it("falls back to the configured default model", async () => {
    const { client, create } = makeMockClient({
      content: [{ type: "text", text: "ok" }],
    });

    await askClaude({ prompt: "hi" }, client);

    const call = create.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-4-5");
    expect(call.max_tokens).toBe(1024);
  });

  it("concatenates text blocks and ignores non-text blocks", async () => {
    const { client } = makeMockClient({
      content: [
        { type: "text", text: "hello " },
        { type: "tool_use" },
        { type: "text", text: "world" },
      ],
    });

    const text = await askClaude({ prompt: "hi" }, client);
    expect(text).toBe("hello world");
  });
});

describe("chatClaude", () => {
  it("passes the full message array through", async () => {
    const { client, create } = makeMockClient({
      content: [{ type: "text", text: "sure" }],
    });

    const messages = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
      { role: "user" as const, content: "help me" },
    ];

    await chatClaude({ messages, model: "claude-sonnet-4-6" }, client);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        messages,
      }),
    );
  });
});
