import test from "node:test";
import assert from "node:assert/strict";

import { getRouteTrustDecision } from "./routing-trust-policy.js";
import type { RouteDecision } from "./routing-session-store.js";

function makeDecision(): RouteDecision {
  return {
    sessionKey: "s1",
    conversationId: "conv-1",
    messageHash: "hash-1",
    kind: "coding",
    confidence: "high",
    candidateModel: "gpt-5.4",
    reason: "test",
    signals: ["code"],
    createdAtMs: 100,
    expiresAtMs: 200,
    source: "message_received",
  };
}

test("trust policy treats direct runtime session matches as strong", () => {
  const trust = getRouteTrustDecision({
    matchSource: "sessionKey",
    runtimeIdentitySource: "sessionId",
    decision: makeDecision(),
  });

  assert.deepEqual(trust, {
    trusted: true,
    level: "strong",
    reason: "direct_runtime_session",
  });
});

test("trust policy treats conversation matches as medium", () => {
  const trust = getRouteTrustDecision({
    matchSource: "conversationId",
    runtimeIdentitySource: "conversationId",
    decision: makeDecision(),
  });

  assert.deepEqual(trust, {
    trusted: true,
    level: "medium",
    reason: "conversation_match",
  });
});

test("trust policy blocks weak message-hash-only matches", () => {
  const trust = getRouteTrustDecision({
    matchSource: "messageHash",
    runtimeIdentitySource: "fallback",
    decision: makeDecision(),
  });

  assert.deepEqual(trust, {
    trusted: false,
    level: "weak",
    reason: "message_hash_match",
  });
});

test("trust policy blocks fallback runtime identity even if store hit by session key", () => {
  const trust = getRouteTrustDecision({
    matchSource: "sessionKey",
    runtimeIdentitySource: "fallback",
    decision: makeDecision(),
  });

  assert.deepEqual(trust, {
    trusted: false,
    level: "weak",
    reason: "fallback_runtime_identity",
  });
});
