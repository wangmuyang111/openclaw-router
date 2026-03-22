import test from "node:test";
import assert from "node:assert/strict";

import { RoutingSessionStore } from "./routing-session-store.js";
import { RoutingStateReadService } from "./routing-state-read-service.js";
import { RoutingControlApi } from "./routing-control-api.js";
import { RoutingControlAdapter } from "./routing-control-adapter.js";
import { createRoutingControlFetchHandler } from "./routing-control-fetch-adapter.js";
import { createRoutingControlClient } from "./routing-control-client.js";
import { createRoutingControlQueries } from "./routing-control-queries.js";
import { createRoutingControlDashboard } from "./routing-control-dashboard.js";
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

function makeDashboard() {
  const store = new RoutingSessionStore();
  store.setTaskState("session/alpha", {
    sessionKey: "session/alpha",
    primaryKind: "coding",
    primaryModel: "gpt-5.4",
    lastTaskAt: 100,
    lastRouteAt: 200,
  });
  store.setTaskState("session/beta", {
    sessionKey: "session/beta",
    primaryKind: "vision",
    primaryModel: "vision-model",
    lastTaskAt: 50,
    lastRouteAt: 60,
  });

  const readService = new RoutingStateReadService(store, async () => runtimeView());
  const api = new RoutingControlApi(readService);
  const adapter = new RoutingControlAdapter(api);
  const handler = createRoutingControlFetchHandler(adapter);

  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    return handler(request);
  };

  const client = createRoutingControlClient({
    baseUrl: "https://example.test",
    fetchImpl,
  });

  const queries = createRoutingControlQueries(client);
  return createRoutingControlDashboard(queries);
}

test("RoutingControlDashboard composes runtime, sessions and auto-selected detail panels", async () => {
  const dashboard = makeDashboard();
  const state = await dashboard.loadDashboard();

  assert.equal(state.runtime.status, "success");
  assert.equal(state.runtime.data?.taskModePrimaryKind, "coding");

  assert.equal(state.sessions.status, "success");
  assert.equal(state.sessions.items.length, 2);

  assert.equal(state.selectedSessionKey, "session/alpha");
  assert.equal(state.detail.status, "success");
  assert.equal(state.detail.sessionKey, "session/alpha");
  assert.equal(state.detail.data?.taskState?.primaryModel, "gpt-5.4");
  assert.ok(state.lastLoadedAtMs > 0);
});

test("RoutingControlDashboard honors explicit selected session key", async () => {
  const dashboard = makeDashboard();
  const state = await dashboard.loadDashboard({ selectedSessionKey: "session/beta" });

  assert.equal(state.selectedSessionKey, "session/beta");
  assert.equal(state.detail.status, "success");
  assert.equal(state.detail.data?.taskState?.primaryModel, "vision-model");
});

test("RoutingControlDashboard can keep detail panel idle when auto selection is disabled", async () => {
  const dashboard = makeDashboard();
  const state = await dashboard.loadDashboard({ autoSelectFirstSession: false });

  assert.equal(state.selectedSessionKey, undefined);
  assert.equal(state.detail.status, "idle");
  assert.equal(state.detail.data, undefined);
});
