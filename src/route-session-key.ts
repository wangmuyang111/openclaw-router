export type RouteSessionContextLike = {
  conversationId?: string | null;
  channelId?: string | null;
  accountId?: string | null;
  [key: string]: unknown;
};

export type RouteSessionEventLike = {
  from?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RouteSessionIdentitySource =
  | "ctx.sessionKey"
  | "metadata.sessionKey"
  | "metadata.session_key"
  | "metadata.threadId"
  | "metadata.thread_id"
  | "metadata.conversationId"
  | "metadata.conversation_id"
  | "ctx.conversationId"
  | "metadata.chatId"
  | "metadata.chat_id"
  | "fallback";

export type RouteSessionIdentity = {
  key: string;
  source: RouteSessionIdentitySource;
};

export function resolveRouteSessionIdentity(
  ctx: RouteSessionContextLike,
  event: RouteSessionEventLike,
): RouteSessionIdentity {
  const ctxAny = ctx as Record<string, unknown>;
  const metadata =
    event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata
      : {};

  const candidates: Array<{ source: RouteSessionIdentitySource; value: unknown }> = [
    { source: "ctx.sessionKey", value: ctxAny.sessionKey },
    { source: "metadata.sessionKey", value: metadata.sessionKey },
    { source: "metadata.session_key", value: metadata.session_key },
    { source: "metadata.threadId", value: metadata.threadId },
    { source: "metadata.thread_id", value: metadata.thread_id },
    { source: "metadata.conversationId", value: metadata.conversationId },
    { source: "metadata.conversation_id", value: metadata.conversation_id },
    { source: "ctx.conversationId", value: ctx.conversationId },
    { source: "metadata.chatId", value: metadata.chatId },
    { source: "metadata.chat_id", value: metadata.chat_id },
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

  const provider = String(metadata.provider ?? ctx.channelId ?? "unknown").trim() || "unknown";
  const accountId =
    String(ctx.accountId ?? metadata.accountId ?? metadata.account_id ?? "unknown").trim() ||
    "unknown";
  const from = String(event.from ?? metadata.from ?? "unknown").trim() || "unknown";
  return {
    key: `fallback:${provider}:${accountId}:${from}`,
    source: "fallback",
  };
}

export function resolveRouteSessionKey(
  ctx: RouteSessionContextLike,
  event: RouteSessionEventLike,
): string {
  return resolveRouteSessionIdentity(ctx, event).key;
}
