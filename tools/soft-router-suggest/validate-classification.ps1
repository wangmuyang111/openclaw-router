param(
  [string]$ConfigPath = ""
)

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $ConfigPath = Join-Path $PSScriptRoot 'classification-rules.json'
}

if (!(Test-Path $ConfigPath)) {
  Write-Error "Config not found: $ConfigPath"
  exit 1
}

try {
  $cfg = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  Write-Error "Invalid JSON: $($_.Exception.Message)"
  exit 1
}

if (-not $cfg.version) { Write-Error "Missing 'version'"; exit 1 }
if (-not $cfg.categories -or $cfg.categories.Count -eq 0) { Write-Error "categories must be non-empty"; exit 1 }

$ids = @{}
foreach ($c in $cfg.categories) {
  if (-not $c.id) { Write-Error "Category missing id"; exit 1 }
  if ($ids.ContainsKey($c.id)) { Write-Error "Duplicate category id: $($c.id)"; exit 1 }
  $ids[$c.id] = $true
  if (-not $c.models -or $c.models.Count -eq 0) { Write-Error "Category '$($c.id)' has empty models"; exit 1 }
}

$fallback = if ($cfg.defaultFallback) { $cfg.defaultFallback } else { "fallback" }
if (-not $ids.ContainsKey($fallback)) { Write-Error "defaultFallback '$fallback' not found in categories"; exit 1 }

Write-Output "OK: classification config is valid. categories=$($cfg.categories.Count), fallback=$fallback"
exit 0
