#requires -Version 5.1
<#!
Global-friendly wrapper for router.ps1
Usage:
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 status
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 fast
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 rules
  powershell -ExecutionPolicy Bypass -File .\scripts\openclaw-router.ps1 llm
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'router.ps1') @args
exit $LASTEXITCODE
