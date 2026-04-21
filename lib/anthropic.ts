import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: config.anthropicApiKey() });
  }
  return cached;
}

export type AskInput = {
  prompt: string;
  model?: string;
  system?: string;
  maxTokens?: number;
};

export async function askClaude(
  input: AskInput,
  client: Anthropic = getAnthropic(),
): Promise<string> {
  const response = await client.messages.create({
    model: input.model ?? config.defaultModel,
    max_tokens: input.maxTokens ?? 1024,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatInput = {
  messages: ChatMessage[];
  model?: string;
  system?: string;
  maxTokens?: number;
};

export async function chatClaude(
  input: ChatInput,
  client: Anthropic = getAnthropic(),
): Promise<string> {
  const response = await client.messages.create({
    model: input.model ?? config.defaultModel,
    max_tokens: input.maxTokens ?? 1024,
    system: input.system,
    messages: input.messages,
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
