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

  # Print a readable summary (stdout) in addition to the raw JSON below.
  try {
    $ms = $data.models
    $avail = @($ms | Where-Object { $_.available -eq $true })
    $unavail = @($ms | Where-Object { $_.available -ne $true })

    Write-Host "" 
    Write-Host ("Catalog summary: total={0} available={1} unavailable={2}" -f $data.count, $avail.Count, $unavail.Count) -ForegroundColor Cyan

    $groups = $avail | Group-Object input | Sort-Object Name
    foreach ($g in $groups) {
      Write-Host ("AVAILABLE input={0} ({1})" -f $g.Name, $g.Count) -ForegroundColor Green
      foreach ($m in ($g.Group | Sort-Object key)) {
        $tags = if ($m.tags) { ($m.tags -join ' ') } else { '' }
        Write-Host ("- {0}  ctx={1}  tags=[{2}]" -f $m.key, $m.contextWindow, $tags)
      }
      Write-Host ""
    }

    if ($unavail.Count -gt 0) {
      Write-Host ("UNAVAILABLE ({0})" -f $unavail.Count) -ForegroundColor Yellow
      foreach ($m in ($unavail | Sort-Object key)) {
        $tags = if ($m.tags) { ($m.tags -join ' ') } else { '' }
        Write-Host ("- {0}  available={1}  tags=[{2}]" -f $m.key, $m.available, $tags)
      }
      Write-Host ""
    }
  } catch {
    # ignore summary errors
  }

  return $out
}

$cache = Read-Cache
if (-not $Refresh -and (Cache-IsFresh $cache)) {
  Write-Host "Using cached catalog: $CachePath" -ForegroundColor Cyan
  $cache | ConvertTo-Json -Depth 10
  exit 0
}

try {
  $fresh = Fetch-Catalog
  Write-Host "Fetched catalog and updated cache: $CachePath" -ForegroundColor Green
  $fresh | ConvertTo-Json -Depth 10
} catch {
  if ($cache) {
    Write-Host "WARN: fetch failed, returning stale cache: $($_.Exception.Message)" -ForegroundColor Yellow
    $cache | ConvertTo-Json -Depth 10
    exit 0
  }
  throw
}
