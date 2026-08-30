# oclaude -- run Claude Code against local Ollama models.
# Ollama >= 0.32 serves /v1/messages natively, so ANTHROPIC_BASE_URL points at the daemon.
# The reasoning behind the choices in here is written up in README.md.
#
# This file loads lib/ and nothing else. Edit the model map in lib/config.ps1.
#
#   config   model map, tiers, derived tags, every tunable
#   daemon   probe, start and restart ollama
#   models   the model store, and building the derived tags
#   session  oclaude itself
#   report   oclaude-status, oclaude-help

# The pwsh profile dot-sources this file, so it runs in the global scope. The
# dot-sources below inherit that scope, which is where the shell looks for functions.
$oclaudeParts = 'config', 'daemon', 'models', 'session', 'report' |
    ForEach-Object { Join-Path (Join-Path $PSScriptRoot 'lib') "$_.ps1" }

# An explicit list, not a glob: a renamed part fails here instead of at the call site.
# Order does not matter. PowerShell resolves a function name when you call it.
foreach ($part in $oclaudeParts) {
    if (-not (Test-Path $part)) { throw "oclaude: cannot load $part" }
    . $part
}

# An open shell keeps the functions it loaded at startup. Record which files loaded and
# when, so entry points can warn instead of running stale code. The timestamps must be
# read HERE rather than lazily on first use: taken later they would describe the file as
# it is by then, not as this shell loaded it, and an edit made before the first call
# would read as current. Measured at ~0.8 ms for the six files, which the profile pays.
$global:OClaudeFiles  = @(@($PSCommandPath) + $oclaudeParts | Where-Object { $_ })
$global:OClaudeLoaded = ($global:OClaudeFiles |
    ForEach-Object { (Get-Item $_).LastWriteTimeUtc } | Measure-Object -Maximum).Maximum

function Test-OClaudeStale {
    # $true (and warns once per edit) when any loaded file is newer on disk than what
    # this shell loaded. Entry points call each other, hence the warned-at latch.
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
