param(
  [Parameter(Mandatory=$true)]
  [string]$Kind,

  [string]$LibraryPath = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($LibraryPath)) {
  $LibraryPath = Join-Path $PSScriptRoot 'keyword-library.json'
}

function Load-Library {
  if (!(Test-Path $LibraryPath)) { throw "Missing keyword library: $LibraryPath" }
  return (Get-Content $LibraryPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Save-Library($lib) {
  ($lib | ConvertTo-Json -Depth 80) | Set-Content -Path $LibraryPath -Encoding UTF8
}

function Assert-KindId($k) {
  if ($k -notmatch '^[\p{L}][\p{L}\p{N}_]*$') {
    throw "Invalid kind id '$k'. Allowed: English or Chinese characters, digits, underscore; must start with a letter/汉字. Examples: finance_ai, 财务助手"
  }
  if ($k -eq 'chat') {
    throw "Kind id 'chat' is reserved (fallback kind). Choose another name."
  }
}

$lib = Load-Library
Assert-KindId $Kind

if (-not $lib.kinds) { $lib | Add-Member -NotePropertyName kinds -NotePropertyValue (@{}) -Force }

$existing = $lib.kinds.PSObject.Properties | Where-Object { $_.Name -eq $Kind }
if ($existing) {
  throw "Kind already exists: $Kind"
}

# Add kind config. Keep it minimal.
$lib.kinds | Add-Member -NotePropertyName $Kind -NotePropertyValue (@{
  models = @{ strategy = 'priority_list'; list = @('local-proxy/gpt-5.2') }
  threshold = @{ minScore = 1 }
}) -Force

# Ensure there are base keywordSets for this kind.
if (-not $lib.keywordSets) { $lib | Add-Member -NotePropertyName keywordSets -NotePropertyValue (@{}) -Force }

$baseSets = @("$Kind.strong", "$Kind.weak", "$Kind.negative")
foreach ($sid in $baseSets) {
  $p = $lib.keywordSets.PSObject.Properties | Where-Object { $_.Name -eq $sid }
  if (-not $p) {
    $lib.keywordSets | Add-Member -NotePropertyName $sid -NotePropertyValue @() -Force
  }
}

Save-Library $lib
Write-Output "OK"
