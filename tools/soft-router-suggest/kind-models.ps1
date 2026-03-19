param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet('kinds','show','add','remove','move','top','set')]
  [string]$Command,

  [string]$Kind = "",
  [string]$ModelId = "",
  [int]$FromIndex = -1,
  [int]$ToIndex = -1,
  [string]$ModelsCsv = "",

  [string]$LibraryPath = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($LibraryPath)) {
  $LibraryPath = Join-Path $PSScriptRoot 'keyword-library.json'
}

function Load-Library {
  if (!(Test-Path $LibraryPath)) { throw "Missing keyword library: $LibraryPath" }
  return (Get-Content $LibraryPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Save-Library($lib) {
  ($lib | ConvertTo-Json -Depth 80) | Set-Content -Path $LibraryPath -Encoding UTF8
}

function Get-Kinds($lib) {
  if (-not $lib.kinds) { return @() }
  return @($lib.kinds.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' } | ForEach-Object { $_.Name })
}

function Ensure-Kind($lib, $kind) {
  $kinds = Get-Kinds $lib
  if ($kinds -notcontains $kind) {
    throw "Unknown kind '$kind'. Available: $($kinds -join ', ')"
  }
}

function Get-ModelList($lib, $kind) {
  Ensure-Kind $lib $kind
  $kr = $lib.kinds.$kind
  if (-not $kr.models) {
    $kr | Add-Member -NotePropertyName models -NotePropertyValue (@{}) -Force
  }
  if (-not $kr.models.strategy) { $kr.models.strategy = 'priority_list' }
  if (-not $kr.models.list) { $kr.models.list = @() }
  return @($kr.models.list)
}

function Set-ModelList($lib, $kind, $list) {
  Ensure-Kind $lib $kind
  $kr = $lib.kinds.$kind
  if (-not $kr.models) { $kr | Add-Member -NotePropertyName models -NotePropertyValue (@{}) -Force }
  $kr.models.strategy = 'priority_list'
  $kr.models.list = @($list)
}

function Split-List([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return @() }
  return @($s.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
}

$lib = Load-Library

switch ($Command) {
  'kinds' {
    Get-Kinds $lib | Sort-Object | ForEach-Object { Write-Output $_ }
  }

  'show' {
    if ([string]::IsNullOrWhiteSpace($Kind)) { throw "-Kind is required" }
    $list = Get-ModelList $lib $Kind
    $i = 0
    foreach ($m in $list) {
      Write-Output ("{0}: {1}" -f $i, $m)
      $i++
    }
  }

  'add' {
    if ([string]::IsNullOrWhiteSpace($Kind)) { throw "-Kind is required" }
    if ([string]::IsNullOrWhiteSpace($ModelId)) { throw "-ModelId is required" }
    $list = New-Object System.Collections.Generic.List[string]
    (Get-ModelList $lib $Kind) | ForEach-Object { [void]$list.Add([string]$_) }
    if ($list.Contains($ModelId)) { throw "Model already exists in kind '$Kind': $ModelId" }
    [void]$list.Add($ModelId)
    Set-ModelList $lib $Kind $list
    Save-Library $lib
    Write-Output "OK"
  }

  'remove' {
    if ([string]::IsNullOrWhiteSpace($Kind)) { throw "-Kind is required" }
    if ([string]::IsNullOrWhiteSpace($ModelId)) { throw "-ModelId is required" }
    $cur = @(Get-ModelList $lib $Kind)
    $next = @($cur | Where-Object { $_ -ne $ModelId })
    if ($next.Count -eq $cur.Count) { throw "Model not found in kind '$Kind': $ModelId" }
    Set-ModelList $lib $Kind $next
    Save-Library $lib
    Write-Output "OK"
  }

  'move' {
    if ([string]::IsNullOrWhiteSpace($Kind)) { throw "-Kind is required" }
    if ($FromIndex -lt 0 -or $ToIndex -lt 0) { throw "-FromIndex and -ToIndex are required (>=0)" }
    $cur = New-Object System.Collections.Generic.List[string]
    (Get-ModelList $lib $Kind) | ForEach-Object { [void]$cur.Add([string]$_) }
    if ($FromIndex -ge $cur.Count -or $ToIndex -ge $cur.Count) {
      throw "Index out of range. listCount=$($cur.Count)"
    }
    $item = $cur[$FromIndex]
    $cur.RemoveAt($FromIndex)
    $cur.Insert($ToIndex, $item)
    Set-ModelList $lib $Kind $cur
    Save-Library $lib
    Write-Output "OK"
  }

  'top' {
    if ([string]::IsNullOrWhiteSpace($Kind)) { throw "-Kind is required" }
    if ([string]::IsNullOrWhiteSpace($ModelId)) { throw "-ModelId is required" }
    $cur = New-Object System.Collections.Generic.List[string]
    (Get-ModelList $lib $Kind) | ForEach-Object { [void]$cur.Add([string]$_) }
    $idx = $cur.IndexOf($ModelId)
    if ($idx -lt 0) { throw "Model not found in kind '$Kind': $ModelId" }
    $cur.RemoveAt($idx)
    $cur.Insert(0, $ModelId)
    Set-ModelList $lib $Kind $cur
    Save-Library $lib
    Write-Output "OK"
  }

  'set' {
    if ([string]::IsNullOrWhiteSpace($Kind)) { throw "-Kind is required" }
    if ([string]::IsNullOrWhiteSpace($ModelsCsv)) { throw "-ModelsCsv is required (comma-separated)" }
    $list = Split-List $ModelsCsv
    Set-ModelList $lib $Kind $list
    Save-Library $lib
    Write-Output "OK"
  }
}
