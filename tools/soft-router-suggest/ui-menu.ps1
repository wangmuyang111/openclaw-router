param(
  [ValidateSet('menu','catalog','models','keywords','preview')]
  [string]$Mode = 'menu'
)

$ErrorActionPreference = 'Stop'

$toolsDir = $PSScriptRoot
$catalogScript = Join-Path $toolsDir 'catalog.ps1'
$setModelsScript = Join-Path $toolsDir 'set-kind-models.ps1'
$overridesScript = Join-Path $toolsDir 'manage-overrides.ps1'
$previewScript = Join-Path $toolsDir 'route-preview.ps1'
$libraryPath = Join-Path $toolsDir 'keyword-library.json'

function Pause-Any {
  Write-Host
  Read-Host 'Press Enter to continue' | Out-Null
}

function Read-MultiLine([string]$prompt, [string]$terminator = 'END') {
  Write-Host $prompt -ForegroundColor Cyan
  Write-Host "Paste text now. Finish with a single line: $terminator" -ForegroundColor DarkGray
  $lines = New-Object System.Collections.Generic.List[string]
  while ($true) {
    $line = Read-Host
    if ($line -eq $terminator) { break }
    $lines.Add($line)
  }
  return ($lines -join "`n")
}

function Load-Library {
  if (!(Test-Path $libraryPath)) { throw "Missing: $libraryPath" }
  return (Get-Content $libraryPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function List-Kinds {
  $lib = Load-Library
  if (-not $lib.kinds) { return @() }
  return @($lib.kinds.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' } | ForEach-Object { $_.Name })
}

function List-Sets {
  $lib = Load-Library
  if (-not $lib.keywordSets) { return @() }
  return @($lib.keywordSets.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' } | ForEach-Object { $_.Name })
}

function Show-CurrentKindModels {
  $lib = Load-Library
  Write-Host "=== Current kind -> models.list ===" -ForegroundColor Cyan
  foreach ($k in (List-Kinds)) {
    $kr = $lib.kinds.$k
    $list = @()
    try { $list = @($kr.models.list) } catch {}
    $listStr = if ($list.Count -gt 0) { $list -join ', ' } else { '(empty)' }
    Write-Host ("{0,-18} {1}" -f $k, $listStr)
  }
}

function Run-Catalog {
  Write-Host "=== Model Catalog ===" -ForegroundColor Cyan
  Write-Host "1) View (use cache if fresh)" 
  Write-Host "2) Refresh now" 
  Write-Host "3) Back" 
  $c = Read-Host 'Choose (1-3)'
  if ($c -eq '1') { & $catalogScript | Out-Host }
  elseif ($c -eq '2') { & $catalogScript -Refresh | Out-Host }
}

function Run-Models {
  Write-Host "=== Kind -> Model Selection (Priority List) ===" -ForegroundColor Cyan
  Write-Host "Policy note: you can save lists here; runtime switching can remain disabled." -ForegroundColor DarkGray
  Write-Host
  Write-Host "1) Show current kind -> model list" 
  Write-Host "2) Set ALL kinds to one model" 
  Write-Host "3) Set ONE kind to one model" 
  Write-Host "4) Back" 
  $c = Read-Host 'Choose (1-4)'
  switch ($c) {
    '1' { Show-CurrentKindModels }
    '2' {
      $m = Read-Host 'ModelId (default: local-proxy/gpt-5.2)'
      if ([string]::IsNullOrWhiteSpace($m)) { $m = 'local-proxy/gpt-5.2' }
      & $setModelsScript -ModelId $m | Out-Host
    }
    '3' {
      $kinds = List-Kinds
      Write-Host ('Available kinds: ' + ($kinds -join ', ')) -ForegroundColor DarkGray
      $k = Read-Host 'Kind'
      $m = Read-Host 'ModelId (default: local-proxy/gpt-5.2)'
      if ([string]::IsNullOrWhiteSpace($m)) { $m = 'local-proxy/gpt-5.2' }
      & $setModelsScript -Kind $k -ModelId $m | Out-Host
    }
  }
}

function Run-Keywords {
  Write-Host "=== Keywords (Paste-only overrides) ===" -ForegroundColor Cyan
  Write-Host "Format:" -ForegroundColor DarkGray
  Write-Host "- one term per line" -ForegroundColor DarkGray
  Write-Host "- lines starting with # are comments" -ForegroundColor DarkGray
  Write-Host "- comma is allowed as a separator (tolerant)" -ForegroundColor DarkGray
  Write-Host
  Write-Host "1) List overrides" 
  Write-Host "2) Add keywords (paste)" 
  Write-Host "3) Remove keywords (paste)" 
  Write-Host "4) Clear one set" 
  Write-Host "5) Back" 
  $c = Read-Host 'Choose (1-5)'

  switch ($c) {
    '1' { & $overridesScript list | Out-Host }
    '2' {
      $sets = List-Sets
      Write-Host ('Available sets (examples): ' + (($sets | Select-Object -First 15) -join ', ') + ' ...') -ForegroundColor DarkGray
      $setId = Read-Host 'SetId (e.g. coding.strong / planning.weak / quick_response.negative)'
      $paste = Read-MultiLine -prompt 'Paste keywords to ADD:'
      & $overridesScript add -SetId $setId -PastedText $paste | Out-Host
    }
    '3' {
      $sets = List-Sets
      Write-Host ('Available sets (examples): ' + (($sets | Select-Object -First 15) -join ', ') + ' ...') -ForegroundColor DarkGray
      $setId = Read-Host 'SetId'
      $paste = Read-MultiLine -prompt 'Paste keywords to REMOVE:'
      & $overridesScript remove -SetId $setId -PastedText $paste | Out-Host
    }
    '4' {
      $setId = Read-Host 'SetId to clear'
      & $overridesScript clear -SetId $setId | Out-Host
    }
  }
}

function Run-Preview {
  Write-Host "=== Route Preview (NO LLM calls) ===" -ForegroundColor Cyan
  $text = Read-MultiLine -prompt 'Paste test text to classify (END to finish):'
  $hasImage = Read-Host 'HasImage? (y/N)'
  if ($hasImage -match '^(y|Y)') {
    & $previewScript -Text $text -HasImage | Out-Host
  } else {
    & $previewScript -Text $text | Out-Host
  }
}

if ($Mode -ne 'menu') {
  switch ($Mode) {
    'catalog' { Run-Catalog; exit 0 }
    'models' { Run-Models; exit 0 }
    'keywords' { Run-Keywords; exit 0 }
    'preview' { Run-Preview; exit 0 }
  }
}

while ($true) {
  Clear-Host
  Write-Host "Soft Router Suggest — Settings Menu" -ForegroundColor Green
  Write-Host "(No plugin enable required; safe to use while router plugin stays disabled.)" -ForegroundColor DarkGray
  Write-Host
  Write-Host "1) Model catalog (auto fetch / refresh)"
  Write-Host "2) Kind -> model selection (priority lists)"
  Write-Host "3) Keywords add/remove (paste-only overrides)"
  Write-Host "4) Route preview (local scoring; no LLM)"
  Write-Host "5) Show current kind -> models"
  Write-Host "0) Exit"

  $choice = Read-Host 'Choose (0-5)'
  try {
    switch ($choice) {
      '1' { Run-Catalog; Pause-Any }
      '2' { Run-Models; Pause-Any }
      '3' { Run-Keywords; Pause-Any }
      '4' { Run-Preview; Pause-Any }
      '5' { Show-CurrentKindModels; Pause-Any }
      '0' { break }
      default { Write-Host 'Invalid choice' -ForegroundColor Yellow; Pause-Any }
    }
  } catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    Pause-Any
  }
}
