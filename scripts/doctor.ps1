#requires -Version 5.1
<#
Doctor wrapper for OpenClaw Soft Router Suggest (Windows)

Current behavior:
- Prefer the cross-platform Node CLI doctor flow
- Auto-build the CLI once if dist\cli\index.js is missing
- Fall back to the legacy PowerShell doctor only when forwarding is unavailable
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
$distCli = Join-Path $repoRoot 'dist\cli\index.js'
$legacyDoctor = Join-Path $PSScriptRoot 'doctor.legacy.ps1'

function Invoke-LegacyDoctor {
  Write-Host "Repo: $repoRoot"
  Write-Host "Fallback: legacy PowerShell doctor"
  Write-Host ""

  & $legacyDoctor
  exit $LASTEXITCODE
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Invoke-LegacyDoctor
}

if (-not (Test-Path -LiteralPath $distCli)) {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCmd) {
    Write-Host "Build missing: running npm run build..."
    & $npmCmd.Source run build
    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'CLI build failed; falling back to legacy PowerShell doctor.'
      Invoke-LegacyDoctor
    }
  }
}

if (-not (Test-Path -LiteralPath $distCli)) {
  Write-Warning 'CLI entry missing; falling back to legacy PowerShell doctor.'
  Invoke-LegacyDoctor
}

Write-Host "Repo: $repoRoot"
Write-Host "Wrapper: forwarding to Node CLI doctor"
Write-Host "CLI: $distCli"
Write-Host ""

& $nodeCmd.Source $distCli doctor @args
exit $LASTEXITCODE
