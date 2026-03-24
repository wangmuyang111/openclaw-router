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
$runtimeRoutingPath = Join-Path $toolsDir 'runtime-routing.json'
$settingsPath = Join-Path $toolsDir 'ui.settings.json'
$i18nDir = Join-Path $toolsDir 'i18n'
$zhPath = Join-Path $i18nDir 'zh-CN.json'
$enPath = Join-Path $i18nDir 'en-US.json'

# No pause prompts: keep the menu fast. Output remains in scrollback.

function Safe-Clear {
  try { Clear-Host } catch { }
}

function Load-JsonFile([string]$path) {
  if (!(Test-Path $path)) { return $null }
  return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Save-JsonFile([string]$path, $obj) {
  ($obj | ConvertTo-Json -Depth 20) | Set-Content -Path $path -Encoding UTF8
}

function Get-DefaultRuntimeRouting {
  return [ordered]@{
    taskModeEnabled = $false
    taskModePrimaryKind = 'coding'
    taskModeKinds = @('coding')
    taskModeDisabledKinds = @()
    taskModeMinConfidence = 'medium'
    taskModeReturnToPrimary = $true
    taskModeAllowAutoDowngrade = $false
    freeSwitchWhenTaskModeOff = $true
  }
}

function Load-RuntimeRouting {
  $defaults = Get-DefaultRuntimeRouting
  $raw = Load-JsonFile $runtimeRoutingPath
  if ($null -eq $raw) {
    return [pscustomobject]$defaults
  }

  $taskKinds = @()
  if ($raw.PSObject.Properties.Name -contains 'taskModeKinds' -and $null -ne $raw.taskModeKinds) {
    foreach ($item in @($raw.taskModeKinds)) {
      $text = [string]$item
      if (-not [string]::IsNullOrWhiteSpace($text)) { $taskKinds += $text.Trim() }
    }
  }

  $primaryKind = [string]$defaults.taskModePrimaryKind
  if ($raw.PSObject.Properties.Name -contains 'taskModePrimaryKind' -and -not [string]::IsNullOrWhiteSpace([string]$raw.taskModePrimaryKind)) {
    $primaryKind = ([string]$raw.taskModePrimaryKind).Trim()
  }
  if ($taskKinds -notcontains $primaryKind) { $taskKinds = @($primaryKind) + @($taskKinds) }
  $taskKinds = @($taskKinds | Select-Object -Unique)

  $disabledKinds = @()
  if ($raw.PSObject.Properties.Name -contains 'taskModeDisabledKinds' -and $null -ne $raw.taskModeDisabledKinds) {
    foreach ($item in @($raw.taskModeDisabledKinds)) {
      $text = [string]$item
      if (-not [string]::IsNullOrWhiteSpace($text) -and $text.Trim() -ne $primaryKind) { $disabledKinds += $text.Trim() }
    }
    $disabledKinds = @($disabledKinds | Select-Object -Unique)
  }

  return [pscustomobject][ordered]@{
    taskModeEnabled = if ($raw.PSObject.Properties.Name -contains 'taskModeEnabled') { [bool]$raw.taskModeEnabled } else { [bool]$defaults.taskModeEnabled }
    taskModePrimaryKind = $primaryKind
    taskModeKinds = if ($taskKinds.Count -gt 0) { $taskKinds } else { @($defaults.taskModeKinds) }
    taskModeDisabledKinds = $disabledKinds
    taskModeMinConfidence = if (@('low','medium','high') -contains ([string]$raw.taskModeMinConfidence).ToLowerInvariant()) { ([string]$raw.taskModeMinConfidence).ToLowerInvariant() } else { [string]$defaults.taskModeMinConfidence }
    taskModeReturnToPrimary = if ($raw.PSObject.Properties.Name -contains 'taskModeReturnToPrimary') { [bool]$raw.taskModeReturnToPrimary } else { [bool]$defaults.taskModeReturnToPrimary }
    taskModeAllowAutoDowngrade = if ($raw.PSObject.Properties.Name -contains 'taskModeAllowAutoDowngrade') { [bool]$raw.taskModeAllowAutoDowngrade } else { [bool]$defaults.taskModeAllowAutoDowngrade }
    freeSwitchWhenTaskModeOff = if ($raw.PSObject.Properties.Name -contains 'freeSwitchWhenTaskModeOff') { [bool]$raw.freeSwitchWhenTaskModeOff } else { [bool]$defaults.freeSwitchWhenTaskModeOff }
  }
}

function Save-RuntimeRouting($cfg) {
  if ($null -eq $cfg.taskModeKinds) { $cfg | Add-Member -NotePropertyName taskModeKinds -NotePropertyValue @('coding') -Force }
  if ($null -eq $cfg.taskModeDisabledKinds) { $cfg | Add-Member -NotePropertyName taskModeDisabledKinds -NotePropertyValue @() -Force }
  $cfg.taskModeKinds = @(@($cfg.taskModeKinds) | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ } | Select-Object -Unique)
  $cfg.taskModeDisabledKinds = @(@($cfg.taskModeDisabledKinds) | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -and $_ -ne [string]$cfg.taskModePrimaryKind } | Select-Object -Unique)
  if ($cfg.taskModeKinds -notcontains [string]$cfg.taskModePrimaryKind) {
    $cfg.taskModeKinds = @([string]$cfg.taskModePrimaryKind) + @($cfg.taskModeKinds)
  }
  Save-JsonFile $runtimeRoutingPath $cfg
}

$script:LangZh = Load-JsonFile $zhPath
$script:LangEn = Load-JsonFile $enPath
$script:UiSettings = Load-JsonFile $settingsPath
if ($null -eq $script:UiSettings) { $script:UiSettings = [ordered]@{ language = 'both' } }
if ([string]::IsNullOrWhiteSpace($script:UiSettings.language)) { $script:UiSettings.language = 'both' }

function Get-LanguageMode {
  $lang = "$($script:UiSettings.language)".Trim().ToLowerInvariant()
  if ($lang -notin @('zh','en','both')) { return 'both' }
  return $lang
}

function Set-LanguageMode([string]$mode) {
  if ($mode -notin @('zh','en','both')) { return }
  $script:UiSettings.language = $mode
  Save-JsonFile $settingsPath $script:UiSettings
}

function Get-I18nValue($obj, [string]$key) {
  if ($null -eq $obj) { return $null }
  foreach ($p in $obj.PSObject.Properties) {
    if ($p.Name -eq $key) { return [string]$p.Value }
  }
  return $null
}

function T([string]$key) {
  $lang = Get-LanguageMode
  $zh = Get-I18nValue $script:LangZh $key
  $en = Get-I18nValue $script:LangEn $key
  if ([string]::IsNullOrWhiteSpace($zh)) { $zh = $key }
  if ([string]::IsNullOrWhiteSpace($en)) { $en = $key }

  switch ($lang) {
    'zh' { return $zh }
    'en' { return $en }
    default {
      if ($zh -eq $en) { return $zh }
      return "$zh / $en"
    }
  }
}

function Tf {
  param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Key,

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [object[]]$FormatArgs
  )

  $template = T $Key
  if ($null -eq $FormatArgs -or $FormatArgs.Count -eq 0) { return $template }

  $result = [string]$template
  for ($i = 0; $i -lt $FormatArgs.Count; $i++) {
    $result = $result.Replace(("{" + $i + "}"), [string]$FormatArgs[$i])
  }
  return $result
}

function Format-KindLabel([string]$kindId) {
  $label = T ("kind.{0}" -f $kindId)
  if ([string]::IsNullOrWhiteSpace($label) -or $label -eq ("kind.{0}" -f $kindId)) {
    return $kindId
  }
  return "$label [$kindId]"
}

function Read-LineOrEsc(
  [string]$prompt,
  [switch]$AllowEmpty
) {
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
    $s = Read-Host
    if ($s -match '^(esc|ESC)$') { return $null }
    if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($s)) { return "" }
    return $s
  }
}

function Wait-AnyKeyOrEsc([string]$message = '') {
  if ([string]::IsNullOrWhiteSpace($message)) { $message = T 'menu.pressAnyKey' }
  Write-Host
  Write-Host $message -ForegroundColor DarkGray
  try {
    [void][Console]::ReadKey($true)
  } catch {
    [void](Read-Host)
  }
}

function Read-ChoiceOrEsc([string]$prompt) {
  return Read-LineOrEsc -prompt ("$prompt (ESC=" + (T 'menu.back') + "): ")
}

function Read-InputOrEsc([string]$prompt, [switch]$AllowEmpty) {
  return Read-LineOrEsc -prompt ("$prompt (ESC=" + (T 'menu.back') + "): ") -AllowEmpty:$AllowEmpty
}

function Read-KeywordInput([string]$prompt) {
  Write-Host $prompt -ForegroundColor Cyan
  Write-Host (T 'prompt.keywordInputHelp') -ForegroundColor DarkGray
  return Read-LineOrEsc -prompt '' -AllowEmpty
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

function Load-OverridesFile {
  $path = Join-Path $toolsDir 'keyword-overrides.user.json'
  if (!(Test-Path $path)) { return $null }
  try {
    return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Get-EffectiveKeywordSet([string]$setId) {
  $lib = Load-Library
  $base = @()
  try { $base = @($lib.keywordSets.$setId) } catch { $base = @() }

  $ov = Load-OverridesFile
  $add = @()
  $remove = @()
  try { $add = @($ov.sets.$setId.add) } catch { $add = @() }
  try { $remove = @($ov.sets.$setId.remove) } catch { $remove = @() }

  $merged = @($base + $add | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
  if ($remove.Count -gt 0) {
    $removeSet = @{}
    foreach ($r in $remove) { if (-not [string]::IsNullOrWhiteSpace($r)) { $removeSet[$r] = $true } }
    $merged = @($merged | Where-Object { -not $removeSet.ContainsKey([string]$_) })
  }
  return $merged
}

function Show-CurrentKindModels {
  $lib = Load-Library
  Write-Host (("=== {0} ===" -f (T 'menu.currentModels'))) -ForegroundColor Cyan
  foreach ($k in (List-Kinds)) {
    $kr = $lib.kinds.$k
    $list = @()
    try { $list = @($kr.models.list) } catch {}
    $listStr = if ($list.Count -gt 0) { $list -join ', ' } else { T 'status.empty' }
    Write-Host ("{0,-30} {1}" -f (Format-KindLabel $k), $listStr)
  }
}

function Run-Catalog {
  Write-Host (("=== {0} ===" -f (T 'catalog.title'))) -ForegroundColor Cyan
  Write-Host ("1) " + (T 'catalog.view'))
  Write-Host ("2) " + (T 'catalog.refresh'))
  Write-Host ("3) " + (T 'menu.back'))
  Write-Host ((T 'menu.tipEsc')) -ForegroundColor DarkGray
  $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(3))
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

function Print-NumberedList($arr, [switch]$Kinds) {
  if ($null -eq $arr -or $arr.Count -eq 0) {
    Write-Host (T 'status.empty') -ForegroundColor DarkGray
    return
  }
  for ($i = 0; $i -lt $arr.Count; $i++) {
    $value = if ($Kinds) { Format-KindLabel ([string]$arr[$i]) } else { $arr[$i] }
    Write-Host ("{0}) {1}" -f ($i + 1), $value)
  }
}

function Print-KeywordFlow($arr, [int]$MaxWidth = 100) {
  if ($null -eq $arr -or $arr.Count -eq 0) {
    Write-Host (T 'status.empty') -ForegroundColor DarkGray
    return
  }

  $line = ''
  foreach ($item in $arr) {
    $text = [string]$item
    if ([string]::IsNullOrWhiteSpace($text)) { continue }
    if ([string]::IsNullOrEmpty($line)) {
      $line = $text
      continue
    }

    $candidate = $line + ', ' + $text
    if ($candidate.Length -le $MaxWidth) {
      $line = $candidate
    } else {
      Write-Host $line
      $line = $text
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($line)) {
    Write-Host $line
  }
}

function Get-DisplayWidth([string]$text) {
  if ([string]::IsNullOrEmpty($text)) { return 0 }
  $w = 0
  foreach ($ch in $text.ToCharArray()) {
    if ([int][char]$ch -gt 255) { $w += 2 } else { $w += 1 }
  }
  return $w
}

function Pad-DisplayRight([string]$text, [int]$width) {
  $s = [string]$text
  $pad = $width - (Get-DisplayWidth $s)
  if ($pad -le 0) { return $s }
  return ($s + (' ' * $pad))
}

function Print-KeywordNumberedFlow($arr, [int]$MaxWidth = 100) {
  if ($null -eq $arr -or $arr.Count -eq 0) {
    Write-Host (T 'status.empty') -ForegroundColor DarkGray
    return
  }

  $items = @()
  for ($i = 0; $i -lt $arr.Count; $i++) {
    $text = [string]$arr[$i]
    if ([string]::IsNullOrWhiteSpace($text)) { continue }
    $items += ('{0}.{1}' -f ($i + 1), $text)
  }
  if ($items.Count -eq 0) {
    Write-Host (T 'status.empty') -ForegroundColor DarkGray
    return
  }

  $maxItemWidth = 0
  foreach ($item in $items) {
    $w = Get-DisplayWidth $item
    if ($w -gt $maxItemWidth) { $maxItemWidth = $w }
  }

  $bufferWidth = $MaxWidth
  try {
    if ($Host -and $Host.UI -and $Host.UI.RawUI) {
      $rawWidth = [int]$Host.UI.RawUI.WindowSize.Width
      if ($rawWidth -gt 20) { $bufferWidth = $rawWidth - 4 }
    }
  } catch { }

  $colWidth = [Math]::Max($maxItemWidth + 2, 14)
  $columns = [Math]::Max(1, [Math]::Floor(($bufferWidth + 2) / ($colWidth + 2)))

  for ($start = 0; $start -lt $items.Count; $start += $columns) {
    $parts = @()
    for ($j = 0; $j -lt $columns; $j++) {
      $idx = $start + $j
      if ($idx -ge $items.Count) { break }
      $parts += (Pad-DisplayRight $items[$idx] $colWidth)
    }
    Write-Host (($parts -join '  ').TrimEnd())
  }
}

function Join-KeywordSelection($arr, $idxs) {
  if ($null -eq $arr -or $arr.Count -eq 0) { return '' }
  if ($null -eq $idxs -or $idxs.Count -eq 0) { return '' }
  $picked = @()
  foreach ($ii in $idxs) {
    if ($ii -ge 0 -and $ii -lt $arr.Count) {
      $picked += [string]$arr[$ii]
    }
  }
  return ($picked -join ', ')
}

function Parse-IndexList([string]$s, [int]$max) {
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
  return @(& $catalogScript)
}

function Reorder-Menu([string]$kind, [string]$kindModelsScript) {
  while ($true) {
    $list = @(Get-KindModelList $kind)
    Write-Host
    Write-Host ((T 'models.title')) -ForegroundColor Cyan
    Write-Host ("1) " + (T 'models.move'))
    Write-Host ("2) " + (T 'models.pinTop'))
    Write-Host ("0) " + (T 'menu.done'))
    Write-Host ((T 'menu.tipEsc')) -ForegroundColor DarkGray
    $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(2))
    if ($null -eq $c) { break }
    if ($c -eq '0') { break }

    if ($list.Count -eq 0) {
      Write-Host (T 'status.listEmpty') -ForegroundColor Yellow
      continue
    }

    switch ($c) {
      '1' {
        Print-NumberedList $list
        $from1 = Read-InputOrEsc (T 'prompt.from')
        if ($null -eq $from1) { continue }
        $to1 = Read-InputOrEsc (T 'prompt.to')
        if ($null -eq $to1) { continue }
        $from = 0; $to = 0
        if (-not [int]::TryParse($from1, [ref]$from)) { continue }
        if (-not [int]::TryParse($to1, [ref]$to)) { continue }
        if ($from -lt 1 -or $from -gt $list.Count -or $to -lt 1 -or $to -gt $list.Count) { continue }
        & $kindModelsScript move -Kind $kind -FromIndex ($from - 1) -ToIndex ($to - 1) | Out-Null
        Write-Host (T 'status.updated') -ForegroundColor Green
        Print-NumberedList @(Get-KindModelList $kind)
      }
      '2' {
        Print-NumberedList $list
        $pick = Read-InputOrEsc (T 'prompt.pinWhich')
        if ($null -eq $pick) { continue }
        $n = 0
        if (-not [int]::TryParse($pick, [ref]$n)) { continue }
        if ($n -lt 1 -or $n -gt $list.Count) { continue }
        $mid = $list[$n - 1]
        & $kindModelsScript top -Kind $kind -ModelId $mid | Out-Null
        Write-Host (T 'status.pinnedTop') -ForegroundColor Green
        Print-NumberedList @(Get-KindModelList $kind)
      }
    }
  }
}

function Run-Models {
  $kindModelsScript = Join-Path $toolsDir 'kind-models.ps1'

  while ($true) {
    Safe-Clear
    Write-Host (("=== {0} ===" -f (T 'models.title'))) -ForegroundColor Cyan
    Write-Host (T 'models.chooseKind') -ForegroundColor DarkGray
    Write-Host

    $kinds = List-Kinds
    Print-NumberedList $kinds -Kinds
    Write-Host ("0) " + (T 'menu.back'))

    Write-Host ((T 'menu.tipEsc')) -ForegroundColor DarkGray
    $pick = Read-ChoiceOrEsc (Tf 'prompt.chooseKind' @($kinds.Count))
    if ($null -eq $pick -or $pick -eq '0') { break }

    $idx = -1
    if (-not [int]::TryParse($pick, [ref]$idx)) { continue }
    $idx = $idx - 1
    if ($idx -lt 0 -or $idx -ge $kinds.Count) { continue }

    $kind = $kinds[$idx]

    while ($true) {
      Safe-Clear
      Write-Host (("=== {0}: {1} ===" -f (T 'prompt.kind'), (Format-KindLabel $kind))) -ForegroundColor Green
      Write-Host
      Write-Host ("1) " + (T 'models.showCurrent'))
      Write-Host ("2) " + (T 'models.add'))
      Write-Host ("3) " + (T 'models.remove'))
      Write-Host ("0) " + (T 'menu.back'))

      Write-Host ((T 'menu.tipEsc')) -ForegroundColor DarkGray
      $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(3))
      if ($null -eq $c -or $c -eq '0') { break }

      try {
        switch ($c) {
          '1' {
            $list = @(Get-KindModelList $kind)
            Write-Host (T 'models.current') -ForegroundColor Cyan
            Print-NumberedList $list
            Reorder-Menu $kind $kindModelsScript
          }
          '2' {
            $catalog = @(Get-CatalogModels)
            if ($catalog.Count -eq 0) { throw (T 'error.catalogEmpty') }
            Write-Host (T 'models.catalogAvailable') -ForegroundColor Cyan
            Print-NumberedList $catalog
            $sel = Read-InputOrEsc (T 'prompt.selectAdd')
            if ($null -eq $sel -or $sel -eq '0') { continue }
            $idxs = Parse-IndexList $sel $catalog.Count
            if ($idxs.Count -eq 0) { throw (T 'error.noValidSelection') }

            foreach ($ii in $idxs) {
              $mid = $catalog[$ii]
              try { & $kindModelsScript add -Kind $kind -ModelId $mid | Out-Null } catch { }
            }

            Write-Host (T 'models.updated') -ForegroundColor Green
            Print-NumberedList @(Get-KindModelList $kind)
            Reorder-Menu $kind $kindModelsScript
          }
          '3' {
            $list = @(Get-KindModelList $kind)
            Write-Host (T 'models.current') -ForegroundColor Cyan
            Print-NumberedList $list
            if ($list.Count -eq 0) { break }
            $sel = Read-InputOrEsc (T 'prompt.selectRemove')
            if ($null -eq $sel -or $sel -eq '0') { continue }
            $idxs = Parse-IndexList $sel $list.Count
            if ($idxs.Count -eq 0) { throw (T 'error.noValidSelection') }

            foreach ($ii in ($idxs | Sort-Object -Descending)) {
              $mid = $list[$ii]
              & $kindModelsScript remove -Kind $kind -ModelId $mid | Out-Null
            }

            Write-Host (T 'models.updated') -ForegroundColor Green
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
  Write-Host (T 'keywords.chooseKind') -ForegroundColor Cyan
  Print-NumberedList $kinds -Kinds
  Write-Host ("0) " + (T 'menu.cancel'))
  $pick = Read-ChoiceOrEsc (Tf 'prompt.chooseKind' @($kinds.Count))
  if ($null -eq $pick) { return $null }
  if ($pick -eq '0') { return $null }
  $n = 0
  if (-not [int]::TryParse($pick, [ref]$n)) { return $null }
  if ($n -lt 1 -or $n -gt $kinds.Count) { return $null }
  return $kinds[$n - 1]
}

function Pick-SetIdForKind([string]$kind) {
  $setsAll = List-Sets
  $sets = @($setsAll | Where-Object { $_ -like "$kind.*" } | Sort-Object)
  if ($sets.Count -eq 0) { throw ((T 'keywords.noSets') + ": $kind") }

  Write-Host
  Write-Host (("{0} '{1}':" -f (T 'keywords.setsForKind'), (Format-KindLabel $kind))) -ForegroundColor Cyan
  for ($i = 0; $i -lt $sets.Count; $i++) {
    Write-Host ("{0}) {1}" -f ($i + 1), $sets[$i])
  }
  Write-Host ("0) " + (T 'menu.cancel'))

  $pick = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @($sets.Count))
  if ($null -eq $pick) { return $null }
  if ($pick -eq '0') { return $null }
  $n = 0
  if (-not [int]::TryParse($pick, [ref]$n)) { return $null }
  if ($n -lt 1 -or $n -gt $sets.Count) { return $null }
  return $sets[$n - 1]
}

function Show-KeywordSetHint([string]$setId) {
  if ([string]::IsNullOrWhiteSpace($setId)) { return }
  Write-Host (T 'keywords.hintTitle') -ForegroundColor Cyan
  if ($setId -like '*.strong') {
    Write-Host (T 'keywords.hintStrong') -ForegroundColor DarkGray
  } elseif ($setId -like '*.weak') {
    Write-Host (T 'keywords.hintWeak') -ForegroundColor DarkGray
  } elseif ($setId -like '*.negative') {
    Write-Host (T 'keywords.hintNegative') -ForegroundColor DarkGray
  }
  Write-Host (T 'keywords.hintSeparators') -ForegroundColor DarkGray
  Write-Host (T 'keywords.hintSpaceNote') -ForegroundColor DarkGray
  Write-Host
}

function Show-KindContext([string]$kind) {
  Write-Host
  Write-Host (("{0}: {1}" -f (T 'keywords.selectedKind'), (Format-KindLabel $kind))) -ForegroundColor Green
  Write-Host (T 'keywords.currentModelList') -ForegroundColor DarkGray
  $ml = @(Get-KindModelList $kind)
  Print-NumberedList $ml
}

function Configure-KeywordsForKind([string]$kind) {
  while ($true) {
    Safe-Clear
    Write-Host (("=== {0}: {1} ===" -f (T 'keywords.title'), (Format-KindLabel $kind))) -ForegroundColor Cyan
    Show-KindContext $kind
    Write-Host
    Write-Host ((T 'keywords.format')) -ForegroundColor DarkGray
    Write-Host ("- " + (T 'keywords.onePerLine')) -ForegroundColor DarkGray
    Write-Host ("- " + (T 'keywords.comment')) -ForegroundColor DarkGray
    Write-Host ("- " + (T 'keywords.comma')) -ForegroundColor DarkGray
    Write-Host
    Write-Host ("1) " + (T 'keywords.add'))
    Write-Host ("2) " + (T 'keywords.remove'))
    Write-Host ("3) " + (T 'keywords.clear'))
    Write-Host ("0) " + (T 'menu.back'))

    $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(3))
    if ($null -eq $c -or $c -eq '0') { break }

    switch ($c) {
      '1' {
        $setId = Pick-SetIdForKind $kind
        if ($null -eq $setId) { continue }
        $paste = Read-KeywordInput -prompt (Tf 'prompt.addKeywords' @($setId))
        if ($null -eq $paste) { continue }
        & $overridesScript add -SetId $setId -PastedText $paste | Out-Host
        Wait-AnyKeyOrEsc
      }
      '2' {
        $setId = Pick-SetIdForKind $kind
        if ($null -eq $setId) { continue }
        Show-KeywordSetHint $setId
        $items = @(Get-EffectiveKeywordSet $setId)
        Write-Host (Tf 'keywords.currentSetItems' @($setId)) -ForegroundColor Cyan
        Print-KeywordNumberedFlow $items
        if ($items.Count -eq 0) { Wait-AnyKeyOrEsc; continue }
        $sel = Read-InputOrEsc (T 'prompt.selectRemoveKeywords')
        if ($null -eq $sel -or $sel -eq '0') { continue }
        $idxs = Parse-IndexList $sel $items.Count
        if ($idxs.Count -eq 0) { Write-Host (T 'error.noValidSelection') -ForegroundColor Yellow; Wait-AnyKeyOrEsc; continue }
        $paste = Join-KeywordSelection $items $idxs
        if ([string]::IsNullOrWhiteSpace($paste)) { continue }
        & $overridesScript remove -SetId $setId -PastedText $paste | Out-Host
        Wait-AnyKeyOrEsc
      }
      '3' {
        $setId = Pick-SetIdForKind $kind
        if ($null -eq $setId) { continue }
        & $overridesScript clear -SetId $setId | Out-Host
        Wait-AnyKeyOrEsc
      }
    }
  }
}

function Configure-ModelsForKind([string]$kind) {
  $kindModelsScript = Join-Path $toolsDir 'kind-models.ps1'
  while ($true) {
    Safe-Clear
    Write-Host (("=== {0}: {1} ===" -f (T 'models.title'), (Format-KindLabel $kind))) -ForegroundColor Green
    Write-Host
    Write-Host ("1) " + (T 'models.showCurrent'))
    Write-Host ("2) " + (T 'models.add'))
    Write-Host ("3) " + (T 'models.remove'))
    Write-Host ("4) " + (T 'models.reorder'))
    Write-Host ("0) " + (T 'menu.back'))

    Write-Host ((T 'menu.tipEsc')) -ForegroundColor DarkGray
    $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(4))
    if ($null -eq $c -or $c -eq '0') { break }

    try {
      switch ($c) {
        '1' {
          $list = @(Get-KindModelList $kind)
          Write-Host (T 'models.current') -ForegroundColor Cyan
          Print-NumberedList $list
          Wait-AnyKeyOrEsc
        }
        '2' {
          $catalog = @(Get-CatalogModels)
          if ($catalog.Count -eq 0) { throw (T 'error.catalogEmpty') }
          Write-Host (T 'models.catalogAvailable') -ForegroundColor Cyan
          Print-NumberedList $catalog
          $sel = Read-InputOrEsc (T 'prompt.selectAdd')
          if ($null -eq $sel -or $sel -eq '0') { continue }
          $idxs = Parse-IndexList $sel $catalog.Count
          if ($idxs.Count -eq 0) { throw (T 'error.noValidSelection') }
          foreach ($ii in $idxs) {
            $mid = $catalog[$ii]
            try { & $kindModelsScript add -Kind $kind -ModelId $mid | Out-Null } catch { }
          }
          Write-Host (T 'models.updated') -ForegroundColor Green
          Print-NumberedList @(Get-KindModelList $kind)
          Wait-AnyKeyOrEsc
        }
        '3' {
          $list = @(Get-KindModelList $kind)
          Write-Host (T 'models.current') -ForegroundColor Cyan
          Print-NumberedList $list
          if ($list.Count -eq 0) { Wait-AnyKeyOrEsc; continue }
          $sel = Read-InputOrEsc (T 'prompt.selectRemove')
          if ($null -eq $sel -or $sel -eq '0') { continue }
          $idxs = Parse-IndexList $sel $list.Count
          if ($idxs.Count -eq 0) { throw (T 'error.noValidSelection') }
          foreach ($ii in ($idxs | Sort-Object -Descending)) {
            $mid = $list[$ii]
            & $kindModelsScript remove -Kind $kind -ModelId $mid | Out-Null
          }
          Write-Host (T 'models.updated') -ForegroundColor Green
          Print-NumberedList @(Get-KindModelList $kind)
          Wait-AnyKeyOrEsc
        }
        '4' {
          $list = @(Get-KindModelList $kind)
          Write-Host (T 'models.current') -ForegroundColor Cyan
          Print-NumberedList $list
          Reorder-Menu $kind $kindModelsScript
        }
      }
    } catch {
      Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
      Wait-AnyKeyOrEsc
    }
  }
}

function Run-NewKindSetup([string]$kind) {
  while ($true) {
    Safe-Clear
    Write-Host (("=== {0}: {1} ===" -f (T 'admin.newKindReady'), (Format-KindLabel $kind))) -ForegroundColor Green
    Write-Host (T 'admin.newKindSubtitle') -ForegroundColor DarkGray
    Write-Host
    Write-Host ("1) " + (T 'admin.setupKeywords'))
    Write-Host ("2) " + (T 'admin.setupModels'))
    Write-Host ("3) " + (T 'admin.setupPriority'))
    Write-Host ("0) " + (T 'menu.back'))
    $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(3))
    if ($null -eq $c -or $c -eq '0') { break }
    switch ($c) {
      '1' { Configure-KeywordsForKind $kind }
      '2' { Configure-ModelsForKind $kind }
      '3' {
        $kindModelsScript = Join-Path $toolsDir 'kind-models.ps1'
        Safe-Clear
        Write-Host (T 'models.current') -ForegroundColor Cyan
        Print-NumberedList @(Get-KindModelList $kind)
        Reorder-Menu $kind $kindModelsScript
      }
    }
  }
}

function Run-Keywords {
  while ($true) {
    Safe-Clear
    Write-Host (("=== {0} ===" -f (T 'keywords.title'))) -ForegroundColor Cyan
    Write-Host
    Write-Host ("1) " + (T 'keywords.list'))
    Write-Host ("2) " + (T 'keywords.add'))
    Write-Host ("3) " + (T 'keywords.remove'))
    Write-Host ("4) " + (T 'keywords.clear'))
    Write-Host ("0) " + (T 'menu.back'))
    Write-Host ((T 'menu.tipEsc')) -ForegroundColor DarkGray

    $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(4))
    if ($null -eq $c -or $c -eq '0') { break }

    switch ($c) {
      '1' {
        $kind = Pick-KindForKeywords
        if ($null -eq $kind) { continue }
        Safe-Clear
        Write-Host (("=== {0}: {1} ===" -f (T 'keywords.listTitle'), (Format-KindLabel $kind))) -ForegroundColor Cyan
        Show-KindContext $kind
        $setsAll = List-Sets
        $sets = @($setsAll | Where-Object { $_ -like "$kind.*" } | Sort-Object)
        foreach ($sid in $sets) {
          Write-Host
          Write-Host $sid -ForegroundColor Green
          $items = @(Get-EffectiveKeywordSet $sid)
          Print-KeywordFlow $items
        }
        Wait-AnyKeyOrEsc
      }
      '2' {
        $kind = Pick-KindForKeywords
        if ($null -eq $kind) { continue }
        Show-KindContext $kind
        $setId = Pick-SetIdForKind $kind
        if ($null -eq $setId) { continue }
        Show-KeywordSetHint $setId
        $paste = Read-KeywordInput -prompt (Tf 'prompt.addKeywords' @($setId))
        if ($null -eq $paste) { continue }
        & $overridesScript add -SetId $setId -PastedText $paste | Out-Host
        Wait-AnyKeyOrEsc
      }
      '3' {
        $kind = Pick-KindForKeywords
        if ($null -eq $kind) { continue }
        Show-KindContext $kind
        $setId = Pick-SetIdForKind $kind
        if ($null -eq $setId) { continue }
        Show-KeywordSetHint $setId
        $items = @(Get-EffectiveKeywordSet $setId)
        Write-Host (Tf 'keywords.currentSetItems' @($setId)) -ForegroundColor Cyan
        Print-KeywordNumberedFlow $items
        if ($items.Count -eq 0) { Wait-AnyKeyOrEsc; continue }
        $sel = Read-InputOrEsc (T 'prompt.selectRemoveKeywords')
        if ($null -eq $sel -or $sel -eq '0') { continue }
        $idxs = Parse-IndexList $sel $items.Count
        if ($idxs.Count -eq 0) { Write-Host (T 'error.noValidSelection') -ForegroundColor Yellow; Wait-AnyKeyOrEsc; continue }
        $paste = Join-KeywordSelection $items $idxs
        if ([string]::IsNullOrWhiteSpace($paste)) { continue }
        & $overridesScript remove -SetId $setId -PastedText $paste | Out-Host
        Wait-AnyKeyOrEsc
      }
      '4' {
        $kind = Pick-KindForKeywords
        if ($null -eq $kind) { continue }
        Show-KindContext $kind
        $setId = Pick-SetIdForKind $kind
        if ($null -eq $setId) { continue }
        & $overridesScript clear -SetId $setId | Out-Host
        Wait-AnyKeyOrEsc
      }
    }
  }
}

function Run-Preview {
  while ($true) {
    Safe-Clear
    Write-Host (("=== {0} ===" -f (T 'preview.title'))) -ForegroundColor Cyan
    Write-Host (T 'preview.continuousHint') -ForegroundColor DarkGray

    $text = Read-InputOrEsc (T 'preview.paste')
    if ($null -eq $text) { return }
    if ([string]::IsNullOrWhiteSpace($text)) { continue }

    $hasImage = Read-ChoiceOrEsc (T 'preview.hasImage')
    if ($null -eq $hasImage) { return }

    if ($hasImage -match '^(y|Y)') {
      & $previewScript -Text $text -HasImage | Out-Host
    } else {
      & $previewScript -Text $text | Out-Host
    }

    # Enter continues to next test; ESC goes back.
    $next = Read-LineOrEsc -prompt ((T 'preview.next') + ': ') -AllowEmpty
    if ($null -eq $next) { return }
  }
}

function Select-OnOff([string]$title, [bool]$currentValue) {
  while ($true) {
    Safe-Clear
    Write-Host (("=== {0} ===" -f $title)) -ForegroundColor Cyan
    Write-Host (("1) {0}" -f (T 'taskMode.enable')))
    Write-Host (("2) {0}" -f (T 'taskMode.disable')))
    Write-Host (("0) {0}" -f (T 'menu.back')))
    $pick = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(2))
    if ($null -eq $pick -or $pick -eq '0') { return $null }
    switch ($pick) {
      '1' { return $true }
      '2' { return $false }
      default { }
    }
  }
}

function Show-TaskModeKinds($cfg) {
  Write-Host (T 'taskMode.enabledKindsOnly') -ForegroundColor Cyan
  $enabledKinds = @($cfg.taskModeKinds | Where-Object { @($cfg.taskModeDisabledKinds) -notcontains $_ })
  if ($enabledKinds.Count -gt 0) {
    foreach ($kind in $enabledKinds) { Write-Host ("- " + (Format-KindLabel ([string]$kind))) }
  } else {
    Write-Host (T 'status.listEmpty') -ForegroundColor DarkGray
  }
  Write-Host
  Write-Host (("{0}: {1}" -f (T 'taskMode.currentDisabledKinds'), ((@($cfg.taskModeDisabledKinds) | ForEach-Object { Format-KindLabel ([string]$_) }) -join ', '))) -ForegroundColor DarkGray
}

function Run-TaskModeKindsMenu {
  while ($true) {
    $cfg = Load-RuntimeRouting
    $allKinds = @(List-Kinds)
    Safe-Clear
    Write-Host (("=== {0} ===" -f (T 'taskMode.manageMenu'))) -ForegroundColor Cyan
    Show-TaskModeKinds $cfg
    Write-Host
    Write-Host (("1) {0}" -f (T 'taskMode.primaryKind')))
    Write-Host (("2) {0}" -f (T 'taskMode.manage.addRemove')))
    Write-Host (("3) {0}" -f (T 'taskMode.manage.disable')))
    Write-Host (("4) {0}" -f (T 'taskMode.manage.enable')))
    Write-Host (("0) {0}" -f (T 'menu.back')))
    $choice = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(4))
    if ($null -eq $choice -or $choice -eq '0') { break }

    switch ($choice) {
      '1' {
        Print-NumberedList $allKinds -Kinds
        $pick = Read-ChoiceOrEsc (Tf 'prompt.chooseKind' @($allKinds.Count))
        if ($null -eq $pick -or $pick -eq '0') { continue }
        $n = 0
        if (-not [int]::TryParse($pick, [ref]$n)) { continue }
        if ($n -lt 1 -or $n -gt $allKinds.Count) { continue }
        $cfg.taskModePrimaryKind = $allKinds[$n - 1]
        if (@($cfg.taskModeKinds) -notcontains $cfg.taskModePrimaryKind) {
          $cfg.taskModeKinds = @($cfg.taskModePrimaryKind) + @($cfg.taskModeKinds)
        }
        $cfg.taskModeDisabledKinds = @(@($cfg.taskModeDisabledKinds) | Where-Object { $_ -ne [string]$cfg.taskModePrimaryKind })
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.saved') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
      '2' {
        Write-Host (T 'taskMode.manageKindsTip') -ForegroundColor DarkGray
        Print-NumberedList $allKinds -Kinds
        $sel = Read-InputOrEsc (Tf 'prompt.chooseKind' @($allKinds.Count)) -AllowEmpty
        if ($null -eq $sel -or $sel -eq '0') { continue }
        $idxs = Parse-IndexList $sel $allKinds.Count
        $set = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($item in @($cfg.taskModeKinds)) { [void]$set.Add([string]$item) }
        foreach ($ii in $idxs) {
          $kind = $allKinds[$ii]
          if ($set.Contains($kind)) {
            if ($kind -ne [string]$cfg.taskModePrimaryKind) {
              [void]$set.Remove($kind)
              $cfg.taskModeDisabledKinds = @(@($cfg.taskModeDisabledKinds) | Where-Object { $_ -ne $kind })
            }
          } else {
            [void]$set.Add($kind)
          }
        }
        [void]$set.Add([string]$cfg.taskModePrimaryKind)
        $cfg.taskModeKinds = @($set | Sort-Object)
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.kindsUpdated') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
      '3' {
        $enabledKinds = @(@($cfg.taskModeKinds) | Where-Object { $_ -ne [string]$cfg.taskModePrimaryKind -and @($cfg.taskModeDisabledKinds) -notcontains $_ })
        if ($enabledKinds.Count -le 0) { Write-Host (T 'status.listEmpty') -ForegroundColor Yellow; Wait-AnyKeyOrEsc; continue }
        Print-NumberedList $enabledKinds -Kinds
        $sel = Read-InputOrEsc (Tf 'prompt.chooseKind' @($enabledKinds.Count)) -AllowEmpty
        if ($null -eq $sel -or $sel -eq '0') { continue }
        $idxs = Parse-IndexList $sel $enabledKinds.Count
        $disabled = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($item in @($cfg.taskModeDisabledKinds)) { [void]$disabled.Add([string]$item) }
        foreach ($ii in $idxs) { [void]$disabled.Add([string]$enabledKinds[$ii]) }
        $cfg.taskModeDisabledKinds = @($disabled | Sort-Object)
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.saved') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
      '4' {
        $disabledKinds = @($cfg.taskModeDisabledKinds)
        if ($disabledKinds.Count -le 0) { Write-Host (T 'status.listEmpty') -ForegroundColor Yellow; Wait-AnyKeyOrEsc; continue }
        Print-NumberedList $disabledKinds -Kinds
        $sel = Read-InputOrEsc (Tf 'prompt.chooseKind' @($disabledKinds.Count)) -AllowEmpty
        if ($null -eq $sel -or $sel -eq '0') { continue }
        $idxs = Parse-IndexList $sel $disabledKinds.Count
        $remove = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($ii in $idxs) { [void]$remove.Add([string]$disabledKinds[$ii]) }
        $cfg.taskModeDisabledKinds = @(@($cfg.taskModeDisabledKinds) | Where-Object { -not $remove.Contains([string]$_) })
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.saved') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
    }
  }
}

function Show-TaskModePrimaryModelList($cfg) {
  $kind = [string]$cfg.taskModePrimaryKind
  Safe-Clear
  Write-Host (("=== {0}: {1} ===" -f (T 'taskMode.primaryModels'), (Format-KindLabel $kind))) -ForegroundColor Cyan
  $list = @(Get-KindModelList $kind)
  if ($list.Count -le 0) {
    Write-Host (T 'status.listEmpty') -ForegroundColor Yellow
  } else {
    Print-NumberedList $list
  }
  Wait-AnyKeyOrEsc
}

function Run-TaskModeMenu {
  while ($true) {
    $cfg = Load-RuntimeRouting
    Safe-Clear
    Write-Host (("=== {0} ===" -f (T 'taskMode.title'))) -ForegroundColor Cyan
    if ($cfg.taskModeEnabled) {
      Write-Host (T 'taskMode.status.on') -ForegroundColor Green
    } else {
      Write-Host (T 'taskMode.status.off') -ForegroundColor Yellow
    }
    Write-Host (("{0}: {1}" -f (T 'taskMode.currentPrimaryKind'), (Format-KindLabel ([string]$cfg.taskModePrimaryKind)))) -ForegroundColor DarkGray
    Write-Host (("{0}: {1}" -f (T 'taskMode.currentKinds'), ((@($cfg.taskModeKinds) | ForEach-Object { Format-KindLabel ([string]$_) }) -join ', '))) -ForegroundColor DarkGray
    Write-Host (("{0}: {1}" -f (T 'taskMode.currentDisabledKinds'), ((@($cfg.taskModeDisabledKinds) | ForEach-Object { Format-KindLabel ([string]$_) }) -join ', '))) -ForegroundColor DarkGray
    $returnLabel = if ([bool]$cfg.taskModeReturnToPrimary) { T 'taskMode.status.on' } else { T 'taskMode.status.off' }
    $downgradeLabel = if ([bool]$cfg.taskModeAllowAutoDowngrade) { T 'taskMode.status.on' } else { T 'taskMode.status.off' }
    Write-Host (("{0}: {1}" -f (T 'taskMode.currentMinConfidence'), [string]$cfg.taskModeMinConfidence)) -ForegroundColor DarkGray
    Write-Host (("{0}: {1}" -f (T 'taskMode.currentReturnToPrimary'), $returnLabel)) -ForegroundColor DarkGray
    Write-Host (("{0}: {1}" -f (T 'taskMode.currentAllowDowngrade'), $downgradeLabel)) -ForegroundColor DarkGray
    Write-Host
    Write-Host ("1) " + (T 'taskMode.toggle'))
    Write-Host ("2) " + (T 'taskMode.show'))
    Write-Host ("3) " + (T 'taskMode.kinds'))
    Write-Host ("4) " + (T 'taskMode.minConfidence'))
    Write-Host ("5) " + (T 'taskMode.primaryModels'))
    Write-Host ("6) " + (T 'taskMode.returnToPrimary'))
    Write-Host ("7) " + (T 'taskMode.allowDowngrade'))
    Write-Host ("0) " + (T 'menu.back'))
    Write-Host ((T 'menu.tipPickNumber')) -ForegroundColor DarkGray

    $choice = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(7))
    if ($null -eq $choice -or $choice -eq '0') { break }

    switch ($choice) {
      '1' {
        $picked = Select-OnOff (T 'taskMode.toggle') ([bool]$cfg.taskModeEnabled)
        if ($null -eq $picked) { continue }
        $cfg.taskModeEnabled = [bool]$picked
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.saved') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
      '2' {
        Show-TaskModeKinds $cfg
        Wait-AnyKeyOrEsc
      }
      '3' { Run-TaskModeKindsMenu }
      '4' {
        Write-Host (T 'taskMode.pickConfidence') -ForegroundColor Cyan
        Write-Host '1) low'
        Write-Host '2) medium'
        Write-Host '3) high'
        Write-Host ("0) " + (T 'menu.back'))
        $pick = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(3))
        if ($null -eq $pick -or $pick -eq '0') { continue }
        switch ($pick) {
          '1' { $cfg.taskModeMinConfidence = 'low' }
          '2' { $cfg.taskModeMinConfidence = 'medium' }
          '3' { $cfg.taskModeMinConfidence = 'high' }
          default { continue }
        }
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.saved') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
      '5' { Show-TaskModePrimaryModelList $cfg }
      '6' {
        $picked = Select-OnOff (T 'taskMode.returnToPrimary') ([bool]$cfg.taskModeReturnToPrimary)
        if ($null -eq $picked) { continue }
        $cfg.taskModeReturnToPrimary = [bool]$picked
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.saved') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
      '7' {
        $picked = Select-OnOff (T 'taskMode.allowDowngrade') ([bool]$cfg.taskModeAllowAutoDowngrade)
        if ($null -eq $picked) { continue }
        $cfg.taskModeAllowAutoDowngrade = [bool]$picked
        Save-RuntimeRouting $cfg
        Write-Host (T 'taskMode.saved') -ForegroundColor Green
        Wait-AnyKeyOrEsc
      }
    }
  }
}

function Run-LanguageMenu {
  while ($true) {
    Safe-Clear
    Write-Host (("=== {0} ===" -f (T 'language.title'))) -ForegroundColor Cyan
    Write-Host ("1) " + (T 'language.zh'))
    Write-Host ("2) " + (T 'language.en'))
    Write-Host ("3) " + (T 'language.both'))
    Write-Host ("0) " + (T 'menu.back'))
    $choice = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(3))
    if ($null -eq $choice -or $choice -eq '0') { break }
    switch ($choice) {
      '1' { Set-LanguageMode 'zh'; Write-Host (T 'language.saved') -ForegroundColor Green; Wait-AnyKeyOrEsc }
      '2' { Set-LanguageMode 'en'; Write-Host (T 'language.saved') -ForegroundColor Green; Wait-AnyKeyOrEsc }
      '3' { Set-LanguageMode 'both'; Write-Host (T 'language.saved') -ForegroundColor Green; Wait-AnyKeyOrEsc }
    }
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
  Safe-Clear
  Write-Host (T 'menu.title') -ForegroundColor Green
  Write-Host ((T 'menu.subtitle')) -ForegroundColor DarkGray
  Write-Host
  Write-Host ("1) " + (T 'menu.catalog'))
  Write-Host ("2) " + (T 'menu.kindAdmin'))
  Write-Host ("3) " + (T 'menu.currentModels'))
  Write-Host ("4) " + (T 'menu.kindModels'))
  Write-Host ("5) " + (T 'menu.keywords'))
  Write-Host ("6) " + (T 'menu.preview'))
  Write-Host ("7) " + (T 'menu.taskMode'))
  Write-Host ("8) " + (T 'menu.language'))
  Write-Host ("0) " + (T 'menu.exit'))

  Write-Host ((T 'menu.tipEsc')) -ForegroundColor DarkGray
  $choice = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(8))
  if ($null -eq $choice) { continue }
  try {
    switch ($choice) {
      '1' { Run-Catalog }
      '2' {
        $admin = Join-Path $toolsDir 'kind-admin.ps1'

        function Get-AdminKinds {
          return @(List-Kinds)
        }

        function Pick-KindByNumber([string]$title) {
          $kinds = @(Get-AdminKinds)
          if ($kinds.Count -eq 0) { return $null }
          Write-Host ""
          Write-Host $title -ForegroundColor Cyan
          Print-NumberedList $kinds -Kinds
          Write-Host ("0) " + (T 'menu.cancel'))
          $pick = Read-ChoiceOrEsc (Tf 'prompt.chooseKind' @($kinds.Count))
          if ($null -eq $pick -or $pick -eq '0') { return $null }
          $n = 0
          if (-not [int]::TryParse($pick, [ref]$n)) { return $null }
          if ($n -lt 1 -or $n -gt $kinds.Count) { return $null }
          return $kinds[$n - 1]
        }

        while ($true) {
          Safe-Clear
          Write-Host (T 'admin.title') -ForegroundColor Cyan
          Write-Host ("1) " + (T 'admin.list'))
          Write-Host ("2) " + (T 'admin.add'))
          Write-Host ("3) " + (T 'admin.delete'))
          Write-Host ("4) " + (T 'admin.disable'))
          Write-Host ("5) " + (T 'admin.enable'))
          Write-Host ((T 'admin.deleteHint')) -ForegroundColor DarkGray
          Write-Host ("0) " + (T 'menu.back'))
          Write-Host ((T 'menu.tipPickNumber')) -ForegroundColor DarkGray

          $c = Read-ChoiceOrEsc (Tf 'prompt.chooseMenu' @(5))
          if ($null -eq $c -or $c -eq '0') { break }

          switch ($c) {
            '1' {
              $kinds = @(Get-AdminKinds)
              Write-Host (T 'prompt.currentKinds') -ForegroundColor Cyan
              Print-NumberedList $kinds -Kinds
              Wait-AnyKeyOrEsc
            }
            '2' {
              $addKind = Join-Path $toolsDir 'add-kind.ps1'
              Write-Host (T 'addKind.format') -ForegroundColor DarkGray
              $kid = Read-ChoiceOrEsc (T 'addKind.enter')
              if ($null -ne $kid -and $kid -ne '') {
                & $addKind -Kind $kid | Out-Host
                Run-NewKindSetup $kid
              }
            }
            '3' {
              $k = Pick-KindByNumber (T 'admin.deleteWhich')
              if ($null -eq $k) { break }
              Write-Host (("{0} {1}" -f (T 'admin.confirmDelete'), (Format-KindLabel $k))) -ForegroundColor Yellow
              Write-Host (T 'admin.typeDelete') -ForegroundColor Yellow
              $confirm = Read-ChoiceOrEsc (T 'prompt.confirm')
              if ($confirm -ne 'DELETE') { Write-Host (T 'admin.canceled') -ForegroundColor DarkGray; Wait-AnyKeyOrEsc; break }
              & $admin delete -Kind $k -Force | Out-Host
              Wait-AnyKeyOrEsc
            }
            '4' {
              $k = Pick-KindByNumber (T 'admin.disableWhich')
              if ($null -eq $k) { break }
              & $admin disable -Kind $k | Out-Host
              Wait-AnyKeyOrEsc
            }
            '5' {
              $k = Pick-KindByNumber (T 'admin.enableWhich')
              if ($null -eq $k) { break }
              & $admin enable -Kind $k | Out-Host
              Wait-AnyKeyOrEsc
            }
          }
        }
      }
      '3' { Show-CurrentKindModels; Wait-AnyKeyOrEsc }
      '4' { Run-Models }
      '5' { Run-Keywords }
      '6' { Run-Preview }
      '7' { Run-TaskModeMenu }
      '8' { Run-LanguageMenu }
      '0' { exit 0 }
      default { Write-Host (T 'menu.invalidChoice') -ForegroundColor Yellow; Wait-AnyKeyOrEsc }
    }
  } catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    Wait-AnyKeyOrEsc
  }
}
