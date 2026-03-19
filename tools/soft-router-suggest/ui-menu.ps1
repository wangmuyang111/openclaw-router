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

# No pause prompts: keep the menu fast. Output remains in scrollback.

function Safe-Clear {
  # Some non-interactive hosts throw when clearing screen.
  try { Clear-Host } catch { }
}

function Read-LineOrEsc(
  [string]$prompt,
  [switch]$AllowEmpty
) {
  # Returns string, or $null if user pressed ESC.
  # Fallback: if console key reading is unavailable, user can type "esc".
  Write-Host -NoNewline $prompt

  try {
    $buf = ""
    while ($true) {
      $k = [Console]::ReadKey($true)
      if ($k.Key -eq 'Escape') {
        Write-Host
        return $null
      }
      if ($k.Key -eq 'Enter') {
        Write-Host
        if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($buf)) { continue }
        return $buf
      }
      if ($k.Key -eq 'Backspace') {
        if ($buf.Length -gt 0) {
          $buf = $buf.Substring(0, $buf.Length - 1)
          # Erase one char on screen
          Write-Host -NoNewline "`b `b"
        }
        continue
      }

      $ch = $k.KeyChar
      if ($ch -eq [char]0) { continue }
      $buf += $ch
      Write-Host -NoNewline $ch
    }
  } catch {
    # Non-console host fallback
    $s = Read-Host
    if ($s -match '^(esc|ESC)$') { return $null }
    if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($s)) { return "" }
    return $s
  }
}

function Wait-AnyKeyOrEsc([string]$message = '按任意键返回（ESC 也可以）') {
  # Without this, the next menu loop clears the screen and hides the output.
  Write-Host
  Write-Host $message -ForegroundColor DarkGray
  try {
    [void][Console]::ReadKey($true)
  } catch {
    # Fallback for non-console host
    [void](Read-Host)
  }
}

function Read-ChoiceOrEsc([string]$prompt) {
  return Read-LineOrEsc -prompt ("$prompt (ESC=Back): ")
}

function Read-MultiLine([string]$prompt, [string]$terminator = 'END') {
  # Returns string, or $null if user pressed ESC / typed "esc".
  Write-Host $prompt -ForegroundColor Cyan
  Write-Host "Paste text now. Finish with a single line: $terminator  (ESC=Back)" -ForegroundColor DarkGray
  $lines = New-Object System.Collections.Generic.List[string]
  while ($true) {
    $line = Read-LineOrEsc -prompt '' -AllowEmpty
    if ($null -eq $line) { return $null }
    if ($line -match '^(esc|ESC)$') { return $null }
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
  Write-Host "(Tip: press ESC to go back)" -ForegroundColor DarkGray
  $c = Read-ChoiceOrEsc 'Choose (1-3)'
  if ($null -eq $c) { return }
  if ($c -eq '1') { & $catalogScript | Out-Host; Wait-AnyKeyOrEsc }
  elseif ($c -eq '2') { & $catalogScript -Refresh | Out-Host; Wait-AnyKeyOrEsc }
}

function Get-KindModelList([string]$kind) {
  $lib = Load-Library
  $kr = $lib.kinds.$kind
  if ($null -eq $kr) { return @() }
  try { return @($kr.models.list) } catch { return @() }
}

function Print-NumberedList($arr) {
  if ($null -eq $arr -or $arr.Count -eq 0) {
    Write-Host "(empty)" -ForegroundColor DarkGray
    return
  }
  for ($i = 0; $i -lt $arr.Count; $i++) {
    Write-Host ("{0}) {1}" -f ($i + 1), $arr[$i])
  }
}

function Parse-IndexList([string]$s, [int]$max) {
  # Accept: "1" or "1,2,5" or "1 2 5". Returns 0-based unique indices.
  if ([string]::IsNullOrWhiteSpace($s)) { return @() }
  $parts = $s -split '[,\s]+' | Where-Object { $_ -ne '' }
  $out = New-Object System.Collections.Generic.HashSet[int]
  foreach ($p in $parts) {
    $n = 0
    if (-not [int]::TryParse($p, [ref]$n)) { continue }
    if ($n -lt 1 -or $n -gt $max) { continue }
    [void]$out.Add($n - 1)
  }
  return @($out | Sort-Object)
}

function Get-CatalogModels {
  # catalog.ps1 prints plain model IDs (one per line).
  return @(& $catalogScript)
}

function Reorder-Menu([string]$kind, [string]$kindModelsScript) {
  while ($true) {
    $list = @(Get-KindModelList $kind)
    Write-Host
    Write-Host "Reorder tools:" -ForegroundColor Cyan
    Write-Host "1) Move (by number)" 
    Write-Host "2) Pin to TOP (by number)" 
    Write-Host "0) Done" 
    Write-Host "(Tip: press ESC to go back)" -ForegroundColor DarkGray
    $c = Read-ChoiceOrEsc 'Choose (0-2)'
    if ($null -eq $c) { break }
    if ($c -eq '0') { break }

    if ($list.Count -eq 0) {
      Write-Host "List is empty." -ForegroundColor Yellow
      continue
    }

    switch ($c) {
      '1' {
        Print-NumberedList $list
        $from1 = Read-Host 'From (number)'
        $to1 = Read-Host 'To (number)'
        $from = 0; $to = 0
        if (-not [int]::TryParse($from1, [ref]$from)) { continue }
        if (-not [int]::TryParse($to1, [ref]$to)) { continue }
        if ($from -lt 1 -or $from -gt $list.Count -or $to -lt 1 -or $to -gt $list.Count) { continue }
        & $kindModelsScript move -Kind $kind -FromIndex ($from - 1) -ToIndex ($to - 1) | Out-Null
        Write-Host "Updated." -ForegroundColor Green
        Print-NumberedList @(Get-KindModelList $kind)
      }
      '2' {
        Print-NumberedList $list
        $pick = Read-Host 'Pin which number to TOP?'
        $n = 0
        if (-not [int]::TryParse($pick, [ref]$n)) { continue }
        if ($n -lt 1 -or $n -gt $list.Count) { continue }
        $mid = $list[$n - 1]
        & $kindModelsScript top -Kind $kind -ModelId $mid | Out-Null
        Write-Host "Pinned to top." -ForegroundColor Green
        Print-NumberedList @(Get-KindModelList $kind)
      }
    }
  }
}

function Run-Models {
  $kindModelsScript = Join-Path $toolsDir 'kind-models.ps1'

  while ($true) {
    Safe-Clear
    Write-Host "=== Kind -> Model Selection (Priority Lists) ===" -ForegroundColor Cyan
    Write-Host "Choose a kind to manage its model priority list." -ForegroundColor DarkGray
    Write-Host

    $kinds = List-Kinds
    $i = 1
    foreach ($k in $kinds) {
      Write-Host ("{0}) {1}" -f $i, $k)
      $i++
    }
    Write-Host "0) Back"

    Write-Host "(Tip: press ESC to go back)" -ForegroundColor DarkGray
    $pick = Read-ChoiceOrEsc ("Choose (0-{0})" -f $kinds.Count)
    if ($null -eq $pick -or $pick -eq '0') { break }

    $idx = -1
    if (-not [int]::TryParse($pick, [ref]$idx)) { continue }
    $idx = $idx - 1
    if ($idx -lt 0 -or $idx -ge $kinds.Count) { continue }

    $kind = $kinds[$idx]

    while ($true) {
      Safe-Clear
      Write-Host ("=== Kind: {0} ===" -f $kind) -ForegroundColor Green
      Write-Host
      Write-Host "1) Show current model list"
      Write-Host "2) Add model (pick from catalog)"
      Write-Host "3) Remove model (pick by number)"
      Write-Host "0) Back"

      Write-Host "(Tip: press ESC to go back)" -ForegroundColor DarkGray
      $c = Read-ChoiceOrEsc 'Choose (0-3)'
      if ($null -eq $c -or $c -eq '0') { break }

      try {
        switch ($c) {
          '1' {
            $list = @(Get-KindModelList $kind)
            Write-Host "Current models:" -ForegroundColor Cyan
            Print-NumberedList $list
            Reorder-Menu $kind $kindModelsScript
          }
          '2' {
            $catalog = @(Get-CatalogModels)
            if ($catalog.Count -eq 0) { throw 'Catalog is empty (run catalog refresh first?)' }
            Write-Host "Catalog models (available):" -ForegroundColor Cyan
            Print-NumberedList $catalog
            $sel = Read-Host ("Select model number(s) to add (e.g. 1,3). 0=cancel")
            if ($sel -eq '0') { break }
            $idxs = Parse-IndexList $sel $catalog.Count
            if ($idxs.Count -eq 0) { throw 'No valid selections.' }

            foreach ($ii in $idxs) {
              $mid = $catalog[$ii]
              try { & $kindModelsScript add -Kind $kind -ModelId $mid | Out-Null } catch { }
            }

            Write-Host "Updated models:" -ForegroundColor Green
            Print-NumberedList @(Get-KindModelList $kind)
            Reorder-Menu $kind $kindModelsScript
          }
          '3' {
            $list = @(Get-KindModelList $kind)
            Write-Host "Current models:" -ForegroundColor Cyan
            Print-NumberedList $list
            if ($list.Count -eq 0) { break }
            $sel = Read-Host "Select model number(s) to remove (e.g. 2,4). 0=cancel"
            if ($sel -eq '0') { break }
            $idxs = Parse-IndexList $sel $list.Count
            if ($idxs.Count -eq 0) { throw 'No valid selections.' }

            # remove by ModelId (remove in descending index order for safety)
            foreach ($ii in ($idxs | Sort-Object -Descending)) {
              $mid = $list[$ii]
              & $kindModelsScript remove -Kind $kind -ModelId $mid | Out-Null
            }

            Write-Host "Updated models:" -ForegroundColor Green
            Print-NumberedList @(Get-KindModelList $kind)
            Reorder-Menu $kind $kindModelsScript
          }
        }
      } catch {
        Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
        Write-Host
      }
    }
  }
}

function Pick-KindForKeywords {
  $kinds = List-Kinds
  Write-Host "Choose kind:" -ForegroundColor Cyan
  for ($i = 0; $i -lt $kinds.Count; $i++) {
    Write-Host ("{0}) {1}" -f ($i + 1), $kinds[$i])
  }
  Write-Host "0) Cancel"
  $pick = Read-Host ("Choose (0-{0})" -f $kinds.Count)
  if ($pick -eq '0') { return $null }
  $n = 0
  if (-not [int]::TryParse($pick, [ref]$n)) { return $null }
  if ($n -lt 1 -or $n -gt $kinds.Count) { return $null }
  return $kinds[$n - 1]
}

function Pick-SetIdForKind([string]$kind) {
  $setsAll = List-Sets
  $sets = @($setsAll | Where-Object { $_ -like "$kind.*" } | Sort-Object)
  if ($sets.Count -eq 0) { throw "No keyword sets found for kind '$kind'" }

  Write-Host
  Write-Host ("Keyword sets for kind '{0}':" -f $kind) -ForegroundColor Cyan
  for ($i = 0; $i -lt $sets.Count; $i++) {
    Write-Host ("{0}) {1}" -f ($i + 1), $sets[$i])
  }
  Write-Host "0) Cancel"

  $pick = Read-Host ("Choose (0-{0})" -f $sets.Count)
  if ($pick -eq '0') { return $null }
  $n = 0
  if (-not [int]::TryParse($pick, [ref]$n)) { return $null }
  if ($n -lt 1 -or $n -gt $sets.Count) { return $null }
  return $sets[$n - 1]
}

function Show-KindContext([string]$kind) {
  Write-Host
  Write-Host ("Selected kind: {0}" -f $kind) -ForegroundColor Green
  Write-Host "Current model priority list for this kind:" -ForegroundColor DarkGray
  $ml = @(Get-KindModelList $kind)
  Print-NumberedList $ml
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
      $kind = Pick-KindForKeywords
      if ($null -eq $kind) { break }
      Show-KindContext $kind
      $setId = Pick-SetIdForKind $kind
      if ($null -eq $setId) { break }
      $paste = Read-MultiLine -prompt ("Paste keywords to ADD into {0}:" -f $setId)
      & $overridesScript add -SetId $setId -PastedText $paste | Out-Host
    }

    '3' {
      $kind = Pick-KindForKeywords
      if ($null -eq $kind) { break }
      Show-KindContext $kind
      $setId = Pick-SetIdForKind $kind
      if ($null -eq $setId) { break }
      $paste = Read-MultiLine -prompt ("Paste keywords to REMOVE from {0}:" -f $setId)
      & $overridesScript remove -SetId $setId -PastedText $paste | Out-Host
    }

    '4' {
      $kind = Pick-KindForKeywords
      if ($null -eq $kind) { break }
      Show-KindContext $kind
      $setId = Pick-SetIdForKind $kind
      if ($null -eq $setId) { break }
      & $overridesScript clear -SetId $setId | Out-Host
    }
  }
}

function Run-Preview {
  Write-Host "=== Route Preview (NO LLM calls) ===" -ForegroundColor Cyan
  $text = Read-MultiLine -prompt 'Paste test text to classify (END to finish):'
  if ($null -eq $text) { return }
  $hasImage = Read-ChoiceOrEsc 'HasImage? (y/N)'
  if ($null -eq $hasImage) { return }
  if ($hasImage -match '^(y|Y)') {
    & $previewScript -Text $text -HasImage | Out-Host
  } else {
    & $previewScript -Text $text | Out-Host
  }
  Wait-AnyKeyOrEsc
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
  Safe-Clear
  Write-Host "Soft Router Suggest — Settings Menu" -ForegroundColor Green
  Write-Host "(No plugin enable required; safe to use while router plugin stays disabled.)" -ForegroundColor DarkGray
  Write-Host
  Write-Host "1) Model catalog (auto fetch / refresh)"
  Write-Host "2) Kind -> model selection (priority lists)"
  Write-Host "3) Keywords add/remove (paste-only overrides)"
  Write-Host "4) Add kind (new top-level kind; higher than fallback)"
  Write-Host "5) Route preview (local scoring; no LLM)"
  Write-Host "6) Show current kind -> models"
  Write-Host "0) Exit"

  Write-Host "(Tip: press ESC to go back)" -ForegroundColor DarkGray
  $choice = Read-ChoiceOrEsc 'Choose (0-6)'
  if ($null -eq $choice) { continue }
  try {
    switch ($choice) {
      '1' { Run-Catalog }
      '2' { Run-Models }
      '3' { Run-Keywords }
      '4' {
        $addKind = Join-Path $toolsDir 'add-kind.ps1'
        Write-Host "New kind id format: lowercase letters/digits/underscore, start with a letter (e.g. finance_ai)." -ForegroundColor DarkGray
        $kid = Read-ChoiceOrEsc 'Enter new kind id'
        if ($null -ne $kid -and $kid -ne '') {
          & $addKind -Kind $kid | Out-Host
          Write-Host "Added kind. Next: configure keywords (menu 3) and model priority (menu 2)." -ForegroundColor Green
          Wait-AnyKeyOrEsc
        }
      }
      '5' { Run-Preview }
      '6' { Show-CurrentKindModels; Wait-AnyKeyOrEsc }
      '0' { break }
      default { Write-Host 'Invalid choice' -ForegroundColor Yellow; Wait-AnyKeyOrEsc }
    }
  } catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    Wait-AnyKeyOrEsc
  }
}
