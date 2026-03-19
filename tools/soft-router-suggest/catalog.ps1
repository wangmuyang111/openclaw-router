param(
  [switch]$Refresh,
  [int]$TtlMinutes = 360,
  [string]$CachePath = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($CachePath)) {
  $CachePath = Join-Path $PSScriptRoot 'model-catalog.cache.json'
}

function Read-Cache {
  if (!(Test-Path $CachePath)) { return $null }
  try {
    $raw = Get-Content $CachePath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return $raw | ConvertFrom-Json
  } catch { return $null }
}

function Cache-IsFresh($cache) {
  if ($null -eq $cache -or -not $cache.fetchedAt) { return $false }
  try {
    $t = [DateTime]::Parse($cache.fetchedAt).ToUniversalTime()
    $age = (Get-Date).ToUniversalTime() - $t
    return ($age.TotalMinutes -lt $TtlMinutes)
  } catch { return $false }
}

function Fetch-Catalog {
  # Read-only: does not modify config.
  $json = openclaw models list --json 2>$null
  if ([string]::IsNullOrWhiteSpace($json)) { throw 'openclaw models list --json returned empty output' }
  $data = $json | ConvertFrom-Json
  $out = [ordered]@{
    fetchedAt = (Get-Date).ToUniversalTime().ToString('o')
    ttlMinutes = $TtlMinutes
    models = $data
  }
  ($out | ConvertTo-Json -Depth 50) | Set-Content -Path $CachePath -Encoding UTF8
  return $out
}

function Print-ModelList($data) {
  # Output ONLY the model IDs (one per line). No extra text.
  $ms = @($data.models)
  $ids = @()
  foreach ($m in $ms) {
    if ($m.available -ne $true) { continue }
    $id = $null
    if ($m.key) { $id = [string]$m.key }
    elseif ($m.id) { $id = [string]$m.id }
    if ($id) { $ids += $id }
  }
  $ids | Sort-Object -Unique | ForEach-Object { Write-Output $_ }
}

$cache = Read-Cache
if (-not $Refresh -and (Cache-IsFresh $cache)) {
  Print-ModelList $cache.models
  exit 0
}

try {
  $fresh = Fetch-Catalog
  Print-ModelList $fresh.models
} catch {
  if ($cache) {
    Print-ModelList $cache.models
    exit 0
  }
  throw
}
