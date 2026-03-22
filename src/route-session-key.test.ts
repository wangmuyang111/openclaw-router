import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveRouteSessionIdentity,
  resolveRouteSessionKey,
} from "./route-session-key.js";

test("resolveRouteSessionKey prefers explicit sessionKey", () => {
  const value = resolveRouteSessionKey(
    {
      sessionKey: "session-123",
      conversationId: "conv-1",
      channelId: "discord",
      accountId: "acct-1",
    },
    {
      from: "alice",
      metadata: {
        sessionKey: "session-from-metadata",
        threadId: "thread-1",
      },
    },
  );

  assert.equal(value, "session-123");
});

test("resolveRouteSessionIdentity reports message-side source", () => {
  assert.deepEqual(
    resolveRouteSessionIdentity(
      {
        conversationId: "conv-1",
        channelId: "discord",
        accountId: "acct-1",
      },
      {
        from: "alice",
        metadata: {
          thread_id: "thread-legacy",
          conversationId: "conv-meta",
        },
      },
    ),
    {
      key: "thread-legacy",
      source: "metadata.thread_id",
    },
  );

  assert.deepEqual(
    resolveRouteSessionIdentity(
      {
        channelId: "telegram",
        accountId: "acct-9",
      },
      {
        from: "bob",
        metadata: {
          chatId: "chat-42",
        },
      },
    ),
    {
      key: "chat-42",
      source: "metadata.chatId",
    },
  );
});

test("resolveRouteSessionKey falls back to provider/account/from tuple", () => {
  const value = resolveRouteSessionKey(
    {
      channelId: "telegram",
      accountId: "acct-9",
    },
    {
      from: "bob",
      metadata: {},
    },
  );

  assert.equal(value, "fallback:telegram:acct-9:bob");
});
