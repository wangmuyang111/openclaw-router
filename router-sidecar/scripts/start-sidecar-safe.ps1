param(
  [string]$HostAddr = '127.0.0.1',
  [int]$Port = 18888,
  [string]$ServerPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\daemon')).Path 'server.mjs')
)

$healthUrl = "http://$HostAddr`:$Port/health"

function Test-Healthy {
  param([string]$Url)
  try {
    $resp = Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 2
    return ($resp.ok -eq $true)
  } catch {
    return $false
  }
}

if (Test-Healthy -Url $healthUrl) {
  Write-Host "[router-sidecar] already healthy at $healthUrl (skip start)"
  exit 0
}

if (!(Test-Path -LiteralPath $ServerPath)) {
  Write-Error "[router-sidecar] server file not found: $ServerPath"
  exit 2
}

$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) {
  Write-Error "[router-sidecar] node not found in PATH"
  exit 3
}

# Start detached, no new console spam.
Start-Process -FilePath $node.Source -ArgumentList @($ServerPath) -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 1

if (Test-Healthy -Url $healthUrl) {
  Write-Host "[router-sidecar] started and healthy at $healthUrl"
  exit 0
}

Write-Error "[router-sidecar] start attempted but health check failed: $healthUrl"
exit 1
