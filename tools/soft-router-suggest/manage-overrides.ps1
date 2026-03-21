param(
  [Parameter(Mandatory=$false, Position=0)]
  [ValidateSet('add','remove','clear','list')]
  [string]$Action = 'list',

  [string]$SetId = "",

  [string]$PastedText = "",
  [string]$OverridesPath = ""
)

if ([string]::IsNullOrWhiteSpace($OverridesPath)) {
  $OverridesPath = Join-Path $PSScriptRoot 'keyword-overrides.user.json'
}

function Parse-PastedLines($text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return @() }
  $normalized = $text -replace "`r`n?", "`n"
  $lines = $normalized -split "`n"
  $out = @()
  foreach ($line in $lines) {
    $line = $line.Trim()
    if (-not $line) { continue }
    if ($line.StartsWith("#")) { continue }
    $line = $line -replace '[，、/]+', ','
    $parts = $line -split '\s*,\s*'
    foreach ($p in $parts) {
      $p = $p.Trim()
      if ($p) { $out += $p }
    }
  }
  return $out
}

function Load-Overrides {
  if (Test-Path $OverridesPath) {
    try {
      $content = Get-Content $OverridesPath -Raw -Encoding UTF8
      if (-not [string]::IsNullOrWhiteSpace($content)) {
        return $content | ConvertFrom-Json
      }
    } catch {
      Write-Host "Warning: Could not parse overrides, starting fresh." -ForegroundColor Yellow
    }
  }

  return [ordered]@{
    version = 1
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    notes = "User keyword overrides via manage-overrides.ps1 / UI paste."
    sets = [ordered]@{}
    kinds = [ordered]@{}
  }
}

function Save-Overrides($obj) {
  $obj.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  $json = $obj | ConvertTo-Json -Depth 10
  Set-Content -Path $OverridesPath -Value $json -Encoding UTF8
  Write-Host "Saved: $OverridesPath" -ForegroundColor Green
}

$ov = Load-Overrides

switch ($Action) {
  'list' {
    Write-Host "=== User Keyword Overrides ==="
    $sets = $ov.sets
    if ($null -eq $sets) {
      Write-Host "No overrides configured."
      break
    }

    $props = $sets.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' }
    if ($SetId) {
      $props = @($props | Where-Object { $_.Name -eq $SetId })
    }
    if ($props.Count -eq 0) {
      Write-Host "No overrides configured."
      break
    }

    foreach ($prop in $props) {
      $sid = $prop.Name
      $sdata = $prop.Value
      Write-Host "Set: $sid"
      if ($sdata.add -and $sdata.add.Count -gt 0) {
        Write-Host "  + Add   : $($sdata.add -join ', ')"
      }
      if ($sdata.remove -and $sdata.remove.Count -gt 0) {
        Write-Host "  - Remove: $($sdata.remove -join ', ')"
      }
      if ((-not $sdata.add -or $sdata.add.Count -eq 0) -and (-not $sdata.remove -or $sdata.remove.Count -eq 0)) {
        Write-Host "  (empty)"
      }
    }
  }

  'clear' {
    if ($SetId) {
      if ($ov.sets.$SetId) {
        $ov.sets.PSObject.Properties.Remove($SetId)
        Save-Overrides $ov
        Write-Host "Cleared overrides for set: $SetId"
      }
    } else {
      $ov.sets = [ordered]@{}
      Save-Overrides $ov
      Write-Host "Cleared ALL overrides."
    }
  }

  'add' {
    if (-not $SetId) { throw "--SetId is required (e.g. strategy.strong)" }
    if (-not $PastedText) { throw "Please provide --PastedText" }
    
    $items = Parse-PastedLines $PastedText
    if ($items.Count -eq 0) { throw "No valid keywords found in paste." }

    if (-not $ov.sets) { $ov.sets = [ordered]@{} }
    if (-not $ov.sets.$SetId) { $ov.sets.$SetId = [ordered]@{ add=@(); remove=@() } }
    
    $existingAdd = if ($ov.sets.$SetId.add) { @($ov.sets.$SetId.add) } else { @() }
    $merged = $existingAdd + $items | Select-Object -Unique
    $ov.sets.$SetId.add = $merged

    Save-Overrides $ov
    Write-Host "Added $($items.Count) keywords to $SetId"
  }

  'remove' {
    if (-not $SetId) { throw "--SetId is required (e.g. strategy.strong)" }
    if (-not $PastedText) { throw "Please provide --PastedText" }
    
    $items = Parse-PastedLines $PastedText
    if ($items.Count -eq 0) { throw "No valid keywords found in paste." }

    if (-not $ov.sets) { $ov.sets = [ordered]@{} }
    if (-not $ov.sets.$SetId) { $ov.sets.$SetId = [ordered]@{ add=@(); remove=@() } }
    
    $existingRemove = if ($ov.sets.$SetId.remove) { @($ov.sets.$SetId.remove) } else { @() }
    $merged = $existingRemove + $items | Select-Object -Unique
    $ov.sets.$SetId.remove = $merged

    Save-Overrides $ov
    Write-Host "Registered $($items.Count) keywords to remove from $SetId"
  }
}
