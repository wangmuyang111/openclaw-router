#requires -Version 5.1
<#
Doctor script (read-only) — checks environment readiness.
Does NOT modify any files.

Usage:
  .\scripts\doctor.ps1
  .\scripts\doctor.ps1 -Verbose
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-OpenClawHome {
  $openclawHome = Join-Path $env:USERPROFILE '.openclaw'
  return $openclawHome
}

function Get-OpenClawWorkspace {
  Join-Path (Get-OpenClawHome) 'workspace'
}

function Say([string]$k, [string]$v) {
  Write-Host ("{0,-20} {1}" -f ($k + ':'), $v)
}

function Test-PortFree([int]$port) {
  try {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
    return ($null -eq $c)
  } catch {
    # Get-NetTCPConnection might not exist on older Windows editions; best-effort.
    return $true
  }
}

function Try-HttpHealth([string]$url) {
  try {
    $resp = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 2
    if ($resp -and $resp.ok -eq $true) { return $true }
    return $false
  } catch { return $false }
}

$openclawHome = Get-OpenClawHome
$ws = Get-OpenClawWorkspace
$cfgPath = Join-Path $openclawHome 'openclaw.json'

Write-Host "OpenClaw Soft Router - doctor" 
Write-Host "--------------------------------" 

$issues = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

Say 'USERPROFILE' $env:USERPROFILE
Say 'OpenClawHome' $openclawHome
Say 'Workspace' $ws

# openclaw.json
$cfgOk = Test-Path -LiteralPath $cfgPath
$cfgLabel = if ($cfgOk) { 'OK' } else { 'MISSING' }
Say 'openclaw.json' $cfgLabel
if (-not $cfgOk) {
  $issues.Add("Missing openclaw.json at: $cfgPath") | Out-Null
}

# openclaw CLI
$openclawCmd = Get-Command openclaw -ErrorAction SilentlyContinue
$openclawLabel = if ($openclawCmd) { "OK ($($openclawCmd.Source))" } else { 'MISSING (not in PATH)' }
Say 'openclaw CLI' $openclawLabel
if (-not $openclawCmd) {
  $issues.Add("Missing OpenClaw CLI in PATH (command: openclaw)") | Out-Null
} else {
  try {
    $v = & openclaw --version 2>$null
    if ($v) { Say 'openclaw --version' ($v | Select-Object -First 1) }
  } catch {
    $warnings.Add('openclaw --version failed (but openclaw exists).') | Out-Null
  }
}

# node (only required for sidecar/LLM)
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodeLabel = if ($nodeCmd) { "OK ($($nodeCmd.Source))" } else { 'MISSING (required for LLM sidecar)' }
Say 'node' $nodeLabel
if (-not $nodeCmd) {
  $warnings.Add('Node.js is missing: LLM/sidecar mode will not work. RULES/FAST still work.') | Out-Null
} else {
  try {
    $nv = & node -v 2>$null
    if ($nv) { Say 'node -v' ($nv.Trim()) }
  } catch {}
}

# plugin files
$extDir = Join-Path $ws '.openclaw\extensions\soft-router-suggest'
$toolsDir = Join-Path $ws 'tools\soft-router-suggest'
$pluginOk = Test-Path -LiteralPath (Join-Path $extDir 'index.ts')
$rulesOk = Test-Path -LiteralPath (Join-Path $toolsDir 'router-rules.json')
$prioOk = Test-Path -LiteralPath (Join-Path $toolsDir 'model-priority.json')
$classRulesOk = Test-Path -LiteralPath (Join-Path $toolsDir 'classification-rules.json')
$classSchemaOk = Test-Path -LiteralPath (Join-Path $toolsDir 'classification-rules.schema.json')

$pluginLabel = if ($pluginOk) { 'OK' } else { 'MISSING' }
$rulesLabel = if ($rulesOk) { 'OK' } else { 'MISSING' }
$prioLabel = if ($prioOk) { 'OK' } else { 'MISSING' }
$classRulesLabel = if ($classRulesOk) { 'OK' } else { 'MISSING' }
$classSchemaLabel = if ($classSchemaOk) { 'OK' } else { 'MISSING' }
Say 'plugin installed' $pluginLabel
Say 'rules file' $rulesLabel
Say 'priority file' $prioLabel
Say 'classification rules' $classRulesLabel
Say 'classification schema' $classSchemaLabel

if (-not $pluginOk) { $issues.Add("Plugin not installed: $extDir\index.ts") | Out-Null }
if (-not $rulesOk) { $issues.Add("Missing rules file: $toolsDir\router-rules.json") | Out-Null }
if (-not $prioOk) { $issues.Add("Missing priority file: $toolsDir\model-priority.json") | Out-Null }
if (-not $classRulesOk) { $issues.Add("Missing classification rules: $toolsDir\classification-rules.json") | Out-Null }
if (-not $classSchemaOk) { $issues.Add("Missing classification schema: $toolsDir\classification-rules.schema.json") | Out-Null }

# sidecar (optional)
$port = 18888
$health = "http://127.0.0.1:$port/health"
$portFree = Test-PortFree $port
$healthHealthy = Try-HttpHealth $health

$portLabel = if ($portFree) { 'FREE (or unknown)' } else { 'IN USE (listening)' }
$healthLabel = if ($healthHealthy) { 'HEALTHY' } else { 'NOT HEALTHY (ok unless using LLM mode)' }
Say 'sidecar port' $portLabel
Say 'sidecar /health' $healthLabel

if (-not $portFree -and -not $healthHealthy) {
  $warnings.Add("Port $port is in use but /health is not healthy. Another process may be using it.") | Out-Null
}

Write-Host ""
if ($issues.Count -gt 0) {
  Write-Host "MISSING / BLOCKERS:" -ForegroundColor Red
  foreach ($x in $issues) { Write-Host ("- " + $x) -ForegroundColor Red }
  Write-Host ""
  Write-Host "Fix (most common):" -ForegroundColor Yellow
  Write-Host "- Run install:   .\\scripts\\install.ps1" -ForegroundColor Yellow
  Write-Host "- Ensure openclaw is installed and in PATH." -ForegroundColor Yellow
  Write-Host ""
} else {
  Write-Host "OK: no blockers detected." -ForegroundColor Green
  Write-Host ""
}

if ($warnings.Count -gt 0) {
  Write-Host "WARNINGS:" -ForegroundColor Yellow
  foreach ($w in $warnings) { Write-Host ("- " + $w) -ForegroundColor Yellow }
  Write-Host ""
}

Write-Host "Next commands:" 
Write-Host "- Status:    .\\scripts\\router.ps1 status" 
Write-Host "- RULES:     .\\scripts\\router.ps1 rules" 
Write-Host "- FAST:      .\\scripts\\router.ps1 fast" 
Write-Host "- LLM:       .\\scripts\\router.ps1 sidecar-start; .\\scripts\\router.ps1 llm" 
