import test from "node:test";
import assert from "node:assert/strict";

import { RoutingSessionStore } from "./routing-session-store.js";
import { RoutingStateReadService } from "./routing-state-read-service.js";
import { RoutingControlApi } from "./routing-control-api.js";
import type { RuntimeRoutingDTO } from "./routing-state-dto.js";

function runtimeView(): RuntimeRoutingDTO {
  return {
    taskModeEnabled: true,
    taskModePrimaryKind: "coding",
    taskModeKinds: ["coding"],
    taskModeDisabledKinds: [],
    taskModeMinConfidence: "medium",
    taskModeReturnToPrimary: true,
    taskModeReturnModel: "",
    taskModeAllowAutoDowngrade: false,
    freeSwitchWhenTaskModeOff: true,
  };
}

function makeApi() {
  const store = new RoutingSessionStore();
  store.setTaskState("s1", {
    sessionKey: "s1",
    primaryKind: "coding",
    primaryModel: "gpt-5.4",
    lastTaskAt: 100,
    lastRouteAt: 200,
  });

  const readService = new RoutingStateReadService(store, async () => runtimeView());
  return new RoutingControlApi(readService);
}

test("RoutingControlApi returns runtime and sessions in serializable success envelopes", async () => {
  const api = makeApi();

  const runtime = await api.getRuntime();
  const sessions = await api.listSessions();

  assert.equal(runtime.ok, true);
  if (runtime.ok) {
    assert.equal(runtime.data.taskModePrimaryKind, "coding");
  }

  assert.equal(sessions.ok, true);
  if (sessions.ok) {
    assert.equal(sessions.data.items.length, 1);
    assert.equal(sessions.data.items[0]?.sessionKey, "s1");
  }
});

test("RoutingControlApi validates missing sessionKey", async () => {
  const api = makeApi();

  const result = await api.getSession({ sessionKey: "   " });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "invalid_argument");
  }
});

test("RoutingControlApi returns not_found for unknown session", async () => {
  const api = makeApi();

  const result = await api.getSession({ sessionKey: "missing" });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "not_found");
  }
});

test("RoutingControlApi returns session detail for known session", async () => {
  const api = makeApi();

  const result = await api.getSession({ sessionKey: "s1" });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.sessionKey, "s1");
    assert.equal(result.data.taskState?.primaryModel, "gpt-5.4");
  }
});
