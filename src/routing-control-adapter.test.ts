import test from "node:test";
import assert from "node:assert/strict";

import { RoutingSessionStore } from "./routing-session-store.js";
import { RoutingStateReadService } from "./routing-state-read-service.js";
import { RoutingControlApi } from "./routing-control-api.js";
import { RoutingControlAdapter } from "./routing-control-adapter.js";
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

function makeAdapter() {
  const store = new RoutingSessionStore();
  store.setTaskState("session/alpha", {
    sessionKey: "session/alpha",
    primaryKind: "coding",
    primaryModel: "gpt-5.4",
    lastTaskAt: 100,
    lastRouteAt: 200,
  });

  const readService = new RoutingStateReadService(store, async () => runtimeView());
  const api = new RoutingControlApi(readService);
  return new RoutingControlAdapter(api);
}

test("RoutingControlAdapter routes GET /routing/runtime", async () => {
  const adapter = makeAdapter();
  const response = await adapter.handle({ method: "GET", path: "/routing/runtime" });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  if (response.body.ok) {
    assert.ok("taskModePrimaryKind" in response.body.data);
    assert.equal(response.body.data.taskModePrimaryKind, "coding");
  }
});

test("RoutingControlAdapter routes GET /routing/sessions", async () => {
  const adapter = makeAdapter();
  const response = await adapter.handle({ method: "GET", path: "/routing/sessions" });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  if (response.body.ok) {
    assert.ok("items" in response.body.data);
    assert.equal(response.body.data.items.length, 1);
    assert.equal(response.body.data.items[0]?.sessionKey, "session/alpha");
  }
});

test("RoutingControlAdapter routes GET /routing/sessions/:sessionKey with decoding", async () => {
  const adapter = makeAdapter();
  const response = await adapter.handle({
    method: "GET",
    path: "/routing/sessions/session%2Falpha",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  if (response.body.ok) {
    assert.ok("sessionKey" in response.body.data);
    assert.equal(response.body.data.sessionKey, "session/alpha");
  }
});

test("RoutingControlAdapter returns 404 for unknown route", async () => {
  const adapter = makeAdapter();
  const response = await adapter.handle({ method: "GET", path: "/routing/unknown" });

  assert.equal(response.status, 404);
  assert.equal(response.body.ok, false);
  if (!response.body.ok) {
    assert.equal(response.body.error.code, "not_found");
  }
});

test("RoutingControlAdapter returns 405 for unsupported method", async () => {
  const adapter = makeAdapter();
  const response = await adapter.handle({ method: "POST", path: "/routing/runtime" });

  assert.equal(response.status, 405);
  assert.equal(response.body.ok, false);
  if (!response.body.ok) {
    assert.equal(response.body.error.code, "method_not_allowed");
  }
});
