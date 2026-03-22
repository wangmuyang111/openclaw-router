import test from "node:test";
import assert from "node:assert/strict";

import { RoutingSessionStore } from "./routing-session-store.js";
import { RoutingStateReadService } from "./routing-state-read-service.js";
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

test("RoutingStateReadService lists sessions sorted by latest activity descending", async () => {
  const store = new RoutingSessionStore();
  store.setTaskState("older", {
    sessionKey: "older",
    primaryKind: "coding",
    primaryModel: "gpt-5.2",
    lastTaskAt: 100,
    lastRouteAt: 200,
  });
  store.setTaskState("newer", {
    sessionKey: "newer",
    primaryKind: "coding",
    primaryModel: "gpt-5.4",
    lastTaskAt: 100,
    lastRouteAt: 300,
  });

  const service = new RoutingStateReadService(store, async () => runtimeView());
  const sessions = await service.listSessions();

  assert.deepEqual(
    sessions.map((item) => item.sessionKey),
    ["newer", "older"],
  );
});

test("RoutingStateReadService returns runtime view and per-session details", async () => {
  const store = new RoutingSessionStore();
  store.setTaskState("s1", {
    sessionKey: "s1",
    primaryKind: "coding",
    primaryModel: "gpt-5.4",
    lastTaskAt: 100,
    lastRouteAt: 200,
  });

  const service = new RoutingStateReadService(store, async () => runtimeView());
  const runtime = await service.getRuntimeView();
  const detail = await service.getSession("s1");
  const missing = await service.getSession("missing");

  assert.equal(runtime.taskModePrimaryKind, "coding");
  assert.equal(detail?.sessionKey, "s1");
  assert.equal(detail?.taskState?.primaryModel, "gpt-5.4");
  assert.equal(missing, null);
});
