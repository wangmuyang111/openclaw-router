import test from "node:test";
import assert from "node:assert/strict";

import { resolveRuntimeRouteSessionKey } from "./routing-session-key.runtime.js";

test("resolveRuntimeRouteSessionKey prefers sessionKey then sessionId then conversationId", () => {
  assert.equal(
    resolveRuntimeRouteSessionKey({
      sessionKey: "sk-1",
      sessionId: "sid-1",
      conversationId: "conv-1",
    }),
    "sk-1",
  );

  assert.equal(
    resolveRuntimeRouteSessionKey({
      sessionId: "sid-2",
      conversationId: "conv-2",
    }),
    "sid-2",
  );

  assert.equal(
    resolveRuntimeRouteSessionKey({
      conversationId: "conv-3",
    }),
    "conv-3",
  );
});

test("resolveRuntimeRouteSessionKey falls back to provider/account tuple", () => {
  assert.equal(
    resolveRuntimeRouteSessionKey({
      messageProvider: "telegram",
      accountId: "acct-1",
    }),
    "runtime-fallback:telegram:acct-1",
  );
});
