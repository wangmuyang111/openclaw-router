param(
  # Optional: override which commit is considered baseline.
  [string]$BaselineCommit = "",
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

Push-Location $repoRoot
try {
  if ([string]::IsNullOrWhiteSpace($BaselineCommit)) {
    # If present, use pinned baseline file.
    $pinned = Join-Path $PSScriptRoot 'baseline.commit'
    if (Test-Path $pinned) {
      $BaselineCommit = (Get-Content $pinned -Raw -Encoding UTF8).Trim()
    } else {
      # Default: current HEAD.
      $BaselineCommit = (git rev-parse HEAD).Trim()
    }
  }

  $files = @(
    'tools/soft-router-suggest/keyword-library.json',
    'tools/soft-router-suggest/keyword-overrides.user.json',
    'tools/soft-router-suggest/model-catalog.cache.json'
  )

  Write-Host "Baseline commit: $BaselineCommit" -ForegroundColor Cyan
  Write-Host "Will reset these files to baseline (if they exist in git):" -ForegroundColor Cyan
  $files | ForEach-Object { Write-Host "- $_" }
  Write-Host

  if (-not $Force) {
    Write-Host "This will DISCARD local edits for tracked files." -ForegroundColor Yellow
    $c = Read-Host "Type RESET to continue (or Ctrl+C to cancel)"
    if ($c -ne 'RESET') { throw 'Canceled.' }
  }

  foreach ($f in $files) {
    # Only checkout if the file exists in the baseline tree.
    $exists = (git cat-file -e "$BaselineCommit:$f" 2>$null; $LASTEXITCODE -eq 0)
    if ($exists) {
      git checkout $BaselineCommit -- $f | Out-Null
      Write-Host "Reset: $f" -ForegroundColor Green
    } else {
      Write-Host "Skip (not in baseline): $f" -ForegroundColor DarkGray
    }
  }

  Write-Host
  Write-Host "Done." -ForegroundColor Green
} finally {
  Pop-Location
}
