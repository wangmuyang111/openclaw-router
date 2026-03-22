import type { RouteDecision, RouteDecisionMatchSource } from "./routing-session-store.js";
import type { RuntimeRouteSessionIdentitySource } from "./routing-session-key.runtime.js";

export type RouteTrustLevel = "strong" | "medium" | "weak" | "none";

export type RouteTrustDecision = {
  trusted: boolean;
  level: RouteTrustLevel;
  reason:
    | "direct_session_key"
    | "direct_runtime_session"
    | "conversation_match"
    | "message_hash_match"
    | "fallback_runtime_identity"
    | "fallback_message_identity"
    | "unmatched";
};

export function getRouteTrustDecision(params: {
  matchSource: RouteDecisionMatchSource;
  runtimeIdentitySource: RuntimeRouteSessionIdentitySource;
  decision: RouteDecision | undefined;
}): RouteTrustDecision {
  const { matchSource, runtimeIdentitySource, decision } = params;

  if (!decision) {
    return {
      trusted: false,
      level: "none",
      reason: "unmatched",
    };
  }

  if (matchSource === "sessionKey") {
    if (runtimeIdentitySource === "fallback") {
      return {
        trusted: false,
        level: "weak",
        reason: "fallback_runtime_identity",
      };
    }

    return {
      trusted: true,
      level: "strong",
      reason:
        runtimeIdentitySource === "sessionKey" || runtimeIdentitySource === "sessionId"
          ? "direct_runtime_session"
          : "direct_session_key",
    };
  }

  if (matchSource === "conversationId") {
    return {
      trusted: true,
      level: "medium",
      reason: "conversation_match",
    };
  }

  if (matchSource === "messageHash") {
    return {
      trusted: false,
      level: "weak",
      reason: "message_hash_match",
    };
  }

  return {
    trusted: false,
    level: "none",
    reason: "unmatched",
  };
}
