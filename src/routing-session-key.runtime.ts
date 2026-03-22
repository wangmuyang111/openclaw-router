export type RuntimeAgentContextLike = {
  sessionKey?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  thread_id?: string | null;
  conversationId?: string | null;
  chatId?: string | null;
  chat_id?: string | null;
  channelId?: string | null;
  accountId?: string | null;
  messageProvider?: string | null;
  [key: string]: unknown;
};

export type RuntimeRouteSessionIdentitySource =
  | "sessionKey"
  | "sessionId"
  | "threadId"
  | "thread_id"
  | "conversationId"
  | "chatId"
  | "chat_id"
  | "fallback";

export type RuntimeRouteSessionIdentity = {
  key: string;
  source: RuntimeRouteSessionIdentitySource;
};

export function resolveRuntimeRouteSessionIdentity(
  ctx: RuntimeAgentContextLike,
): RuntimeRouteSessionIdentity {
  const candidates: Array<{ source: RuntimeRouteSessionIdentitySource; value: unknown }> = [
    { source: "sessionKey", value: ctx.sessionKey },
    { source: "sessionId", value: ctx.sessionId },
    { source: "threadId", value: ctx.threadId },
    { source: "thread_id", value: ctx.thread_id },
    { source: "conversationId", value: ctx.conversationId },
    { source: "chatId", value: ctx.chatId },
    { source: "chat_id", value: ctx.chat_id },
  ];

  for (const candidate of candidates) {
    const text = String(candidate.value ?? "").trim();
    if (text) {
      return {
        key: text,
        source: candidate.source,
      };
    }
  }

  const provider = String(ctx.messageProvider ?? ctx.channelId ?? "unknown").trim() || "unknown";
  const accountId = String(ctx.accountId ?? "unknown").trim() || "unknown";
  return {
    key: `runtime-fallback:${provider}:${accountId}`,
    source: "fallback",
  };
}

export function resolveRuntimeRouteSessionKey(ctx: RuntimeAgentContextLike): string {
  return resolveRuntimeRouteSessionIdentity(ctx).key;
}
