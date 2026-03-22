import test from "node:test";
import assert from "node:assert/strict";

import { routeByWeightedRules, type CompiledKindRule, type CompiledRoutingRules } from "./weighted-routing-engine.core.js";

function kind(id: string, opts?: Partial<CompiledKindRule>): CompiledKindRule {
  return {
    id,
    priority: 0,
    enabled: true,
    positive: [],
    negative: [],
    metadata: [],
    regex: [],
    thresholds: { minScore: 2, highScore: 6, minStrongHits: 0 },
    models: { strategy: "priority_list", list: [] },
    ...opts,
  };
}

test("chat does not participate in weighted match; only fallback", () => {
  const rules: CompiledRoutingRules = {
    version: 1,
    compiledAt: new Date().toISOString(),
    defaultFallbackKind: "chat",
    kinds: [
      kind("chat", {
        // Even if chat would be eligible by thresholds, it must be excluded from match.
        thresholds: { minScore: 0, highScore: 0, minStrongHits: 0 },
        positive: [
          { keywords: ["hello"], weight: 1, match: "contains", exclude: false, sourceSet: "chat.weak" },
        ],
      }),
      kind("coding", {
        priority: 10,
        thresholds: { minScore: 2, highScore: 6, minStrongHits: 0 },
        positive: [
          { keywords: ["tsc"], weight: 3, match: "contains", exclude: false, sourceSet: "coding.strong" },
        ],
      }),
    ],
  };

  const d1 = routeByWeightedRules({ rules, content: "hello" });
  assert.equal(d1.kind, "chat");
  assert.equal(d1.score, 0);

  const d2 = routeByWeightedRules({ rules, content: "tsc build failed" });
  assert.equal(d2.kind, "coding");
  assert.ok(d2.score >= 2);
});

test("defaultFallbackKind also does not participate in match", () => {
  const rules: CompiledRoutingRules = {
    version: 1,
    compiledAt: new Date().toISOString(),
    defaultFallbackKind: "general",
    kinds: [
      kind("general", {
        thresholds: { minScore: 0, highScore: 0, minStrongHits: 0 },
        positive: [
          { keywords: ["anything"], weight: 1, match: "contains", exclude: false, sourceSet: "general.weak" },
        ],
      }),
      kind("coding", {
        priority: 10,
        thresholds: { minScore: 2, highScore: 6, minStrongHits: 0 },
        positive: [
          { keywords: ["error"], weight: 3, match: "contains", exclude: false, sourceSet: "coding.strong" },
        ],
      }),
    ],
  };

  const d1 = routeByWeightedRules({ rules, content: "anything" });
  // Still fallback, but score remains 0 because fallback kind never participates.
  assert.equal(d1.kind, "general");
  assert.equal(d1.score, 0);

  const d2 = routeByWeightedRules({ rules, content: "error: boom" });
  assert.equal(d2.kind, "coding");
});
