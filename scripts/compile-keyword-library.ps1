param(
  [string]$ToolsDir = "",
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Get-ToolsDir {
  if (-not [string]::IsNullOrWhiteSpace($ToolsDir)) { return $ToolsDir }
  return (Join-Path $PSScriptRoot '..\tools\soft-router-suggest') | Resolve-Path | Select-Object -ExpandProperty Path
}

$dir = Get-ToolsDir
$routerRules = Join-Path $dir 'router-rules.json'
$priority = Join-Path $dir 'model-priority.json'
$out = Join-Path $dir 'keyword-library.json'

Write-Host "[compile] toolsDir=$dir" -ForegroundColor Cyan
Write-Host "[compile] reading router-rules.json + model-priority.json" -ForegroundColor Cyan

if (!(Test-Path $routerRules)) { throw "Missing: $routerRules" }
if (!(Test-Path $priority)) { throw "Missing: $priority" }

$rr = Get-Content $routerRules -Raw -Encoding UTF8 | ConvertFrom-Json
$mp = Get-Content $priority -Raw -Encoding UTF8 | ConvertFrom-Json

$sets = [ordered]@{}
function Add-Set([string]$id, $arr) {
  if ($null -eq $arr) { $arr = @() }
  $list = @($arr | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne '' })
  $seen = New-Object 'System.Collections.Generic.HashSet[string]'
  $dedup = New-Object System.Collections.ArrayList
  foreach ($x in $list) {
    if ($seen.Add($x)) { [void]$dedup.Add($x) }
  }
  $sets[$id] = @($dedup)
}

$cats = $rr.categories

# strategy = planning + advanced_coding
$strategyStrong = @()
if ($cats.planning -and $cats.planning.strongKeywords) { $strategyStrong += @($cats.planning.strongKeywords) }
if ($cats.advanced_coding -and $cats.advanced_coding.strongKeywords) { $strategyStrong += @($cats.advanced_coding.strongKeywords) }
Add-Set 'strategy.strong' $strategyStrong

$strategyWeak = @()
if ($cats.planning -and $cats.planning.keywords) { $strategyWeak += @($cats.planning.keywords) }
if ($cats.advanced_coding -and $cats.advanced_coding.keywords) { $strategyWeak += @($cats.advanced_coding.keywords) }
Add-Set 'strategy.weak' $strategyWeak

$strategyNegative = @()
if ($cats.planning_negative -and $cats.planning_negative.keywords) { $strategyNegative += @($cats.planning_negative.keywords) }
Add-Set 'strategy.negative' $strategyNegative

# coding
$codingStrong = @()
if ($cats.coding -and $cats.coding.strongKeywords) { $codingStrong += @($cats.coding.strongKeywords) }
if ($cats.coding_strong -and $cats.coding_strong.keywords) { $codingStrong += @($cats.coding_strong.keywords) }
Add-Set 'coding.strong' $codingStrong

$codingWeak = @()
if ($cats.coding -and $cats.coding.keywords) { $codingWeak += @($cats.coding.keywords) }
if ($cats.coding_weak -and $cats.coding_weak.keywords) { $codingWeak += @($cats.coding_weak.keywords) }
Add-Set 'coding.weak' $codingWeak

$codingNegative = @()
if ($cats.coding_negative -and $cats.coding_negative.keywords) { $codingNegative += @($cats.coding_negative.keywords) }
Add-Set 'coding.negative' $codingNegative

# vision
$visionWeak = @()
if ($cats.vision -and $cats.vision.keywords) { $visionWeak += @($cats.vision.keywords) }
Add-Set 'vision.weak' $visionWeak

# support = daily_support + emergency_fallback + quick_response
$supportStrong = @()
if ($cats.quick_response -and $cats.quick_response.strongKeywords) { $supportStrong += @($cats.quick_response.strongKeywords) }
Add-Set 'support.strong' $supportStrong

$supportWeak = @()
if ($cats.daily_support -and $cats.daily_support.keywords) { $supportWeak += @($cats.daily_support.keywords) }
if ($cats.emergency_fallback -and $cats.emergency_fallback.keywords) { $supportWeak += @($cats.emergency_fallback.keywords) }
if ($cats.quick_response -and $cats.quick_response.keywords) { $supportWeak += @($cats.quick_response.keywords) }
Add-Set 'support.weak' $supportWeak

$supportNegative = @()
if ($cats.quick_response_negative -and $cats.quick_response_negative.keywords) { $supportNegative += @($cats.quick_response_negative.keywords) }
Add-Set 'support.negative' $supportNegative

# general (preserve its own wording + absorb quick_response so nothing is lost)
$generalWeak = @()
if ($cats.general -and $cats.general.keywords) { $generalWeak += @($cats.general.keywords) }
if ($cats.quick_response -and $cats.quick_response.keywords) { $generalWeak += @($cats.quick_response.keywords) }
Add-Set 'general.weak' $generalWeak

$generalNegative = @()
if ($cats.general_negative -and $cats.general_negative.keywords) { $generalNegative += @($cats.general_negative.keywords) }
if ($cats.quick_response_negative -and $cats.quick_response_negative.keywords) { $generalNegative += @($cats.quick_response_negative.keywords) }
Add-Set 'general.negative' $generalNegative

# chat fallback, but keep quick-response phrasing so no terms are lost
$chatWeak = @()
if ($cats.quick_response -and $cats.quick_response.keywords) { $chatWeak += @($cats.quick_response.keywords) }
Add-Set 'chat.weak' $chatWeak

$kinds = [ordered]@{}

function Kind-Rule([string]$id, [int]$priority) {
  $signals = [ordered]@{ positive=@(); negative=@(); metadata=@(); regex=@() }

  if ($sets.Contains($id + '.strong') -and $sets[$id + '.strong'].Count -gt 0) {
    $signals.positive += @([ordered]@{ set = ($id + '.strong'); weight = 3; match = 'contains' })
  }
  if ($sets.Contains($id + '.weak') -and $sets[$id + '.weak'].Count -gt 0) {
    $signals.positive += @([ordered]@{ set = ($id + '.weak'); weight = 1; match = 'contains' })
  }
  if ($sets.Contains($id + '.negative') -and $sets[$id + '.negative'].Count -gt 0) {
    $signals.negative += @([ordered]@{ set = ($id + '.negative'); weight = -4; match = 'contains'; exclude = $false })
  }

  if ($id -eq 'vision') {
    $signals.metadata += @([ordered]@{ field='hasImage'; equals=$true; weight=10; exclude=$false })
  }
  if ($id -eq 'coding') {
    $signals.metadata += @([ordered]@{ field='hasCodeBlock'; equals=$true; weight=2; exclude=$false })
  }

  $thresholds = switch ($id) {
    'strategy' { [ordered]@{ minScore=2; highScore=7; minStrongHits=1 } }
    'coding'   { [ordered]@{ minScore=2; highScore=6; minStrongHits=1 } }
    'vision'   { [ordered]@{ minScore=3; highScore=10; minStrongHits=0 } }
    'support'  { [ordered]@{ minScore=1; highScore=5; minStrongHits=0 } }
    'general'  { [ordered]@{ minScore=2; highScore=6; minStrongHits=0 } }
    'chat'     { [ordered]@{ minScore=0; highScore=0; minStrongHits=0 } }
    default    { [ordered]@{ minScore=2; highScore=6; minStrongHits=0 } }
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

$prioMap = @{
  strategy=100; coding=90; vision=80; support=70; general=30; chat=0
}

foreach ($kid in @('strategy','coding','vision','support','general','chat')) {
  $kinds[$kid] = (Kind-Rule $kid $prioMap[$kid])
}

$lib = [ordered]@{
  '$schema' = './keyword-library.schema.json'
  version = 1
  updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  notes = 'Generated from router-rules.json and model-priority.json. Simplified to 6 kinds: strategy, coding, vision, support, general, chat.'
  defaultFallbackKind = 'chat'
  normalization = [ordered]@{ lowercase=$true; trim=$true; collapseWhitespace=$true }
  keywordSets = $sets
  kinds = $kinds
}

$json = $lib | ConvertTo-Json -Depth 50
Set-Content -Path $out -Value $json -Encoding UTF8
Write-Host "[compile] wrote: $out" -ForegroundColor Green
