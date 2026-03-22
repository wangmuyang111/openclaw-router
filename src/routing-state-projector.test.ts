import test from "node:test";
import assert from "node:assert/strict";

import { projectSessionDetail, projectSessionSummary } from "./routing-state-projector.js";
import type { SessionRoutingState } from "./routing-session-store.js";

test("projectSessionSummary computes lastActivityAtMs from the latest available timestamp", () => {
  const state: SessionRoutingState = {
    routeDecision: {
      sessionKey: "s1",
      messageHash: "hash",
      kind: "vision",
      confidence: "high",
      candidateModel: "vision-model",
      reason: "image",
      signals: ["has_image"],
      createdAtMs: 100,
      expiresAtMs: 500,
      source: "message_received",
    },
    taskState: {
      sessionKey: "s1",
      primaryKind: "coding",
      primaryModel: "gpt-5.4",
      temporaryKind: "vision",
      temporaryModel: "vision-model",
      lastTaskAt: 200,
      lastRouteAt: 300,
    },
  };

  const summary = projectSessionSummary("s1", state);

  assert.equal(summary.sessionKey, "s1");
  assert.equal(summary.lastActivityAtMs, 300);
  assert.equal(summary.primaryKind, "coding");
  assert.equal(summary.primaryModel, "gpt-5.4");
  assert.equal(summary.temporaryKind, "vision");
  assert.equal(summary.temporaryModel, "vision-model");
  assert.equal(summary.hasPendingRouteDecision, true);
  assert.equal(summary.pendingKind, "vision");
  assert.equal(summary.pendingCandidateModel, "vision-model");
});

test("projectSessionDetail preserves routeDecision and taskState without reshaping", () => {
  const state: SessionRoutingState = {
    taskState: {
      sessionKey: "s2",
      primaryKind: "coding",
      primaryModel: "gpt-5.4",
      lastTaskAt: 10,
      lastRouteAt: 20,
    },
  };

  const detail = projectSessionDetail("s2", state);

  assert.equal(detail.sessionKey, "s2");
  assert.equal(detail.routeDecision, undefined);
  assert.equal(detail.taskState?.primaryModel, "gpt-5.4");
});
