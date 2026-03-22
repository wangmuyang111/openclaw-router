import test from "node:test";
import assert from "node:assert/strict";

import { mapRoutingDashboardToPageModel } from "./routing-control-page-model.js";
import type { RoutingDashboardState } from "./routing-control-dashboard.js";

test("mapRoutingDashboardToPageModel maps dashboard state into UI-friendly panel props", () => {
  const state: RoutingDashboardState = {
    selectedSessionKey: "session/alpha",
    runtime: {
      status: "success",
      data: {
        taskModeEnabled: true,
        taskModePrimaryKind: "coding",
        taskModeKinds: ["coding", "vision"],
        taskModeDisabledKinds: [],
        taskModeMinConfidence: "medium",
        taskModeReturnToPrimary: true,
        taskModeReturnModel: "",
        taskModeAllowAutoDowngrade: false,
        freeSwitchWhenTaskModeOff: true,
      },
    },
    sessions: {
      status: "success",
      items: [
        {
          sessionKey: "session/alpha",
          lastActivityAtMs: 1711080000000,
          primaryKind: "coding",
          primaryModel: "gpt-5.4",
          temporaryKind: "vision",
          temporaryModel: "vision-model",
          hasPendingRouteDecision: true,
          pendingKind: "vision",
          pendingCandidateModel: "vision-model",
        },
      ],
    },
    detail: {
      status: "success",
      sessionKey: "session/alpha",
      data: {
        sessionKey: "session/alpha",
        taskState: {
          sessionKey: "session/alpha",
          primaryKind: "coding",
          primaryModel: "gpt-5.4",
          temporaryKind: "vision",
          temporaryModel: "vision-model",
          lastTaskAt: 100,
          lastRouteAt: 200,
        },
        routeDecision: {
          sessionKey: "session/alpha",
          messageHash: "hash",
          kind: "vision",
          confidence: "high",
          candidateModel: "vision-model",
          reason: "image",
          signals: ["has_image"],
          createdAtMs: 100,
          expiresAtMs: 200,
          source: "message_received",
        },
      },
    },
    lastLoadedAtMs: 1711080005000,
  };

  const model = mapRoutingDashboardToPageModel(state);

  assert.equal(model.pageTitle, "Routing Control");
  assert.equal(model.runtimePanel.title, "Runtime");
  assert.equal(model.runtimePanel.summaryLines[0], "Task mode: enabled");

  assert.equal(model.sessionsPanel.items.length, 1);
  assert.equal(model.sessionsPanel.items[0]?.isSelected, true);
  assert.equal(model.sessionsPanel.items[0]?.primaryLabel, "coding · gpt-5.4");
  assert.equal(model.sessionsPanel.items[0]?.temporaryLabel, "vision · vision-model");
  assert.equal(model.sessionsPanel.items[0]?.pendingLabel, "vision · vision-model");

  assert.equal(model.detailPanel.sessionKey, "session/alpha");
  assert.equal(model.detailPanel.fields[0]?.value, "session/alpha");
  assert.equal(model.detailPanel.fields[1]?.value, "coding · gpt-5.4");
  assert.equal(model.lastLoadedAtLabel, new Date(1711080005000).toISOString());
});

test("mapRoutingDashboardToPageModel provides empty-state messaging for idle detail panel", () => {
  const state: RoutingDashboardState = {
    selectedSessionKey: undefined,
    runtime: {
      status: "success",
      data: {
        taskModeEnabled: false,
        taskModePrimaryKind: "coding",
        taskModeKinds: [],
        taskModeDisabledKinds: [],
        taskModeMinConfidence: "medium",
        taskModeReturnToPrimary: true,
        taskModeReturnModel: "",
        taskModeAllowAutoDowngrade: false,
        freeSwitchWhenTaskModeOff: true,
      },
    },
    sessions: {
      status: "success",
      items: [],
    },
    detail: {
      status: "idle",
    },
    lastLoadedAtMs: 1,
  };

  const model = mapRoutingDashboardToPageModel(state);

  assert.equal(model.sessionsPanel.emptyMessage, "No sessions available");
  assert.equal(model.detailPanel.emptyMessage, "No session selected");
  assert.equal(model.detailPanel.message, "Waiting for selection");
});
