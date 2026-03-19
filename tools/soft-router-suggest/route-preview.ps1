param(
  [Parameter(Mandatory=$true)]
  [string]$Text,

  [switch]$HasImage,
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

# Pure local preview: NO LLM calls.
$meta = @{}
if ($HasImage) { $meta.hasImage = $true }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$libModule = ($repoRoot -replace "\\","/") + "/plugin/keyword-library.ts"
$engineModule = ($repoRoot -replace "\\","/") + "/plugin/weighted-routing-engine.ts"

$node = @"
import { loadAndCompileRoutingRules } from 'file:///$libModule';
import { routeByWeightedRules } from 'file:///$engineModule';

const libraryPath = process.argv[2];
const overridesPath = process.argv[3];
const text = process.argv[4];
const hasImage = process.argv[5] === '1';

const { compiled, warnings } = await loadAndCompileRoutingRules({ libraryPath, overridesPath });
const decision = routeByWeightedRules({
  rules: compiled,
  content: text,
  metadata: hasImage ? { hasImage: true } : {},
  maxExplainTerms: 10,
});

console.log(JSON.stringify({ warnings, decision }, null, 2));
"@

$tmp = New-TemporaryFile
$js = "$($tmp.FullName).mjs"
Move-Item -Path $tmp.FullName -Destination $js -Force
Set-Content -Path $js -Value $node -Encoding UTF8

$hasImageFlag = if ($HasImage) { '1' } else { '0' }
node $js $LibraryPath $OverridesPath $Text $hasImageFlag

Remove-Item $js -Force
