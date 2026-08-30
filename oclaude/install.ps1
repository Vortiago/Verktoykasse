# install.ps1 -- wire oclaude into PowerShell by dot-sourcing oclaude.ps1 into $PROFILE.
#
#   pwsh -ExecutionPolicy Bypass -File .\install.ps1
#
# Run it with the SAME PowerShell you use day to day. Windows PowerShell 5.1
# (powershell.exe) and PowerShell 7 (pwsh.exe) keep separate profiles, under
# Documents\WindowsPowerShell\ and Documents\PowerShell\ respectively, so
# installing from one leaves the other without oclaude.
#
# No files are copied. The profile points at oclaude.ps1 where it sits in the repo,
# so a `git pull` updates the launcher with no reinstall.

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$entry     = Join-Path $scriptDir 'oclaude.ps1'
$dotSource = ". `"$entry`""

if (-not (Test-Path $entry)) { throw "oclaude: cannot find $entry" }

$edition = if ($PSVersionTable.PSEdition -eq 'Core') { "PowerShell $($PSVersionTable.PSVersion)" }
           else { "Windows PowerShell $($PSVersionTable.PSVersion)" }
Write-Host "profile $PROFILE" -ForegroundColor DarkGray
Write-Host "        ($edition)" -ForegroundColor DarkGray

# Installing from 5.1 while pwsh is on the box is the likely mistake, so say it here
# rather than let `oclaude-help` come back "not recognised" in the shell they actually use.
if ($PSVersionTable.PSEdition -ne 'Core' -and (Get-Command pwsh -ErrorAction SilentlyContinue)) {
    Write-Host ''
    Write-Host 'note: pwsh (PowerShell 7) is installed and keeps a different profile.' -ForegroundColor DarkYellow
    Write-Host '      If you use pwsh, re-run this with:  pwsh -File .\install.ps1' -ForegroundColor DarkYellow
}

# A profile on a fresh machine has no directory yet, and Add-Content will not create one.
$profileDir = Split-Path -Parent $PROFILE
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    Write-Host "created $profileDir" -ForegroundColor DarkGray
}

$existing = if (Test-Path $PROFILE) { Get-Content $PROFILE -Raw } else { '' }

# Read the profile's oclaude dot-sources once, then answer both questions from that
# one list. Asking the text twice let the two answers disagree: a bare substring
# search also matches the path inside a comment, so a commented-out line counted as
# installed while the stale check, which needs a real dot-source line, ignored it.
$sourced = @(
    [regex]::Matches($existing, '(?m)^\s*\.\s+"?([^"\r\n]*oclaude\.ps1)"?\s*$') |
        ForEach-Object { $_.Groups[1].Value }
)

# A dot-source from some OTHER checkout still defines the same function names, and
# the later one silently wins. Name it instead of quietly adding a second.
$stale = @($sourced | Where-Object { $_ -ne $entry })

if ($sourced -contains $entry) {
    Write-Host "ok      oclaude already in $PROFILE" -ForegroundColor Green
} else {
    Add-Content $PROFILE ''
    Add-Content $PROFILE '# oclaude -- Claude Code on local Ollama models'
    Add-Content $PROFILE $dotSource
    Write-Host "linked  oclaude -> $PROFILE" -ForegroundColor Green
}

if ($stale) {
    Write-Host ''
    Write-Host 'warn: the profile also dot-sources oclaude from elsewhere:' -ForegroundColor DarkYellow
    $stale | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkYellow }
    Write-Host '      Both define the same functions and the last one loaded wins.' -ForegroundColor DarkYellow
    Write-Host '      Remove the old line from your profile.' -ForegroundColor DarkYellow
}

Write-Host ''
Write-Host "Open a new PowerShell session, then run 'oclaude-help' to verify." -ForegroundColor Cyan
