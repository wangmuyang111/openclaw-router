#requires -Version 5.1
<#
Repair wrapper for OpenClaw Soft Router Suggest (Windows)

Current behavior:
- Prefer the cross-platform Node CLI repair flow
- Auto-build the CLI once if dist\cli\index.js is missing
- Fall back to the legacy doctor + install path only when no CLI flags were requested
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
$distCli = Join-Path $repoRoot 'dist\cli\index.js'

function Invoke-LegacyRepair {
  Write-Host "Repo: $repoRoot"
  Write-Host "Fallback: legacy PowerShell repair flow"
  Write-Host "- Behavior: doctor first, then install"
  Write-Host ""

  & (Join-Path $PSScriptRoot 'doctor.ps1')
  Write-Host ""
  & (Join-Path $PSScriptRoot 'install.ps1')
  exit $LASTEXITCODE
}

function Invoke-NodeRepair {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) {
    if ($args.Count -gt 0) {
      throw 'Node.js is required to forward repair flags to the Node CLI.'
    }
    Invoke-LegacyRepair
  }

  if (-not (Test-Path -LiteralPath $distCli)) {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
      Write-Host "Build missing: running npm run build..."
      & $npmCmd.Source run build
      if ($LASTEXITCODE -ne 0) {
        if ($args.Count -gt 0) {
          throw 'Failed to build CLI; cannot honor repair flags with legacy fallback.'
        }
        Write-Warning 'CLI build failed; falling back to legacy PowerShell repair.'
        Invoke-LegacyRepair
      }
    }
  }

  if (-not (Test-Path -LiteralPath $distCli)) {
    if ($args.Count -gt 0) {
      throw "CLI entry not found after build attempt: $distCli"
    }
    Write-Warning 'CLI entry missing; falling back to legacy PowerShell repair.'
    Invoke-LegacyRepair
  }

  Write-Host "Repo: $repoRoot"
  Write-Host "Wrapper: forwarding to Node CLI repair"
  Write-Host "CLI: $distCli"
  Write-Host ""

  & $nodeCmd.Source $distCli repair @args
  exit $LASTEXITCODE
}

Invoke-NodeRepair @args
