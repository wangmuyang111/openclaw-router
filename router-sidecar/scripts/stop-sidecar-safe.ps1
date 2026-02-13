param(
  [string]$HostAddr = '127.0.0.1',
  [int]$Port = 18888
)

# Stop router-sidecar by killing the process bound to HostAddr:Port.
# This avoids killing unrelated node processes.

$target = "$HostAddr`:$Port"

function Get-PidsListeningOn {
  param([string]$AddrPort)
  $lines = netstat -ano | Select-String -Pattern ("^\s*TCP\s+" + [regex]::Escape($AddrPort) + "\s+")
  $pids = @()
  foreach ($l in $lines) {
    $parts = ($l -split '\s+')
    if ($parts.Length -ge 5) {
      $p = $parts[$parts.Length - 1]
      if ($p -match '^\d+$') { $pids += [int]$p }
    }
  }
  $pids | Select-Object -Unique
}

$pids = Get-PidsListeningOn -AddrPort $target
if (!$pids -or $pids.Count -eq 0) {
  Write-Host "[router-sidecar] no listener found on $target (already stopped)"
  exit 0
}

Write-Host "[router-sidecar] stopping listener(s) on ${target}: PID(s) = $($pids -join ', ')"
foreach ($p in $pids) {
  try {
    Stop-Process -Id $p -Force -ErrorAction Stop
  } catch {
    Write-Warning "[router-sidecar] failed to stop PID ${p}: $($_.Exception.Message)"
  }
}

Start-Sleep -Milliseconds 300
$pids2 = Get-PidsListeningOn -AddrPort $target
if ($pids2 -and $pids2.Count -gt 0) {
  Write-Warning "[router-sidecar] still listening on $target after stop attempt: PID(s) = $($pids2 -join ', ')"
  exit 1
}

Write-Host "[router-sidecar] stopped: $target"
exit 0
