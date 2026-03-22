import test from "node:test";
import assert from "node:assert/strict";

import { detectExplicitTaskSwitch, normalizeLooseText } from "./sticky-explicit-switch.js";
import { stickyRegressionCases } from "./sticky-regression-cases.js";

test("normalizeLooseText removes spaces and punctuation for loose matching", () => {
  assert.equal(normalizeLooseText("  先别换， 继续这个！ "), "先别换继续这个");
});

test("sticky explicit-switch regression cases", async (t) => {
  for (const c of stickyRegressionCases) {
    await t.test(`${c.id} ${c.input}`, () => {
      const actual = detectExplicitTaskSwitch(c.input);
      const actualReason = actual?.reason ?? null;
      assert.equal(
        actualReason,
        c.expectedReason,
        `${c.id} expected ${String(c.expectedReason)} but got ${String(actualReason)}; note=${c.note ?? ""}`,
      );
    });
  }
});
