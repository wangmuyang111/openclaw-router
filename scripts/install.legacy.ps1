#requires -Version 5.1
<#
Install script for OpenClaw Soft Router Suggest (Windows + PowerShell)

- Copies plugin to OpenClaw extensions
- Copies the current soft-router tools directory into the OpenClaw workspace
- Adds/updates plugins.entries.soft-router-suggest in openclaw.json (with backup)

Safety:
- Makes timestamped backup of openclaw.json before modifying
- Never writes secrets
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-OpenClawHome {
  $openclawHome = Join-Path $env:USERPROFILE '.openclaw'
  return $openclawHome
}

function Get-OpenClawWorkspace {
  return (Join-Path (Get-OpenClawHome) 'workspace')
}

function Ensure-Dir([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Force -Path $p | Out-Null
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
$openclawHome = Get-OpenClawHome
$workspace = Get-OpenClawWorkspace

$extDir = Join-Path $workspace '.openclaw\extensions\soft-router-suggest'
$toolsDir = Join-Path $workspace 'tools\soft-router-suggest'

Ensure-Dir $extDir
Ensure-Dir $toolsDir

Write-Host "Repo: $repoRoot"
Write-Host "OpenClaw home: $openclawHome"
Write-Host "Workspace: $workspace"

# 1) Copy plugin
# NOTE: repo may not contain legacy classification files anymore; copy only what exists.
$pluginFiles = @(
  'index.ts',
  'openclaw.plugin.json',
  'keyword-library.ts',
  'weighted-routing-engine.ts',
  'classification-loader.ts',
  'classification-engine.ts'
)
foreach ($f in $pluginFiles) {
  $src = Join-Path $repoRoot (Join-Path 'plugin' $f)
  if (Test-Path -LiteralPath $src) {
    Copy-Item -Force $src (Join-Path $extDir $f)
  }
}
Write-Host "OK: plugin copied -> $extDir"

# 2) Copy tools (current source of truth: copy the whole tool directory contents)
$toolSourceDir = Join-Path $repoRoot 'tools\soft-router-suggest'
if (-not (Test-Path -LiteralPath $toolSourceDir)) {
  throw "Tool source directory missing: $toolSourceDir"
}

Get-ChildItem -LiteralPath $toolSourceDir -Force | ForEach-Object {
  $src = $_.FullName
  $dst = Join-Path $toolsDir $_.Name
  if ($_.PSIsContainer) {
    Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
  } else {
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }
}

# Ensure user overrides file exists (copy example only if missing).
$overridesDst = Join-Path $toolsDir 'keyword-overrides.user.json'
$overridesExample = Join-Path $repoRoot 'tools\soft-router-suggest\keyword-overrides.user.example.json'
if (-not (Test-Path -LiteralPath $overridesDst)) {
  if (Test-Path -LiteralPath $overridesExample) {
    Copy-Item -Force $overridesExample $overridesDst
    Write-Host "OK: created keyword-overrides.user.json from example"
  }
}

Write-Host "OK: tools copied -> $toolsDir"

# 3) Patch openclaw.json (backup first)
$configPath = Join-Path $openclawHome 'openclaw.json'
if (-not (Test-Path -LiteralPath $configPath)) {
  throw "openclaw.json not found at: $configPath"
}

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $openclawHome ("openclaw.json.bak.soft-router-suggest.$ts")
Copy-Item -Force $configPath $backupPath
Write-Host "Backup: $backupPath"

# Read JSON (PowerShell 5.1 friendly)
$raw = Get-Content -LiteralPath $configPath -Raw
$cfg = $raw | ConvertFrom-Json

# StrictMode-safe property creation
if (-not ($cfg.PSObject.Properties.Name -contains 'plugins')) {
  $cfg | Add-Member -NotePropertyName plugins -NotePropertyValue (@{})
}
if (-not ($cfg.plugins.PSObject.Properties.Name -contains 'entries')) {
  $cfg.plugins | Add-Member -NotePropertyName entries -NotePropertyValue (@{})
}

$id = 'soft-router-suggest'

# StrictMode-safe dynamic property access
$hasEntry = ($cfg.plugins.entries.PSObject.Properties.Name -contains $id)
if (-not $hasEntry) {
  $cfg.plugins.entries | Add-Member -NotePropertyName $id -NotePropertyValue (@{})
}
$entry = $cfg.plugins.entries.PSObject.Properties[$id].Value

# Ensure entry is an object
if ($null -eq $entry -or -not ($entry -is [psobject])) {
  $cfg.plugins.entries.PSObject.Properties[$id].Value = @{}
  $entry = $cfg.plugins.entries.PSObject.Properties[$id].Value
}

# Enabled by default; config is minimal and contains no absolute paths.
if ($null -eq $entry.PSObject.Properties['enabled']) {
  $entry | Add-Member -NotePropertyName enabled -NotePropertyValue $true
} else {
  $entry.enabled = $true
}

# Ensure config exists and is a PSCustomObject (not Hashtable)
if ($null -eq $entry.PSObject.Properties['config']) {
  $entry | Add-Member -NotePropertyName config -NotePropertyValue ([pscustomobject]@{})
} else {
  $cfgProp = $entry.PSObject.Properties['config']
  $c = $cfgProp.Value
  if ($c -is [System.Collections.IDictionary]) {
    $cfgProp.Value = [pscustomobject]$c
  } elseif ($null -eq $c -or -not ($c -is [psobject])) {
    $cfgProp.Value = [pscustomobject]@{}
  }
}

function Set-ConfigValue($cfgObj, [string]$name, $value) {
  if ($cfgObj -is [System.Collections.IDictionary]) {
    $cfgObj[$name] = $value
    return
  }
  $p = $cfgObj.PSObject.Properties[$name]
  if ($null -eq $p) {
    $cfgObj | Add-Member -NotePropertyName $name -NotePropertyValue $value
  } else {
    $p.Value = $value
  }
}

# Default to RULES mode after install (portable, low-latency)
# NOTE: these are optional fields; we set them explicitly to avoid confusing "blank" status output.
Set-ConfigValue $entry.config 'ruleEngineEnabled' $true
Set-ConfigValue $entry.config 'routerLlmEnabled' $false
# IMPORTANT: keep switching disabled by default; plugin runs in suggest/log-only mode.
Set-ConfigValue $entry.config 'switchingEnabled' $false

# Safety default: never auto-switch chat kind
if ($null -eq $entry.config.PSObject.Properties['switchingAllowChat']) {
  $entry.config | Add-Member -NotePropertyName switchingAllowChat -NotePropertyValue $false
}

# OPTIONAL: allow overriding openclaw CLI path via config, default is 'openclaw'
if ($null -eq $entry.config.PSObject.Properties['openclawCliPath']) {
  $entry.config | Add-Member -NotePropertyName openclawCliPath -NotePropertyValue 'openclaw'
}

# Write back (UTF-8)
$json = $cfg | ConvertTo-Json -Depth 50
# Normalize to CRLF for Notepad friendliness
$json = ($json -replace "`r?`n", "`r`n")
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "OK: openclaw.json updated (plugin enabled)"

Write-Host "\nNext steps:"
Write-Host "  - Use scripts\\router.ps1 for mode switching (FAST/RULES/LLM)"
Write-Host "  - Start sidecar: scripts\\sidecar-start.ps1"
