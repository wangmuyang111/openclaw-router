#requires -Version 5.1
<#!
Global-friendly wrapper for the Node CLI command group
Usage:
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 status
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 fast
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 rules
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 llm
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 doctor
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 install
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
$distCli = Join-Path $repoRoot 'dist\cli\index.js'

$command = if ($args.Count -gt 0) { $args[0] } else { 'status' }
$forwardArgs = if ($args.Count -gt 1) { $args[1..($args.Count - 1)] } else { @() }

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  throw 'Node.js is required to run openclaw-router.'
}

if (-not (Test-Path -LiteralPath $distCli)) {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $npmCmd) {
    throw "CLI entry missing and npm not found: $distCli"
  }

  Write-Host 'Build missing: running npm run build...'
  & $npmCmd.Source run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

& $nodeCmd.Source $distCli $command @forwardArgs
if ($null -ne $LASTEXITCODE) {
  exit $LASTEXITCODE
}
exit 0
