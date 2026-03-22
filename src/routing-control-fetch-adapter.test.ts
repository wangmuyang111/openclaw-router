import test from "node:test";
import assert from "node:assert/strict";

import { RoutingSessionStore } from "./routing-session-store.js";
import { RoutingStateReadService } from "./routing-state-read-service.js";
import { RoutingControlApi } from "./routing-control-api.js";
import { RoutingControlAdapter } from "./routing-control-adapter.js";
import { createRoutingControlFetchHandler } from "./routing-control-fetch-adapter.js";
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

function makeHandler() {
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
  return createRoutingControlFetchHandler(adapter);
}

test("fetch adapter returns JSON response for GET /routing/runtime", async () => {
  const handler = makeHandler();
  const response = await handler(new Request("https://example.test/routing/runtime"));
  const body = (await response.json()) as { ok: boolean; data?: { taskModePrimaryKind?: string } };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.ok, true);
  assert.equal(body.data?.taskModePrimaryKind, "coding");
});

test("fetch adapter returns JSON response for GET /routing/sessions/:sessionKey", async () => {
  const handler = makeHandler();
  const response = await handler(
    new Request("https://example.test/routing/sessions/session%2Falpha"),
  );
  const body = (await response.json()) as { ok: boolean; data?: { sessionKey?: string } };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data?.sessionKey, "session/alpha");
});

test("fetch adapter preserves adapter error responses", async () => {
  const handler = makeHandler();
  const response = await handler(new Request("https://example.test/routing/unknown"));
  const body = (await response.json()) as {
    ok: boolean;
    error?: { code?: string };
  };

  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error?.code, "not_found");
});
