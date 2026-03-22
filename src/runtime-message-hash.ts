import * as crypto from "node:crypto";

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const text = (item as Record<string, unknown>).text;
          if (typeof text === "string") return text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") {
    const text = (content as Record<string, unknown>).text;
    if (typeof text === "string") return text;
  }
  return "";
}

function messageRoleOf(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const role = (message as Record<string, unknown>).role;
  return typeof role === "string" ? role : "";
}

function messageTextOf(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as Record<string, unknown>).content;
  return extractTextFromContent(content).trim();
}

export function getLastUserMessageText(messages: unknown[] | undefined): string | undefined {
  if (!Array.isArray(messages) || messages.length === 0) return undefined;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const role = messageRoleOf(message);
    if (role !== "user") continue;
    const text = messageTextOf(message);
    if (text) return text;
  }

  return undefined;
}

export function computeShortHash(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 16);
}

export function computeRuntimeMessageHash(params: {
  prompt: string;
  messages?: unknown[];
}): {
  hash: string;
  source: "last_user_message" | "prompt";
  text: string;
} {
  const lastUserMessage = getLastUserMessageText(params.messages);
  if (lastUserMessage) {
    return {
      hash: computeShortHash(lastUserMessage),
      source: "last_user_message",
      text: lastUserMessage,
    };
  }

  const prompt = String(params.prompt ?? "");
  return {
    hash: computeShortHash(prompt),
    source: "prompt",
    text: prompt,
  };
}
