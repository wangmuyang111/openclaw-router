param(
  [Parameter(Mandatory=$false)]
  [string]$Kind = "",

  [Parameter(Mandatory=$true)]
  [string]$ModelId,

  [string]$LibraryPath = "",
  [string]$CatalogCachePath = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($LibraryPath)) {
  $LibraryPath = Join-Path $PSScriptRoot 'keyword-library.json'
}
if ([string]::IsNullOrWhiteSpace($CatalogCachePath)) {
  $CatalogCachePath = Join-Path $PSScriptRoot 'model-catalog.cache.json'
}

if (!(Test-Path $LibraryPath)) { throw "Missing keyword library: $LibraryPath" }

# Optional safety check: ensure the model exists in cached catalog if present.
if (Test-Path $CatalogCachePath) {
  try {
    $cat = (Get-Content $CatalogCachePath -Raw -Encoding UTF8 | ConvertFrom-Json)
    $ids = @()
    if ($cat.models) {
      foreach ($m in $cat.models) {
        if ($m.id) { $ids += $m.id }
      }
    }
    if ($ids.Count -gt 0 -and ($ids -notcontains $ModelId)) {
      Write-Host "WARN: ModelId '$ModelId' not found in cached catalog. (You may need to refresh catalog.)" -ForegroundColor Yellow
    }
  } catch {}
}

$lib = Get-Content $LibraryPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $lib.kinds) { throw "keyword-library.json missing 'kinds'" }

$kinds = $lib.kinds.PSObject.Properties | ForEach-Object { $_.Name }
if ($kinds.Count -eq 0) { throw "No kinds found in keyword-library.json" }

function Set-One($kid) {
  $kr = $lib.kinds.$kid
  if (-not $kr) { throw "Unknown kind: $kid" }
  if (-not $kr.models) { $kr | Add-Member -NotePropertyName models -NotePropertyValue (@{}) -Force }
  $kr.models.strategy = 'priority_list'
  $kr.models.list = @($ModelId)
}

if ([string]::IsNullOrWhiteSpace($Kind)) {
  foreach ($kid in $kinds) { Set-One $kid }
  Write-Host "Updated ALL kinds -> models.list = ['$ModelId']" -ForegroundColor Green
} else {
  if ($kinds -notcontains $Kind) { throw "Unknown kind '$Kind'. Available: $($kinds -join ', ')" }
  Set-One $Kind
  Write-Host "Updated kind '$Kind' -> models.list = ['$ModelId']" -ForegroundColor Green
}

($lib | ConvertTo-Json -Depth 50) | Set-Content -Path $LibraryPath -Encoding UTF8
Write-Host "Saved: $LibraryPath" -ForegroundColor Cyan
