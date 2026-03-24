#requires -Version 5.1
<#
Install wrapper for OpenClaw Soft Router Suggest (Windows)

Current behavior:
- Prefer the cross-platform Node CLI install flow
- Auto-build the CLI once if dist\cli\index.js is missing
- Fall back to the legacy PowerShell installer only when no CLI flags were requested
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
$distCli = Join-Path $repoRoot 'dist\cli\index.js'
$legacyInstall = Join-Path $PSScriptRoot 'legacy\install.legacy.ps1'

function Invoke-LegacyInstall {
  Write-Host "Repo: $repoRoot"
  Write-Host "Fallback: legacy PowerShell install"
  Write-Host ""

  & $legacyInstall
  exit $LASTEXITCODE
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  if ($args.Count -gt 0) {
    throw 'Node.js is required to forward install flags to the Node CLI.'
  }
  Invoke-LegacyInstall
}

if (-not (Test-Path -LiteralPath $distCli)) {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCmd) {
    Write-Host "Build missing: running npm run build..."
    & $npmCmd.Source run build
    if ($LASTEXITCODE -ne 0) {
      if ($args.Count -gt 0) {
        throw 'Failed to build CLI; cannot honor install flags with legacy fallback.'
      }
      Write-Warning 'CLI build failed; falling back to legacy PowerShell install.'
      Invoke-LegacyInstall
    }
  }
}

if (-not (Test-Path -LiteralPath $distCli)) {
  if ($args.Count -gt 0) {
    throw "CLI entry not found after build attempt: $distCli"
  }
  Write-Warning 'CLI entry missing; falling back to legacy PowerShell install.'
  Invoke-LegacyInstall
}

Write-Host "Repo: $repoRoot"
Write-Host "Wrapper: forwarding to Node CLI install"
Write-Host "CLI: $distCli"
Write-Host ""

& $nodeCmd.Source $distCli install @args
exit $LASTEXITCODE
