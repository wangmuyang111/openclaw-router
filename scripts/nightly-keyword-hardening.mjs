import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const libPath = path.join(repoRoot, "tools", "soft-router-suggest", "keyword-library.json");
const statePath = path.join(repoRoot, "scripts", "nightly-keyword-hardening.state.json");
const reportPath = path.join(repoRoot, "scripts", "nightly-keyword-hardening.report.json");

const fpReportPath = path.join(repoRoot, "scripts", "regression-coding-fp.report.json");
const e2eReportPath = path.join(repoRoot, "scripts", "regression-coding-e2e.report.json");

const BATCH_SIZE = Number(process.env.HARDEN_BATCH_SIZE ?? 2);
const SLEEP_MS = Number(process.env.HARDEN_SLEEP_MS ?? 120000); // 2 min
const MAX_BATCHES = Number(process.env.HARDEN_MAX_BATCHES ?? 200);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function now() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureState(lib) {
  if (fs.existsSync(statePath)) return readJson(statePath);

  const ks = lib.keywordSets ?? {};
  const wired = new Set((lib.kinds?.coding?.signals?.positive ?? []).map((x) => x.set));

  const candidates = Object.keys(ks)
    .filter((id) =>
      id.startsWith("coding.feature.") || id.startsWith("coding.scenario.") || id.startsWith("coding.lang."),
    )
    .filter((id) => !wired.has(id))
    .filter((id) => !id.endsWith(".strong"))
    .sort();

  const state = {
    generatedAt: now(),
    policy: {
      fpMax: 0,
      tpMissMax: 0,
      batchSize: BATCH_SIZE,
      tryWeight: 2,
      useStrongAlias: true,
    },
    queue: candidates.map((id) => ({ id, status: "pending" })),
    progress: {
      cursor: 0,
      enabled: [],
      blocked: [],
      skipped: [],
      last: null,
    },
  };

  writeJson(statePath, state);
  return state;
}

function isHighRiskSetId(setId) {
  // We treat file extensions and common sets as high-risk by default.
  if (setId.includes("file_ext")) return true;
  return false;
}

function ensureStrongAlias(lib, setId) {
  if (setId.endsWith(".strong")) return setId;
  const strongId = `${setId}.strong`;
  lib.keywordSets = lib.keywordSets || {};
  if (!lib.keywordSets[setId]) return null;
  if (!lib.keywordSets[strongId]) lib.keywordSets[strongId] = lib.keywordSets[setId];
  return strongId;
}

function addPositiveSignal(lib, setId, weight) {
  lib.kinds = lib.kinds || {};
  lib.kinds.coding = lib.kinds.coding || {};
  lib.kinds.coding.signals = lib.kinds.coding.signals || { positive: [], negative: [], metadata: [], regex: [] };
  lib.kinds.coding.signals.positive = lib.kinds.coding.signals.positive || [];

  if (lib.kinds.coding.signals.positive.some((s) => s.set === setId)) return false;
  lib.kinds.coding.signals.positive.push({ set: setId, weight, match: "contains" });
  return true;
}

function runRegressions() {
  execSync("node scripts/regression-coding-fp.run.mjs", { cwd: repoRoot, stdio: "inherit" });
  execSync("node scripts/regression-coding-e2e.run.mjs", { cwd: repoRoot, stdio: "inherit" });
  const fp = readJson(fpReportPath);
  const e2e = readJson(e2eReportPath);
  return {
    fpHits: fp.summary.current.codingHits,
    tpMiss: e2e.summary.tpMissedCoding,
    fpFalseList: fp.falsePositivesWorstCase ?? [],
  };
}

function pickNextBatch(state) {
  const batch = [];
  for (let i = state.progress.cursor; i < state.queue.length && batch.length < state.policy.batchSize; i++) {
    const item = state.queue[i];
    if (item.status === "pending") batch.push(i);
  }
  return batch;
}

async function main() {
  const lib0 = readJson(libPath);
  const state0 = ensureState(lib0);

  // Baseline check
  const baseline = runRegressions();
  if (baseline.fpHits !== 0 || baseline.tpMiss !== 0) {
    throw new Error(`Baseline not clean: fpHits=${baseline.fpHits} tpMiss=${baseline.tpMiss}`);
  }

  let state = state0;
  let batches = 0;

  while (batches < MAX_BATCHES) {
    const batchIdx = pickNextBatch(state);
    if (batchIdx.length === 0) break;

    const libBase = readJson(libPath);
    const lib = JSON.parse(JSON.stringify(libBase));

    const enabled = [];
    for (const idx of batchIdx) {
      const id = state.queue[idx].id;

      if (isHighRiskSetId(id)) {
        state.queue[idx].status = "skipped";
        state.queue[idx].reason = "high-risk setId policy";
        state.progress.skipped.push({ id, reason: state.queue[idx].reason });
        continue;
      }

      const useId = state.policy.useStrongAlias ? ensureStrongAlias(lib, id) : id;
      if (!useId) {
        state.queue[idx].status = "skipped";
        state.queue[idx].reason = "missing set";
        state.progress.skipped.push({ id, reason: state.queue[idx].reason });
        continue;
      }

      addPositiveSignal(lib, useId, state.policy.tryWeight);
      enabled.push(useId);
    }

    state.progress.cursor = Math.max(...batchIdx) + 1;

    if (enabled.length === 0) {
      state.progress.last = { at: now(), ok: true, enabled: [], note: "nothing enabled in batch" };
      writeJson(statePath, state);
      await sleep(10);
      continue;
    }

    lib.updatedAt = now();
    lib.notes = (lib.notes || "") + `\n[auto-hardening] trial enable: ${enabled.join(", ")}`;
    writeJson(libPath, lib);

    const res = runRegressions();

    const ok = res.fpHits <= state.policy.fpMax && res.tpMiss <= state.policy.tpMissMax;

    if (ok) {
      for (const idx of batchIdx) {
        const id = state.queue[idx].id;
        if (state.queue[idx].status === "pending") {
          state.queue[idx].status = "enabled";
          state.progress.enabled.push(id);
        }
      }
      state.progress.last = { at: now(), ok: true, enabled, fpHits: res.fpHits, tpMiss: res.tpMiss };
      writeJson(statePath, state);
    } else {
      // rollback
      writeJson(libPath, libBase);
      runRegressions();
      for (const idx of batchIdx) {
        const id = state.queue[idx].id;
        state.queue[idx].status = "blocked";
        state.queue[idx].reason = {
          fpHits: res.fpHits,
          tpMiss: res.tpMiss,
          examples: (res.fpFalseList || []).slice(0, 5),
        };
        state.progress.blocked.push({ id, reason: state.queue[idx].reason });
      }
      state.progress.last = { at: now(), ok: false, enabled, fpHits: res.fpHits, tpMiss: res.tpMiss };
      writeJson(statePath, state);
    }

    batches += 1;
    await sleep(SLEEP_MS);
  }

  // Final report
  const final = readJson(statePath);
  const q = final.queue;
  const count = (st) => q.filter((x) => x.status === st).length;
  const report = {
    generatedAt: now(),
    total: q.length,
    enabled: count("enabled"),
    blocked: count("blocked"),
    skipped: count("skipped"),
    pending: count("pending"),
    last: final.progress.last,
    enabledIds: final.progress.enabled,
    blocked: final.progress.blocked,
    skipped: final.progress.skipped,
  };
  writeJson(reportPath, report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
