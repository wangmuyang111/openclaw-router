import test from "node:test";
import assert from "node:assert/strict";

import {
  RoutingSessionStore,
  type RouteDecision,
  type TaskSessionState,
} from "./routing-session-store.js";

function makeDecision(sessionKey: string, expiresAtMs: number): RouteDecision {
  return {
    sessionKey,
    conversationId: `${sessionKey}-conversation`,
    messageHash: `${sessionKey}-hash`,
    kind: "coding",
    confidence: "high",
    candidateModel: "gpt-5.4",
    reason: "test",
    signals: ["code"],
    createdAtMs: expiresAtMs - 1000,
    expiresAtMs,
    source: "message_received",
  };
}

function makeTaskState(sessionKey: string): TaskSessionState {
  return {
    sessionKey,
    primaryKind: "coding",
    primaryModel: "gpt-5.4",
    lastTaskAt: 100,
    lastRouteAt: 200,
  };
}

test("RoutingSessionStore prunes only expired route decisions and preserves task state", () => {
  const store = new RoutingSessionStore();

  store.setRouteDecision("alive", makeDecision("alive", 20_000));
  store.setRouteDecision("expired", makeDecision("expired", 5_000));
  store.setTaskState("expired", makeTaskState("expired"));

  const removed = store.pruneExpiredRouteDecisions(10_000);

  assert.deepEqual(removed, ["expired"]);
  assert.equal(store.getRouteDecision("alive")?.sessionKey, "alive");
  assert.equal(store.getRouteDecision("expired"), undefined);
  assert.equal(store.getTaskState("expired")?.sessionKey, "expired");
});

test("RoutingSessionStore deletes empty session containers after clearing both state slots", () => {
  const store = new RoutingSessionStore();

  store.setRouteDecision("s1", makeDecision("s1", 50_000));
  store.setTaskState("s1", makeTaskState("s1"));

  store.clearRouteDecision("s1");
  assert.ok(store.getSessionState("s1"));

  store.clearTaskState("s1");
  assert.equal(store.getSessionState("s1"), undefined);
});

test("RoutingSessionStore lists session keys and state entries", () => {
  const store = new RoutingSessionStore();

  store.setTaskState("b", makeTaskState("b"));
  store.setRouteDecision("a", makeDecision("a", 20_000));

  assert.deepEqual(store.listSessionKeys(), ["b", "a"]);
  assert.deepEqual(
    store.listSessionStates().map((item) => item.sessionKey),
    ["b", "a"],
  );
});

test("RoutingSessionStore can find route decision by conversationId or messageHash", () => {
  const store = new RoutingSessionStore();
  const decision = makeDecision("s1", 20_000);

  store.setRouteDecision("s1", decision);

  assert.equal(
    store.findRouteDecision({ conversationId: "s1-conversation" })?.sessionKey,
    "s1",
  );
  assert.equal(store.findRouteDecision({ messageHash: "s1-hash" })?.sessionKey, "s1");
});
