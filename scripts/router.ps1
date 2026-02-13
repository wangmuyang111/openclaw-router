#requires -Version 5.1
<#
Router mode helper (no profile injection required)

Usage:
  .\scripts\router.ps1 status
  .\scripts\router.ps1 fast
  .\scripts\router.ps1 rules
  .\scripts\router.ps1 llm
  .\scripts\router.ps1 catalog-refresh
  .\scripts\router.ps1 sidecar-start
  .\scripts\router.ps1 sidecar-stop
#>

param(
  [Parameter(Position=0)]
  [ValidateSet('status','fast','rules','llm','catalog-refresh','sidecar-start','sidecar-stop')]
  [string]$Mode = 'status'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-OpenClawHome {
  $openclawHome = Join-Path $env:USERPROFILE '.openclaw'
  return $openclawHome
}

function Get-OpenClawWorkspace {
  Join-Path (Get-OpenClawHome) 'workspace'
}

function Save-Json($obj, $path) {
  $json = $obj | ConvertTo-Json -Depth 80
  $json = ($json -replace "`r?`n", "`r`n")
  [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Load-Json($path) {
  (Get-Content -LiteralPath $path -Raw) | ConvertFrom-Json
}

function Has-Prop($obj, [string]$name) {
  if ($null -eq $obj) { return $false }
  if ($obj -is [System.Collections.IDictionary]) {
    return $obj.Contains($name)
  }
  return ($null -ne $obj.PSObject.Properties[$name])
}

function Get-Prop($obj, [string]$name, $default = $null) {
  if ($null -eq $obj) { return $default }
  if ($obj -is [System.Collections.IDictionary]) {
    if ($obj.Contains($name)) { return $obj[$name] }
    return $default
  }
  $p = $obj.PSObject.Properties[$name]
  if ($null -ne $p) { return $p.Value }
  return $default
}

function Ensure-PluginEntry($cfg) {
  # StrictMode-safe creation
  if (-not (Has-Prop $cfg 'plugins')) {
    $cfg | Add-Member -NotePropertyName plugins -NotePropertyValue (@{})
  }
  if (-not (Has-Prop $cfg.plugins 'entries')) {
    $cfg.plugins | Add-Member -NotePropertyName entries -NotePropertyValue (@{})
  }

  $id = 'soft-router-suggest'
  if ($null -eq $cfg.plugins.entries.PSObject.Properties[$id]) {
    $cfg.plugins.entries | Add-Member -NotePropertyName $id -NotePropertyValue (@{})
  }

  $entry = $cfg.plugins.entries.PSObject.Properties[$id].Value
  if ($null -eq $entry -or -not ($entry -is [psobject])) {
    $cfg.plugins.entries.PSObject.Properties[$id].Value = @{}
    $entry = $cfg.plugins.entries.PSObject.Properties[$id].Value
  }

  if (-not (Has-Prop $entry 'enabled')) {
    $entry | Add-Member -NotePropertyName enabled -NotePropertyValue $true
  }

  # Ensure config exists and is a PSCustomObject (not Hashtable), to avoid StrictMode property issues.
  if (-not (Has-Prop $entry 'config')) {
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

  return $entry
}

function Backup-Config($openclawHome, $configPath) {
  $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
  $bak = Join-Path $openclawHome ("openclaw.json.bak.router.$ts")
  Copy-Item -Force $configPath $bak
  return $bak
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
$openclawHome = Get-OpenClawHome
$workspace = Get-OpenClawWorkspace
$configPath = Join-Path $openclawHome 'openclaw.json'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "openclaw.json not found at: $configPath"
}

switch ($Mode) {
  'catalog-refresh' {
    $flag = Join-Path $workspace 'tools\soft-router-suggest\.force-refresh-catalog'
    New-Item -ItemType File -Force -Path $flag | Out-Null
    Write-Host "OK: requested catalog refresh (flag created): $flag"
    break
  }

  'sidecar-start' {
    & (Join-Path $repoRoot 'router-sidecar\scripts\start-sidecar-safe.ps1')
    break
  }

  'sidecar-stop' {
    & (Join-Path $repoRoot 'router-sidecar\scripts\stop-sidecar-safe.ps1')
    break
  }

  'status' {
    $cfg = Load-Json $configPath
    $entry = Ensure-PluginEntry $cfg

    Write-Host "openclaw.json: $configPath"
    $en = Get-Prop $entry 'enabled' $null
    Write-Host ("plugin.enabled: " + $en)

    $rule = Get-Prop $entry.config 'ruleEngineEnabled' $null
    $llm  = Get-Prop $entry.config 'routerLlmEnabled' $null
    $sw   = Get-Prop $entry.config 'switchingEnabled' $null
    $cli  = Get-Prop $entry.config 'openclawCliPath' ''

    Write-Host ("ruleEngineEnabled: " + $rule)
    Write-Host ("routerLlmEnabled: " + $llm)
    Write-Host ("switchingEnabled: " + $sw)
    Write-Host ("openclawCliPath: " + $cli)
    break
  }

  default {
    $cfg = Load-Json $configPath
    $entry = Ensure-PluginEntry $cfg

    $bak = Backup-Config $openclawHome $configPath
    Write-Host "Backup: $bak"

    if ($Mode -eq 'fast') {
      $entry.enabled = $false
      # Remove config to avoid warnings: 'plugin disabled ... but config is present'
      if (Has-Prop $entry 'config') { $entry.PSObject.Properties.Remove('config') | Out-Null }
      Save-Json $cfg $configPath
      Write-Host "OK: FAST mode (plugin disabled)"
      break
    }

    function Set-EntryConfig($entryObj, [string]$name, $value) {
      # entryObj is a PSCustomObject; config is normalized to PSCustomObject in Ensure-PluginEntry
      $p = $entryObj.config.PSObject.Properties[$name]
      if ($null -eq $p) {
        $entryObj.config | Add-Member -NotePropertyName $name -NotePropertyValue $value
      } else {
        $p.Value = $value
      }
    }

    # Ensure enabled for rules/llm
    if (-not (Has-Prop $entry 'enabled')) { $entry | Add-Member -NotePropertyName enabled -NotePropertyValue $true }
    $entry.enabled = $true

    if ($Mode -eq 'rules') {
      Set-EntryConfig $entry 'ruleEngineEnabled' $true
      Set-EntryConfig $entry 'routerLlmEnabled' $false
      Set-EntryConfig $entry 'switchingEnabled' $true
      if (-not (Has-Prop $entry.config 'openclawCliPath')) { $entry.config | Add-Member -NotePropertyName openclawCliPath -NotePropertyValue 'openclaw' }
      Save-Json $cfg $configPath
      Write-Host "OK: RULES mode (rule engine enabled)"
      break
    }

    if ($Mode -eq 'llm') {
      Set-EntryConfig $entry 'ruleEngineEnabled' $true
      Set-EntryConfig $entry 'routerLlmEnabled' $true
      Set-EntryConfig $entry 'switchingEnabled' $true
      if (-not (Has-Prop $entry.config 'openclawCliPath')) { $entry.config | Add-Member -NotePropertyName openclawCliPath -NotePropertyValue 'openclaw' }
      if (-not (Has-Prop $entry.config 'routerLlmEndpoint')) {
        $entry.config | Add-Member -NotePropertyName routerLlmEndpoint -NotePropertyValue 'http://127.0.0.1:18888/route'
      }
      Save-Json $cfg $configPath
      Write-Host "OK: LLM mode (rule engine + sidecar enabled)"
      break
    }

    throw "Unknown mode: $Mode"
  }
}
