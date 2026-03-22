import test from "node:test";
import assert from "node:assert/strict";

import { RoutingSessionStore } from "./routing-session-store.js";
import { RoutingStateReadService } from "./routing-state-read-service.js";
import { RoutingControlApi } from "./routing-control-api.js";
import { RoutingControlAdapter } from "./routing-control-adapter.js";
import { createRoutingControlFetchHandler } from "./routing-control-fetch-adapter.js";
import { createRoutingControlClient } from "./routing-control-client.js";
import { createRoutingControlQueries } from "./routing-control-queries.js";
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

function makeQueries() {
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

  const client = createRoutingControlClient({
    baseUrl: "https://example.test",
    fetchImpl,
  });

  return createRoutingControlQueries(client);
}

test("RoutingControlQueries loads runtime view into page-friendly success state", async () => {
  const queries = makeQueries();
  const result = await queries.loadRuntimeView();

  assert.equal(result.status, "success");
  assert.equal(result.data?.taskModePrimaryKind, "coding");
});

test("RoutingControlQueries loads sessions list into page-friendly success state", async () => {
  const queries = makeQueries();
  const result = await queries.loadSessionsView();

  assert.equal(result.status, "success");
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0]?.sessionKey, "session/alpha");
});

test("RoutingControlQueries maps missing session to not_found view state", async () => {
  const queries = makeQueries();
  const result = await queries.loadSessionDetailView("missing");

  assert.equal(result.status, "not_found");
  assert.equal(result.code, "not_found");
});

test("RoutingControlQueries loads session detail into page-friendly success state", async () => {
  const queries = makeQueries();
  const result = await queries.loadSessionDetailView("session/alpha");

  assert.equal(result.status, "success");
  assert.equal(result.data?.sessionKey, "session/alpha");
  assert.equal(result.data?.taskState?.primaryModel, "gpt-5.4");
});

test("RoutingControlQueries maps transport exceptions to generic error state", async () => {
  const client = createRoutingControlClient({
    baseUrl: "https://example.test",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  const queries = createRoutingControlQueries(client);

  const result = await queries.loadSessionsView();

  assert.equal(result.status, "error");
  assert.equal(result.code, "unknown_error");
  assert.equal(result.message, "network down");
});
