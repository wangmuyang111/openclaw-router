import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveRuntimeRouteSessionIdentity,
  resolveRuntimeRouteSessionKey,
} from "./routing-session-key.runtime.js";

test("resolveRuntimeRouteSessionKey prefers sessionKey then sessionId then threadId then conversationId", () => {
  assert.equal(
    resolveRuntimeRouteSessionKey({
      sessionKey: "sk-1",
      sessionId: "sid-1",
      threadId: "thread-1",
      conversationId: "conv-1",
    }),
    "sk-1",
  );

  assert.equal(
    resolveRuntimeRouteSessionKey({
      sessionId: "sid-2",
      threadId: "thread-2",
      conversationId: "conv-2",
    }),
    "sid-2",
  );

  assert.equal(
    resolveRuntimeRouteSessionKey({
      threadId: "thread-3",
      conversationId: "conv-3",
    }),
    "thread-3",
  );

  assert.equal(
    resolveRuntimeRouteSessionKey({
      conversationId: "conv-4",
    }),
    "conv-4",
  );
});

test("resolveRuntimeRouteSessionIdentity reports which runtime field won", () => {
  assert.deepEqual(
    resolveRuntimeRouteSessionIdentity({
      thread_id: "thread-legacy",
      conversationId: "conv-5",
    }),
    {
      key: "thread-legacy",
      source: "thread_id",
    },
  );

  assert.deepEqual(
    resolveRuntimeRouteSessionIdentity({
      chatId: "chat-42",
    }),
    {
      key: "chat-42",
      source: "chatId",
    },
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
