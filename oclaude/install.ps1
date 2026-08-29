# install.ps1 — Wire oclaude into PowerShell by dot-sourcing oclaude.ps1 into $PROFILE.
# Run from the oclaude/ directory:  powershell -ExecutionPolicy Bypass -File .\install.ps1

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$profile   = $PROFILE
$dotSource = ". `"$scriptDir\oclaude.ps1`""

if (Test-Path $profile) {
    $profileContent = Get-Content $profile -Raw
} else {
    $profileContent = ''
}

if ($profileContent -match 'oclaude/oclaude\.ps1') {
    Write-Host "ok      oclaude already in $profile" -ForegroundColor Green
} else {
    Add-Content $profile ""
    Add-Content $profile "# oclaude -- Claude Code on local Ollama models"
    Add-Content $profile $dotSource
    Write-Host "linked  oclaude dot-source -> $profile" -ForegroundColor Green
}

Write-Host ""
Write-Host "Open a new PowerShell session and run 'oclaude-help' to verify." -ForegroundColor Cyan
