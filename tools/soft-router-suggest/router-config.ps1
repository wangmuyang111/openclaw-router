param(
  [Parameter(Mandatory=$false, Position=0)]
  [ValidateSet('interactive','list','add-category','remove-category','enable-category','disable-category','set-priority','set-models','add-model','remove-model','validate','apply')]
  [string]$Command = 'interactive',

  [string]$Id,
  [string]$Name,
  [int]$Priority,
  [string]$Model,
  [string]$Models,
  [string]$PositiveKeywords,
  [string]$NegativeKeywords,
  [string]$ConfigPath = ""
)

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $ConfigPath = Join-Path $PSScriptRoot 'classification-rules.json'
}

function Load-Config {
  if (!(Test-Path $ConfigPath)) { throw "Config not found: $ConfigPath" }
  return Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Save-Config($cfg) {
  $json = $cfg | ConvertTo-Json -Depth 20
  Set-Content -Path $ConfigPath -Value $json -Encoding UTF8
}

function Split-List($s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return @() }
  return $s.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
}

try {
  $cfg = Load-Config

  if ($Command -eq 'interactive') {
    Write-Output '=== Soft Router Config Menu ==='
    Write-Output '1) list            - list categories (CN: cha kan fen lei lie biao)'
    Write-Output '2) add-category    - add category (CN: xin zeng fen lei)'
    Write-Output '3) remove-category - remove category (CN: shan chu fen lei)'
    Write-Output '4) enable-category - enable category (CN: qi yong fen lei)'
    Write-Output '5) disable-category- disable category (CN: jin yong fen lei)'
    Write-Output '6) set-priority    - set category priority (CN: she zhi you xian ji)'
    Write-Output '7) set-models      - replace model list (CN: fu gai mo xing lie biao)'
    Write-Output '8) add-model       - append one model (CN: zhui jia mo xing)'
    Write-Output '9) remove-model    - remove one model (CN: yi chu mo xing)'
    Write-Output '10) validate       - validate config (CN: jiao yan pei zhi)'
    Write-Output '11) apply          - validate + restart gateway (CN: ying yong)'
    $choice = Read-Host 'Choose operation (1-11)'
    switch ($choice) {
      '1' { $Command = 'list' }
      '2' {
        $Command = 'add-category'
        $Id = Read-Host 'Category id'
        $Name = Read-Host 'Category name'
        $prioInput = Read-Host 'Priority (e.g. 50, default 50)'
        if ([string]::IsNullOrWhiteSpace($prioInput)) { $Priority = 50 } else { $Priority = [int]$prioInput }

        do {
          $Models = Read-Host 'Models CSV (required, provider/model,...)'
          if ([string]::IsNullOrWhiteSpace($Models)) {
            Write-Host 'Models is required. Example: openai-codex/gpt-5.3-codex,openai-codex/gpt-5.2' -ForegroundColor Yellow
          }
        } while ([string]::IsNullOrWhiteSpace($Models))

        $PositiveKeywords = Read-Host 'Positive keywords CSV (optional)'
        $NegativeKeywords = Read-Host 'Negative keywords CSV (optional)'
      }
      '3' { $Command = 'remove-category'; $Id = Read-Host 'Category id' }
      '4' { $Command = 'enable-category'; $Id = Read-Host 'Category id' }
      '5' { $Command = 'disable-category'; $Id = Read-Host 'Category id' }
      '6' {
        $Command = 'set-priority'
        $Id = Read-Host 'Category id'
        $Priority = [int](Read-Host 'New priority')
      }
      '7' {
        $Command = 'set-models'
        $Id = Read-Host 'Category id'
        $Models = Read-Host 'New models CSV (ordered)'
      }
      '8' {
        $Command = 'add-model'
        $Id = Read-Host 'Category id'
        $Model = Read-Host 'Model (provider/model)'
      }
      '9' {
        $Command = 'remove-model'
        $Id = Read-Host 'Category id'
        $Model = Read-Host 'Model (provider/model)'
      }
      '10' { $Command = 'validate' }
      '11' { $Command = 'apply' }
      default { throw 'Invalid menu choice' }
    }
  }

  switch ($Command) {
    'list' {
      $cfg.categories | Sort-Object priority -Descending | ForEach-Object {
        $enabled = if ($_.enabled) { 'on' } else { 'off' }
        Write-Output ("{0,-18} prio={1,-3} {2,-3} models={3}" -f $_.id, $_.priority, $enabled, ($_.models.Count))
      }
    }

    'add-category' {
      if (-not $Id) { throw "--Id is required" }
      if ($Id -notmatch '^[a-z][a-z0-9_]*$') { throw "--Id format invalid. Use snake_case like: data_analysis" }
      if (-not $Name) { throw "--Name is required" }
      if (($cfg.categories | Where-Object { $_.id -eq $Id })) { throw "Category already exists: $Id" }
      if (-not $Models) { throw "--Models is required (comma-separated)" }

      $cat = [ordered]@{
        id = $Id
        name = $Name
        priority = $(if ($Priority) { $Priority } else { 50 })
        enabled = $true
        rules = [ordered]@{
          positiveKeywords = @(Split-List $PositiveKeywords)
          negativeKeywords = @(Split-List $NegativeKeywords)
        }
        confidence = [ordered]@{ minSignals = 1; highSignals = 2 }
        models = @(Split-List $Models)
      }
      $cfg.categories += $cat
      Save-Config $cfg
      Write-Output "Added category: $Id"
    }

    'remove-category' {
      if (-not $Id) { throw "--Id is required" }
      $before = @($cfg.categories).Count
      $cfg.categories = @($cfg.categories | Where-Object { $_.id -ne $Id })
      if (@($cfg.categories).Count -eq $before) { throw "Category not found: $Id" }
      Save-Config $cfg
      Write-Output "Removed category: $Id"
    }

    'enable-category' {
      if (-not $Id) { throw "--Id is required" }
      $cat = $cfg.categories | Where-Object { $_.id -eq $Id } | Select-Object -First 1
      if (-not $cat) { throw "Category not found: $Id" }
      $cat.enabled = $true
      Save-Config $cfg
      Write-Output "Enabled: $Id"
    }

    'disable-category' {
      if (-not $Id) { throw "--Id is required" }
      $cat = $cfg.categories | Where-Object { $_.id -eq $Id } | Select-Object -First 1
      if (-not $cat) { throw "Category not found: $Id" }
      $cat.enabled = $false
      Save-Config $cfg
      Write-Output "Disabled: $Id"
    }

    'set-priority' {
      if (-not $Id) { throw "--Id is required" }
      if ($PSBoundParameters.ContainsKey('Priority') -eq $false) { throw "--Priority is required" }
      $cat = $cfg.categories | Where-Object { $_.id -eq $Id } | Select-Object -First 1
      if (-not $cat) { throw "Category not found: $Id" }
      $cat.priority = $Priority
      Save-Config $cfg
      Write-Output "Priority updated: $Id => $Priority"
    }

    'set-models' {
      if (-not $Id) { throw "--Id is required" }
      if (-not $Models) { throw "--Models is required (comma-separated)" }
      $cat = $cfg.categories | Where-Object { $_.id -eq $Id } | Select-Object -First 1
      if (-not $cat) { throw "Category not found: $Id" }
      $cat.models = @(Split-List $Models)
      Save-Config $cfg
      Write-Output "Models replaced for: $Id"
    }

    'add-model' {
      if (-not $Id) { throw "--Id is required" }
      if (-not $Model) { throw "--Model is required" }
      $cat = $cfg.categories | Where-Object { $_.id -eq $Id } | Select-Object -First 1
      if (-not $cat) { throw "Category not found: $Id" }
      $arr = @($cat.models)
      if ($arr -contains $Model) { throw "Model already exists in ${Id}: $Model" }
      $cat.models = @($arr + $Model)
      Save-Config $cfg
      Write-Output "Model added: $Model -> $Id"
    }

    'remove-model' {
      if (-not $Id) { throw "--Id is required" }
      if (-not $Model) { throw "--Model is required" }
      $cat = $cfg.categories | Where-Object { $_.id -eq $Id } | Select-Object -First 1
      if (-not $cat) { throw "Category not found: $Id" }
      $before = @($cat.models).Count
      $cat.models = @($cat.models | Where-Object { $_ -ne $Model })
      if (@($cat.models).Count -eq $before) { throw "Model not found in ${Id}: $Model" }
      Save-Config $cfg
      Write-Output "Model removed: $Model <- $Id"
    }

    'validate' {
      $validator = Join-Path $PSScriptRoot 'validate-classification.ps1'
      & powershell -ExecutionPolicy Bypass -File $validator -ConfigPath $ConfigPath
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    'apply' {
      $validator = Join-Path $PSScriptRoot 'validate-classification.ps1'
      & powershell -ExecutionPolicy Bypass -File $validator -ConfigPath $ConfigPath
      if ($LASTEXITCODE -ne 0) { throw "Validation failed; not applying" }
      & openclaw gateway restart
      Write-Output "Applied: config validated + gateway restarted"
    }
  }
}
catch {
  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
