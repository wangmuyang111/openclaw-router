import test from "node:test";
import assert from "node:assert/strict";

import { createRoutingDemoPageContract, renderRoutingDemoPageText } from "./routing-control-demo-renderer.js";
import type { RoutingPageModel } from "./routing-control-page-model.js";

test("createRoutingDemoPageContract maps page model into renderable demo blocks", () => {
  const model: RoutingPageModel = {
    pageTitle: "Routing Control",
    selectedSessionKey: "session/alpha",
    runtimePanel: {
      title: "Runtime",
      status: "success",
      summaryLines: ["Task mode: enabled", "Primary kind: coding"],
    },
    sessionsPanel: {
      title: "Sessions",
      status: "success",
      items: [
        {
          sessionKey: "session/alpha",
          isSelected: true,
          primaryLabel: "coding · gpt-5.4",
          temporaryLabel: "vision · vision-model",
          pendingLabel: "vision · vision-model",
          activityLabel: "Last activity: 2026-03-22T12:00:00.000Z",
        },
      ],
    },
    detailPanel: {
      title: "Session Detail",
      status: "success",
      sessionKey: "session/alpha",
      fields: [
        { label: "Session", value: "session/alpha" },
        { label: "Primary", value: "coding · gpt-5.4" },
      ],
    },
    lastLoadedAtLabel: "2026-03-22T12:00:05.000Z",
  };

  const contract = createRoutingDemoPageContract(model);

  assert.equal(contract.title, "Routing Control");
  assert.equal(contract.blocks.length, 3);
  assert.equal(contract.blocks[0]?.title, "Runtime [success]");
  assert.match(contract.blocks[1]?.lines[0] ?? "", /session\/alpha/);
  assert.match(contract.blocks[2]?.lines[0] ?? "", /Session: session\/alpha/);
});

test("renderRoutingDemoPageText renders a readable mock page text", () => {
  const contract = createRoutingDemoPageContract({
    pageTitle: "Routing Control",
    selectedSessionKey: undefined,
    runtimePanel: {
      title: "Runtime",
      status: "error",
      summaryLines: [],
      message: "Something went wrong",
    },
    sessionsPanel: {
      title: "Sessions",
      status: "success",
      items: [],
      emptyMessage: "No sessions available",
    },
    detailPanel: {
      title: "Session Detail",
      status: "idle",
      fields: [],
      emptyMessage: "No session selected",
      message: "Waiting for selection",
    },
    lastLoadedAtLabel: "2026-03-22T12:00:05.000Z",
  });

  const text = renderRoutingDemoPageText(contract);

  assert.match(text, /^# Routing Control/m);
  assert.match(text, /## Runtime \[error\]/);
  assert.match(text, /Something went wrong/);
  assert.match(text, /No sessions available/);
  assert.match(text, /No session selected/);
});
