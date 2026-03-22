import test from "node:test";
import assert from "node:assert/strict";

import { RoutingSessionStore } from "./routing-session-store.js";
import { RoutingStateReadService } from "./routing-state-read-service.js";
import { RoutingControlApi } from "./routing-control-api.js";
import { RoutingControlAdapter } from "./routing-control-adapter.js";
import { createRoutingControlFetchHandler } from "./routing-control-fetch-adapter.js";
import { createRoutingControlClient } from "./routing-control-client.js";
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

function makeClient() {
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
  const adapter = new RoutingControlAdapter(api);
  const handler = createRoutingControlFetchHandler(adapter);

  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    return handler(request);
  };

  return createRoutingControlClient({
    baseUrl: "https://example.test",
    fetchImpl,
  });
}

test("RoutingControlClient reads runtime via fetch-style adapter", async () => {
  const client = makeClient();
  const result = await client.getRuntime();

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.taskModePrimaryKind, "coding");
  }
});

test("RoutingControlClient reads session list via fetch-style adapter", async () => {
  const client = makeClient();
  const result = await client.listSessions();

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.items.length, 1);
    assert.equal(result.data.items[0]?.sessionKey, "session/alpha");
  }
});

test("RoutingControlClient reads session detail via fetch-style adapter", async () => {
  const client = makeClient();
  const result = await client.getSession("session/alpha");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.sessionKey, "session/alpha");
    assert.equal(result.data.taskState?.primaryModel, "gpt-5.4");
  }
});

test("RoutingControlClient preserves not_found responses", async () => {
  const client = makeClient();
  const result = await client.getSession("missing");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "not_found");
  }
});
