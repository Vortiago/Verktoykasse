# oclaude -- run Claude Code against local Ollama models.
# Ollama >= 0.32 serves /v1/messages natively, so ANTHROPIC_BASE_URL points at the daemon.
# README.md explains the reasoning behind these choices.
#
# This file loads lib/ and nothing else. Edit the model map in
# ~/.config/oclaude/config.ps1, which oclaude-init-config creates for you.
# lib/config.ps1 holds the committed defaults that file overrides.
#
#   config   the DEFAULT model map, tiers, derived tags, every tunable
#   machine  the per-machine override file, and where it lives
#   daemon   probe, start and restart ollama
#   models   the model store, and building the derived tags
#   session  oclaude itself
#   report   oclaude-status, oclaude-help

# The pwsh profile dot-sources this file, so it runs in the global scope. The
# dot-sources below inherit that scope, where the shell looks for functions.
# Read the root here, not from $PSScriptRoot inside a function. That automatic variable
# is easy to get wrong in a function dot-sourced into the global scope.
$global:OClaudeRoot = $PSScriptRoot

$oclaudeParts = 'config', 'machine', 'daemon', 'models', 'session', 'report' |
    ForEach-Object { Join-Path (Join-Path $PSScriptRoot 'lib') "$_.ps1" }

# An explicit list, not a glob: a renamed part fails here, not at the call site.
# Order does not matter. PowerShell resolves a function name when you call it.
foreach ($part in $oclaudeParts) {
    if (-not (Test-Path $part)) { throw "oclaude: cannot load $part" }
    . $part
}

# An open shell keeps the functions it loaded at startup, so record what loaded and
# when. Read the timestamps HERE, not lazily on first use. Taken later they describe the
# file as it is by then, not as this shell loaded it, so an edit made before the first
# call would read as current. Roughly 0.8 ms, paid on every new shell.
$global:OClaudeFiles  = @(@($PSCommandPath) + $oclaudeParts | Where-Object { $_ })
$global:OClaudeLoaded = ($global:OClaudeFiles |
    ForEach-Object { (Get-Item $_).LastWriteTimeUtc } | Measure-Object -Maximum).Maximum

function Test-OClaudeStale {
    # $true (and warns once per edit) when any loaded file is newer on disk than what
    # this shell loaded. The latch keeps one edit to one warning across a shell's whole
    # life, rather than one per command until you reload.
    if (-not $global:OClaudeFiles -or -not $global:OClaudeLoaded) { return $false }
    $changed = @($global:OClaudeFiles | Where-Object { Test-Path $_ } |
        ForEach-Object { Get-Item $_ } |
        Where-Object { $_.LastWriteTimeUtc -gt $global:OClaudeLoaded })
    if (-not $changed) { return $false }

    $newest = @($changed | Sort-Object LastWriteTimeUtc -Descending)[0]
    if ($global:OClaudeStaleWarnedAt -ne $newest.LastWriteTimeUtc) {
        $global:OClaudeStaleWarnedAt = $newest.LastWriteTimeUtc
        Write-Host ''
        Write-Host ('  stale: this shell loaded oclaude at {0}, but {1} changed at {2}.' -f
                    $global:OClaudeLoaded.ToLocalTime().ToString('HH:mm'),
                    $newest.Name,
                    $newest.LastWriteTimeUtc.ToLocalTime().ToString('HH:mm')) -ForegroundColor Yellow
        Write-Host '         run  . $PROFILE  (or open a new tab) to pick the change up.' -ForegroundColor Yellow
        Write-Host ''
    }
    return $true
}
