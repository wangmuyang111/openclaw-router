import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function defaultLogPath() {
  return path.join(os.homedir(), ".openclaw", "logs", "soft-router-suggest.jsonl");
}

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function bump(map, key) {
  const safe = String(key ?? "(missing)");
  map.set(safe, (map.get(safe) ?? 0) + 1);
}

function topEntries(map) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function pct(part, total) {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultLogPath();
if (!fs.existsSync(filePath)) {
  console.error(`log file not found: ${filePath}`);
  process.exit(1);
}

const rows = readJsonl(filePath).filter(
  (row) => row && row.type === "soft_router_suggest" && typeof row.event === "string",
);

const interestingEvents = new Set([
  "route_decision_cached",
  "route_cache_hit",
  "route_cache_untrusted",
  "route_cache_miss",
  "route_cache_expired",
]);
const events = rows.filter((row) => interestingEvents.has(row.event));

const byEvent = new Map();
const messageIdentitySource = new Map();
const runtimeIdentitySource = new Map();
const matchSource = new Map();
const trustLevel = new Map();
const trustReason = new Map();
const kindOnHit = new Map();

for (const row of events) {
  bump(byEvent, row.event);
  if (row.messageIdentitySource) bump(messageIdentitySource, row.messageIdentitySource);
  if (row.runtimeIdentitySource) bump(runtimeIdentitySource, row.runtimeIdentitySource);
  if (row.matchSource) bump(matchSource, row.matchSource);
  if (row.trustLevel) bump(trustLevel, row.trustLevel);
  if (row.trustReason) bump(trustReason, row.trustReason);
  if ((row.event === "route_cache_hit" || row.event === "route_cache_untrusted") && row.kind) {
    bump(kindOnHit, row.kind);
  }
}

const hits = byEvent.get("route_cache_hit") ?? 0;
const untrusted = byEvent.get("route_cache_untrusted") ?? 0;
const misses = byEvent.get("route_cache_miss") ?? 0;
const expired = byEvent.get("route_cache_expired") ?? 0;
const cached = byEvent.get("route_decision_cached") ?? 0;
const lookedUp = hits + untrusted + misses + expired;

console.log(`# Runtime routing summary`);
console.log(`log: ${filePath}`);
console.log(`total interesting events: ${events.length}`);
console.log("");
console.log(`cached decisions : ${cached}`);
console.log(`cache hit        : ${hits} (${pct(hits, lookedUp)})`);
console.log(`cache untrusted  : ${untrusted} (${pct(untrusted, lookedUp)})`);
console.log(`cache miss       : ${misses} (${pct(misses, lookedUp)})`);
console.log(`cache expired    : ${expired} (${pct(expired, lookedUp)})`);
console.log("");

function printSection(title, map) {
  const entries = topEntries(map);
  console.log(`## ${title}`);
  if (!entries.length) {
    console.log(`(none)`);
    console.log("");
    return;
  }
  for (const [key, value] of entries) {
    console.log(`- ${key}: ${value}`);
  }
  console.log("");
}

printSection("messageIdentitySource", messageIdentitySource);
printSection("runtimeIdentitySource", runtimeIdentitySource);
printSection("matchSource", matchSource);
printSection("trustLevel", trustLevel);
printSection("trustReason", trustReason);
printSection("kind on hit/untrusted", kindOnHit);

console.log(`## Quick read`);
if (!lookedUp) {
  console.log(`- No route cache lookup events yet. Generate real multi-window traffic first.`);
} else {
  console.log(`- Trusted hit ratio = ${pct(hits, lookedUp)}`);
  console.log(`- Untrusted ratio   = ${pct(untrusted, lookedUp)}`);
  console.log(`- Miss ratio        = ${pct(misses, lookedUp)}`);
  if ((runtimeIdentitySource.get("fallback") ?? 0) > 0) {
    console.log(`- Fallback runtime identity is still appearing; inspect those windows first.`);
  }
  if ((matchSource.get("messageHash") ?? 0) > 0) {
    console.log(`- messageHash is still participating in lookup; confirm it is not becoming the dominant path.`);
  }
  if (untrusted > hits) {
    console.log(`- Untrusted lookups exceed trusted hits; not ready for default-on rollout.`);
  }
}
