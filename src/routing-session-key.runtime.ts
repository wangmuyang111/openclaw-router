export type RuntimeAgentContextLike = {
  sessionKey?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  channelId?: string | null;
  accountId?: string | null;
  messageProvider?: string | null;
  [key: string]: unknown;
};

export function resolveRuntimeRouteSessionKey(ctx: RuntimeAgentContextLike): string {
  const candidates = [
    ctx.sessionKey,
    ctx.sessionId,
    ctx.conversationId,
  ];

  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  const provider = String(ctx.messageProvider ?? ctx.channelId ?? "unknown").trim() || "unknown";
  const accountId = String(ctx.accountId ?? "unknown").trim() || "unknown";
  return `runtime-fallback:${provider}:${accountId}`;
}
