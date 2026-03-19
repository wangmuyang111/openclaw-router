param(
  [Parameter(Mandatory=$true)]
  [string]$Kind,

  [Parameter(Mandatory=$true)]
  [string]$TestText,

  [string]$LibraryPath = "",
  [string]$OverridesPath = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($LibraryPath)) {
  $LibraryPath = Join-Path $PSScriptRoot 'keyword-library.json'
}
if ([string]::IsNullOrWhiteSpace($OverridesPath)) {
  $OverridesPath = Join-Path $PSScriptRoot 'keyword-overrides.user.json'
}

# Pure local: NO LLM calls. Uses the same TS engine as plugin runtime.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$libModule = ($repoRoot -replace "\\","/") + "/plugin/keyword-library.ts"
$engineModule = ($repoRoot -replace "\\","/") + "/plugin/weighted-routing-engine.ts"

$node = @"
import { loadAndCompileRoutingRules } from 'file:///$libModule';
import { routeByWeightedRules } from 'file:///$engineModule';

const libraryPath = process.argv[2];
const overridesPath = process.argv[3];
const kind = process.argv[4];
const text = process.argv[5];

const { compiled } = await loadAndCompileRoutingRules({ libraryPath, overridesPath });

if (!compiled.kinds[kind]) {
  console.error('Unknown kind: ' + kind);
  process.exit(2);
}

const decision = routeByWeightedRules({
  rules: compiled,
  content: text,
  metadata: {},
  maxExplainTerms: 10,
});

const ok = decision.kind === kind;
console.log(JSON.stringify({ ok, expectedKind: kind, gotKind: decision.kind, score: decision.score, confidence: decision.confidence, explain: decision.explain?.slice(0,10) }, null, 2));
process.exit(ok ? 0 : 1);
"@

$tmp = New-TemporaryFile
$js = "$($tmp.FullName).mjs"
Move-Item -Path $tmp.FullName -Destination $js -Force
Set-Content -Path $js -Value $node -Encoding UTF8

node $js $LibraryPath $OverridesPath $Kind $TestText

Remove-Item $js -Force
