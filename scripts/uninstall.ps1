#requires -Version 5.1
<#
Uninstall wrapper for OpenClaw Soft Router Suggest (Windows)

Current behavior:
- Prefer the cross-platform Node CLI uninstall flow
- Auto-build the CLI once if dist\cli\index.js is missing
- Preserve legacy `-RemoveFiles` PowerShell usage by translating it to `--remove-files`
- Fall back to the legacy PowerShell uninstall only when forwarding is unavailable and no remove-files flag was requested
#>

[CmdletBinding()]
param(
  [switch]$RemoveFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
$distCli = Join-Path $repoRoot 'dist\cli\index.js'
$legacyUninstall = Join-Path $PSScriptRoot 'legacy\uninstall.legacy.ps1'

function Invoke-LegacyUninstall {
  Write-Host "Repo: $repoRoot"
  Write-Host "Fallback: legacy PowerShell uninstall"
  Write-Host ""

  & $legacyUninstall @PSBoundParameters
  exit $LASTEXITCODE
}

$forwardArgs = @('uninstall')
if ($RemoveFiles) {
  $forwardArgs += '--remove-files'
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  if ($RemoveFiles) {
    throw 'Node.js is required to forward uninstall remove-files behavior to the Node CLI.'
  }
  Invoke-LegacyUninstall
}

if (-not (Test-Path -LiteralPath $distCli)) {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCmd) {
    Write-Host "Build missing: running npm run build..."
    & $npmCmd.Source run build
    if ($LASTEXITCODE -ne 0) {
      if ($RemoveFiles) {
        throw 'Failed to build CLI; cannot honor uninstall remove-files behavior with legacy fallback.'
      }
      Write-Warning 'CLI build failed; falling back to legacy PowerShell uninstall.'
      Invoke-LegacyUninstall
    }
  }
}

if (-not (Test-Path -LiteralPath $distCli)) {
  if ($RemoveFiles) {
    throw "CLI entry not found after build attempt: $distCli"
  }
  Write-Warning 'CLI entry missing; falling back to legacy PowerShell uninstall.'
  Invoke-LegacyUninstall
}

Write-Host "Repo: $repoRoot"
Write-Host "Wrapper: forwarding to Node CLI uninstall"
Write-Host "CLI: $distCli"
Write-Host ""

& $nodeCmd.Source $distCli @forwardArgs
exit $LASTEXITCODE
