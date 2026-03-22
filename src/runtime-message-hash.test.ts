import test from "node:test";
import assert from "node:assert/strict";

import {
  computeRuntimeMessageHash,
  getLastUserMessageText,
} from "./runtime-message-hash.js";

test("getLastUserMessageText returns the last user message string", () => {
  assert.equal(
    getLastUserMessageText([
      { role: "system", content: "sys" },
      { role: "user", content: "first" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "final question" },
    ]),
    "final question",
  );
});

test("getLastUserMessageText supports array content with text blocks", () => {
  assert.equal(
    getLastUserMessageText([
      {
        role: "user",
        content: [
          { type: "input_text", text: "hello" },
          { type: "input_text", text: "world" },
        ],
      },
    ]),
    "hello\nworld",
  );
});

test("computeRuntimeMessageHash prefers last user message over prompt", () => {
  const result = computeRuntimeMessageHash({
    prompt: "SYSTEM\nUSER: expanded prompt",
    messages: [
      { role: "assistant", content: "old" },
      { role: "user", content: "just hash me" },
    ],
  });

  assert.equal(result.source, "last_user_message");
  assert.equal(result.text, "just hash me");
  assert.equal(result.hash.length, 16);
});

test("computeRuntimeMessageHash falls back to prompt when no user message exists", () => {
  const result = computeRuntimeMessageHash({
    prompt: "prompt only",
    messages: [{ role: "assistant", content: "reply" }],
  });

  assert.equal(result.source, "prompt");
  assert.equal(result.text, "prompt only");
  assert.equal(result.hash.length, 16);
});
