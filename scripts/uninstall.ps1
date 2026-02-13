#requires -Version 5.1
<#
Uninstall script for OpenClaw Soft Router Suggest

- Disables plugin entry in openclaw.json (backup first)
- Optionally removes copied extension/tools files
#>

param(
  [switch]$RemoveFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-OpenClawHome {
  $openclawHome = Join-Path $env:USERPROFILE '.openclaw'
  return $openclawHome
}
function Get-OpenClawWorkspace { Join-Path (Get-OpenClawHome) 'workspace' }

$openclawHome = Get-OpenClawHome
$workspace = Get-OpenClawWorkspace
$configPath = Join-Path $openclawHome 'openclaw.json'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "openclaw.json not found at: $configPath"
}

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $openclawHome ("openclaw.json.bak.soft-router-suggest.uninstall.$ts")
Copy-Item -Force $configPath $backupPath
Write-Host "Backup: $backupPath"

$raw = Get-Content -LiteralPath $configPath -Raw
$cfg = $raw | ConvertFrom-Json

$id = 'soft-router-suggest'

# StrictMode-safe navigation
$hasPlugins = ($cfg.PSObject.Properties.Name -contains 'plugins')
$hasEntries = $hasPlugins -and ($cfg.plugins.PSObject.Properties.Name -contains 'entries')
$hasEntry = $hasEntries -and ($cfg.plugins.entries.PSObject.Properties.Name -contains $id)

if ($hasEntry) {
  $entry = $cfg.plugins.entries.PSObject.Properties[$id].Value
  if ($entry -and ($entry.PSObject.Properties.Name -contains 'enabled')) {
    $entry.enabled = $false
  } else {
    # Ensure it's an object and set enabled
    $cfg.plugins.entries.PSObject.Properties[$id].Value = @{}
    $cfg.plugins.entries.PSObject.Properties[$id].Value.enabled = $false
  }

  Write-Host "OK: plugin disabled in openclaw.json"
} else {
  Write-Host "Note: plugin entry not found; nothing to disable."
}

$json = $cfg | ConvertTo-Json -Depth 50
$json = ($json -replace "`r?`n", "`r`n")
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))

if ($RemoveFiles) {
  $extDir = Join-Path $workspace '.openclaw\extensions\soft-router-suggest'
  $toolsDir = Join-Path $workspace 'tools\soft-router-suggest'

  if (Test-Path -LiteralPath $extDir) { Remove-Item -Recurse -Force -LiteralPath $extDir }
  $toolFiles = @(
    'router-rules.json',
    'model-priority.json',
    'classification-rules.json',
    'classification-rules.schema.json',
    'model-tags.json',
    'router-config.ps1',
    'validate-classification.ps1'
  )
  foreach ($f in $toolFiles) {
    $p = Join-Path $toolsDir $f
    if (Test-Path -LiteralPath $p) { Remove-Item -Force -LiteralPath $p }
  }

  Write-Host "OK: files removed"
}

Write-Host "Done."
