# Nightly keyword hardening plan (conservative)

Goal: stabilize safety boundary (FP=0) while gradually enabling more coding keyword sets.

## Definitions
- **Wired**: set is referenced by `kinds.coding.signals.*` (affects routing).
- **In library only**: set exists in `keywordSets` but not wired.
- **Processed**: one of:
  1) safely wired (passes FP/TP gates)
  2) explicitly blocked with reason + recommended remediation (regex/context/rename)
  3) explicitly skipped (too ambiguous / low value)

## Hard safety gates
- FP gate: `regression-coding-fp` current.codingHits must be **0**.
- TP gate: `regression-coding-e2e` tpMissedCoding must stay **0** (no recall regression).

## Batch strategy
- Batch size: 1~2 sets per batch.
- Trial wiring: create `*.strong` alias (so it counts as strongHit) and wire with weight=2.
- If gate fails: rollback library change; mark set as blocked with triggering FP ids + matched terms.

## High-risk set policy (do NOT wire via contains)
- File extension sets (e.g. `.m`, `.rs`, `.pl`) are high FP risk (times, URLs). Keep library-only unless converted to regex with strict context.
- Short/ambiguous tokens (`pip`, `CI`, `pipeline`, `cargo`, `bun`, `rails`, `go`, `rust` as plain words) must be regex+boundary or contextual phrases.

## Tonight schedule (Asia/Shanghai)
- T0 (now): snapshot baseline + verify FP=0/TP=0
- T0~T0+60m: iterate safe sets first (package files / build toolchain already done; then language-specific strong scenario sets)
- T0+60m~T0+120m: process common scenario sets (most will be blocked unless sanitized)
- T0+120m+: produce final status report: enabled / blocked / skipped + next-day remediation list

Outputs:
- `scripts/nightly-keyword-hardening.state.json`
- `scripts/nightly-keyword-hardening.report.json`
- regression reports: `scripts/regression-coding-fp.report.json`, `scripts/regression-coding-e2e.report.json`
