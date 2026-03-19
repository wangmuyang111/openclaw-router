param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet('list','enable','disable','delete')]
  [string]$Command,

  [string]$Kind = "",
  [switch]$Force,

  [string]$LibraryPath = "",
  [string]$OverridesPath = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($LibraryPath)) {
  $LibraryPath = Join-Path $PSScriptRoot 'keyword-library.json'
}
if ([string]::IsNullOrWhiteSpace($OverridesPath)) {
  $OverridesPath = Join-Path $PSScriptRoot 'keyword-overrides.user.json'
}

function Load-Json([string]$p) {
  return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Save-Json([string]$p, $obj) {
  ($obj | ConvertTo-Json -Depth 80) | Set-Content -Path $p -Encoding UTF8
}

function Get-KindProps($lib) {
  if (-not $lib.kinds) { return @() }
  return @($lib.kinds.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' })
}

function Assert-KindExists($lib, [string]$k) {
  if ([string]::IsNullOrWhiteSpace($k)) { throw "-Kind is required" }
  $kinds = (Get-KindProps $lib | ForEach-Object { $_.Name })
  if ($kinds -notcontains $k) {
    throw "Unknown kind '$k'. Available: $($kinds -join ', ')"
  }
}

function Assert-NotReserved([string]$k) {
  if ($k -eq 'chat') {
    throw "Kind 'chat' is reserved as fallback kind; cannot be disabled/deleted here."
  }
}

function Rebuild-ObjectWithoutKey($obj, [string]$removeKey) {
  $out = [ordered]@{}
  foreach ($p in $obj.PSObject.Properties) {
    if ($p.MemberType -ne 'NoteProperty') { continue }
    if ($p.Name -eq $removeKey) { continue }
    $out[$p.Name] = $p.Value
  }
  return $out
}

function Rebuild-ObjectWithoutPrefix($obj, [string]$prefix) {
  $out = [ordered]@{}
  foreach ($p in $obj.PSObject.Properties) {
    if ($p.MemberType -ne 'NoteProperty') { continue }
    if ($p.Name.StartsWith($prefix)) { continue }
    $out[$p.Name] = $p.Value
  }
  return $out
}

$lib = Load-Json $LibraryPath

switch ($Command) {
  'list' {
    Write-Output "kind\tenabled\tpriority\tmodels"
    foreach ($p in (Get-KindProps $lib | Sort-Object Name)) {
      $k = $p.Name
      $kr = $p.Value
      $enabled = $true
      if ($kr.PSObject.Properties.Name -contains 'enabled') { $enabled = ($kr.enabled -ne $false) }
      $priority = 0
      if ($kr.PSObject.Properties.Name -contains 'priority') { $priority = [int]$kr.priority }
      $models = ''
      try { $models = (@($kr.models.list) -join ',') } catch { $models = '' }
      Write-Output ("{0}\t{1}\t{2}\t{3}" -f $k, $enabled, $priority, $models)
    }
  }

  'enable' {
    Assert-KindExists $lib $Kind
    Assert-NotReserved $Kind
    $kr = $lib.kinds.$Kind
    if ($kr.PSObject.Properties.Name -contains 'enabled') {
      $kr.enabled = $true
    } else {
      $kr | Add-Member -NotePropertyName enabled -NotePropertyValue $true -Force
    }
    Save-Json $LibraryPath $lib
    Write-Output "OK"
  }

  'disable' {
    Assert-KindExists $lib $Kind
    Assert-NotReserved $Kind
    $kr = $lib.kinds.$Kind
    if ($kr.PSObject.Properties.Name -contains 'enabled') {
      $kr.enabled = $false
    } else {
      $kr | Add-Member -NotePropertyName enabled -NotePropertyValue $false -Force
    }
    Save-Json $LibraryPath $lib
    Write-Output "OK"
  }

  'delete' {
    Assert-KindExists $lib $Kind
    Assert-NotReserved $Kind
    if (-not $Force) {
      throw "Refusing to delete kind '$Kind' without -Force. This operation removes kind + keywordSets + overrides (if present)."
    }

    # Remove kind
    $lib.kinds = Rebuild-ObjectWithoutKey $lib.kinds $Kind

    # Remove keywordSets with prefix "<kind>."
    if ($lib.keywordSets) {
      $lib.keywordSets = Rebuild-ObjectWithoutPrefix $lib.keywordSets ("$Kind.")
    }

    Save-Json $LibraryPath $lib

    # Remove overrides referencing this kind/sets (best-effort)
    if (Test-Path $OverridesPath) {
      try {
        $ov = Load-Json $OverridesPath
        if ($ov.kinds) {
          $ov.kinds = Rebuild-ObjectWithoutKey $ov.kinds $Kind
        }
        if ($ov.sets) {
          $ov.sets = Rebuild-ObjectWithoutPrefix $ov.sets ("$Kind.")
        }
        Save-Json $OverridesPath $ov
      } catch {
        # ignore override cleanup errors
      }
    }

    Write-Output "OK"
  }
}
