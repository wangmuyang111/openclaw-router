param(
  [string]$ToolsDir = "",
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Get-ToolsDir {
  if (-not [string]::IsNullOrWhiteSpace($ToolsDir)) { return $ToolsDir }
  # default: repo-root\tools\soft-router-suggest
  return (Join-Path $PSScriptRoot '..\tools\soft-router-suggest') | Resolve-Path | Select-Object -ExpandProperty Path
}

$dir = Get-ToolsDir
$routerRules = Join-Path $dir 'router-rules.json'
$priority = Join-Path $dir 'model-priority.json'
$tags = Join-Path $dir 'model-tags.json'
$out = Join-Path $dir 'keyword-library.json'

Write-Host "[compile] toolsDir=$dir" -ForegroundColor Cyan
Write-Host "[compile] reading router-rules.json + model-priority.json" -ForegroundColor Cyan

if (!(Test-Path $routerRules)) { throw "Missing: $routerRules" }
if (!(Test-Path $priority)) { throw "Missing: $priority" }

$rr = Get-Content $routerRules -Raw -Encoding UTF8 | ConvertFrom-Json
$mp = Get-Content $priority -Raw -Encoding UTF8 | ConvertFrom-Json

# Build keywordSets
$sets = [ordered]@{}
function Add-Set([string]$id, $arr) {
  if ($null -eq $arr) { $arr = @() }
  $list = @($arr | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne '' })
  # de-dup while preserving order
  $seen = New-Object 'System.Collections.Generic.HashSet[string]'
  $dedup = New-Object System.Collections.ArrayList
  foreach ($x in $list) {
    if ($seen.Add($x)) { [void]$dedup.Add($x) }
  }
  $sets[$id] = @($dedup)
}

$cats = $rr.categories

# planning
if ($cats.planning) {
  Add-Set 'planning.strong' $cats.planning.strongKeywords
  Add-Set 'planning.weak' $cats.planning.keywords
}
if ($cats.planning_negative) { Add-Set 'planning.negative' $cats.planning_negative.keywords }

# coding
if ($cats.coding) {
  $codingStrong = @()
  if ($cats.coding.strongKeywords) { $codingStrong += @($cats.coding.strongKeywords) }
  if ($cats.coding_strong -and $cats.coding_strong.keywords) { $codingStrong += @($cats.coding_strong.keywords) }
  Add-Set 'coding.strong' $codingStrong

  $codingWeak = @()
  if ($cats.coding.keywords) { $codingWeak += @($cats.coding.keywords) }
  if ($cats.coding_weak -and $cats.coding_weak.keywords) { $codingWeak += @($cats.coding_weak.keywords) }
  Add-Set 'coding.weak' $codingWeak
}
if ($cats.coding_negative) { Add-Set 'coding.negative' $cats.coding_negative.keywords }

# vision
if ($cats.vision) { Add-Set 'vision.weak' $cats.vision.keywords }

# daily_support
if ($cats.daily_support) { Add-Set 'daily_support.weak' $cats.daily_support.keywords }

# quick_response
if ($cats.quick_response) {
  Add-Set 'quick_response.strong' $cats.quick_response.strongKeywords
  Add-Set 'quick_response.weak' $cats.quick_response.keywords
}
if ($cats.quick_response_negative) { Add-Set 'quick_response.negative' $cats.quick_response_negative.keywords }

# emergency_fallback
if ($cats.emergency_fallback) { Add-Set 'emergency_fallback.weak' $cats.emergency_fallback.keywords }

# advanced_coding
if ($cats.advanced_coding) {
  Add-Set 'advanced_coding.strong' $cats.advanced_coding.strongKeywords
  Add-Set 'advanced_coding.weak' $cats.advanced_coding.keywords
}

# general
if ($cats.general) { Add-Set 'general.weak' $cats.general.keywords }
if ($cats.general_negative) { Add-Set 'general.negative' $cats.general_negative.keywords }

# chat (simple): reuse quick_response weak? keep empty for now
Add-Set 'chat.weak' @()

# Build kinds (9 kinds from router-rules.json)
$kinds = [ordered]@{}
$kindIds = @($rr.kinds.PSObject.Properties | ForEach-Object { $_.Name })

function Kind-Rule([string]$id, [int]$priority) {
  # Defaults tuned to your existing semantics:
  # - strong set weight=3, weak=1
  # - negative set weight=-4, exclude=false (penalty)
  # - minScore/minStrongHits vary by kind
  $signals = [ordered]@{ positive=@(); negative=@(); metadata=@(); regex=@() }

  # attach sets if exist
  if ($sets.Contains($id + '.strong')) {
    $signals.positive += @([ordered]@{ set = ($id + '.strong'); weight = 3; match = 'contains' })
  }
  if ($sets.Contains($id + '.weak')) {
    $signals.positive += @([ordered]@{ set = ($id + '.weak'); weight = 1; match = 'contains' })
  }
  if ($sets.Contains($id + '.negative')) {
    $signals.negative += @([ordered]@{ set = ($id + '.negative'); weight = -4; match = 'contains'; exclude = $false })
  }

  # special metadata rules
  if ($id -eq 'vision') {
    $signals.metadata += @([ordered]@{ field='hasImage'; equals=$true; weight=10; exclude=$false })
  }
  if ($id -eq 'coding') {
    $signals.metadata += @([ordered]@{ field='hasCodeBlock'; equals=$true; weight=2; exclude=$false })
  }

  $thresholds = switch ($id) {
    'planning'          { [ordered]@{ minScore=2; highScore=6; minStrongHits=1 } }
    'coding'            { [ordered]@{ minScore=2; highScore=6; minStrongHits=1 } }
    'advanced_coding'   { [ordered]@{ minScore=2; highScore=7; minStrongHits=1 } }
    'vision'            { [ordered]@{ minScore=3; highScore=10; minStrongHits=0 } }
    'quick_response'    { [ordered]@{ minScore=2; highScore=5; minStrongHits=1 } }
    'daily_support'     { [ordered]@{ minScore=2; highScore=5; minStrongHits=0 } }
    'emergency_fallback'{ [ordered]@{ minScore=1; highScore=4; minStrongHits=0 } }
    'general'           { [ordered]@{ minScore=2; highScore=6; minStrongHits=0 } }
    'chat'              { [ordered]@{ minScore=0; highScore=0; minStrongHits=0 } }
    default             { [ordered]@{ minScore=2; highScore=6; minStrongHits=0 } }
  }

  $modelList = @()
  if ($mp.kinds.$id) { $modelList = @($mp.kinds.$id) }
  elseif ($mp.kinds.default) { $modelList = @($mp.kinds.default) }

  return [ordered]@{
    id = $id
    name = $id
    priority = $priority
    enabled = $true
    signals = $signals
    thresholds = $thresholds
    models = [ordered]@{ strategy='priority_list'; list=$modelList }
  }
}

# map priorities from router-rules if possible (category priority). For now use a stable manual map.
$prioMap = @{
  planning=100; coding=90; vision=80; daily_support=70; quick_response=60; emergency_fallback=50; advanced_coding=40; general=30; chat=0
}

foreach ($kid in $kindIds) {
  $prio = if ($prioMap.ContainsKey($kid)) { [int]$prioMap[$kid] } else { 10 }
  $kinds[$kid] = (Kind-Rule $kid $prio)
}

$lib = [ordered]@{
  '$schema' = './keyword-library.schema.json'
  version = 1
  updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  notes = 'Generated from router-rules.json and model-priority.json. Do not hand-edit generated sections unless you know what you are doing.'
  defaultFallbackKind = 'chat'
  normalization = [ordered]@{ lowercase=$true; trim=$true; collapseWhitespace=$true }
  keywordSets = $sets
  kinds = $kinds
}

$json = $lib | ConvertTo-Json -Depth 50
Set-Content -Path $out -Value $json -Encoding UTF8
Write-Host "[compile] wrote: $out" -ForegroundColor Green
