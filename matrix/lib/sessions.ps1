# Live Claude Code sessions and their status. Needs ConvertTo-CellText from console.ps1.
#
# Source of truth is ~/.claude/sessions/<pid>.json, the registry Claude Code itself
# reads for peer discovery. Fields used here:
#
#   status       busy | waiting | idle           the three states we colour by
#   waitingFor   reason, only set on waiting      "input needed", "sandbox request", ...
#   procStart    FILETIME of the process start    guards against PID reuse
#
# The file also names a peer pipe carrying notify_idle, but a subscriber that is not
# itself a registered session is rejected, so status is read from the files. See
# README.md.

$script:ClaudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR }
                     else { Join-Path $env:USERPROFILE '.claude' }

# status -> how the lane looks. Green flows, red crawls.
$script:SessionStyle = [ordered]@{
    busy    = @{ Label = 'working';   Rgb = @( 40, 255,  90); Speed = 1.70; Density = 0.55 }
    idle    = @{ Label = 'idle';      Rgb = @(255, 176,  32); Speed = 0.45; Density = 0.20 }
    waiting = @{ Label = 'needs you'; Rgb = @(255,  60,  60); Speed = 0.22; Density = 0.14 }
    gone    = @{ Label = 'ended';     Rgb = @(120, 120, 130); Speed = 0.15; Density = 0.06 }
}

function Get-SessionStyle {
    param([string] $Status)
    $s = $script:SessionStyle[$Status]
    if ($s) { $s } else { $script:SessionStyle['gone'] }
}

function Test-SessionAlive {
    # PID alive, and started when the file says. A recycled PID fails the second test.
    # GetProcessById, not Get-Process: the cmdlet enumerates every process and wraps each
    # one in a PSObject, for a lookup that runs per session per poll.
    param([int] $ProcessId, [string] $ProcStart)
    try { $p = [System.Diagnostics.Process]::GetProcessById($ProcessId) } catch { return $false }
    # Dispose: StartTime opens a kernel handle, and this runs per session per poll
    try {
        if (-not $ProcStart) { return $true }
        try { $ft = $p.StartTime.ToFileTimeUtc() } catch { return $true }   # no rights to read it
        # 2 s of slop: the file holds the value Claude read, not our conversion of it.
        # An unreadable procStart cannot verify anything: keep the session, same as
        # having no rights - the cast must not kill the poll under EAP=Stop.
        try { return [Math]::Abs($ft - [int64]$ProcStart) -lt 20000000 } catch { return $true }
    } finally { $p.Dispose() }
}

function Get-ClaudeSession {
    <#
    .SYNOPSIS
        Every live interactive Claude Code session, with its current status.
    #>
    [CmdletBinding()]
    param([switch] $IncludeBackground)

    $dir = Join-Path $script:ClaudeHome 'sessions'
    if (-not [System.IO.Directory]::Exists($dir)) { return @() }

    # *.json only. The sibling *.key files hold peer credentials and are never read.
    # ReadAllText, not Get-Content -Raw: the provider and pipeline cost 7x for a file
    # this small, per session per poll.
    $out = foreach ($f in [System.IO.Directory]::EnumerateFiles($dir, '*.json')) {
        try { $r = ConvertFrom-Json ([System.IO.File]::ReadAllText($f)) } catch { continue }
        if (-not $r.pid -or -not $r.sessionId) { continue }
        if (-not $IncludeBackground -and $r.kind -ne 'interactive') { continue }
        # The try covers the casts too: one malformed field (a pid or timestamp that
        # does not cast) skips the record exactly as unreadable JSON does, instead of
        # killing the whole rain under the script's ErrorActionPreference = Stop.
        try {
            if (-not (Test-SessionAlive -ProcessId $r.pid -ProcStart $r.procStart)) { continue }

            $status = if ($r.status) { [string]$r.status } else { 'idle' }
            [pscustomobject]@{
                Pid        = [int]$r.pid
                SessionId  = [string]$r.sessionId
                Name       = if ($r.name) { [string]$r.name } else { "claude-$($r.pid)" }
                NameSource = if ($r.nameSource) { [string]$r.nameSource } else { 'user' }
                Cwd        = if ($r.cwd)  { [string]$r.cwd }  else { '?' }
                Status     = $status
                WaitingFor = if ($r.waitingFor) { [string]$r.waitingFor } else { '' }
                StartedAt  = [int64]$r.startedAt
                UpdatedAt  = [int64]$r.statusUpdatedAt
                Style      = Get-SessionStyle $status
            }
        } catch { continue }
    }

    @($out) | Sort-Object StartedAt
}

# <system-reminder> and friends are harness plumbing, not the prompt.
function Remove-HarnessTag {
    param([string] $Text)
    $Text -replace '(?s)<([a-z][a-z0-9_-]*)>.*?</\1>', ' ' -replace '</?[a-z][a-z0-9_-]*>', ' '
}

# sessionId -> transcript path, built in one walk of ~/.claude/projects. A session that
# starts while the rain runs is not in the index, so a miss rebuilds it, at most every
# 10 s: without that throttle a session with no transcript yet rebuilds on every poll.
$script:TranscriptIndex = $null
$script:IndexBuiltAt    = [datetime]::MinValue

function Update-TranscriptIndex {
    $root = Join-Path $script:ClaudeHome 'projects'
    $script:TranscriptIndex = @{}
    $script:IndexBuiltAt    = [datetime]::UtcNow
    if (-not [System.IO.Directory]::Exists($root)) { return }
    # The walk must not kill the poll: an ACL'd subfolder, a junction, or a project
    # folder deleted mid-walk throws out of the lazy enumeration, and this runs
    # outside every caller's try. Whatever was indexed before the throw is kept;
    # the 10 s rebuild throttle picks up the rest.
    try {
        foreach ($f in [System.IO.Directory]::EnumerateFiles($root, '*.jsonl', 'AllDirectories')) {
            $id  = [System.IO.Path]::GetFileNameWithoutExtension($f)
            $old = $script:TranscriptIndex[$id]
            # a session id can appear under two project folders; the newest file wins
            if (-not $old -or
                [System.IO.File]::GetLastWriteTimeUtc($f) -gt [System.IO.File]::GetLastWriteTimeUtc($old)) {
                $script:TranscriptIndex[$id] = $f
            }
        }
    } catch { }
}

function Get-SessionTranscript {
    # The project folder is the cwd with every character outside [A-Za-z0-9-] replaced,
    # so the index is keyed on the file name rather than a rebuilt slug.
    param([string] $SessionId)
    if ($null -eq $script:TranscriptIndex) { Update-TranscriptIndex }
    $hit = $script:TranscriptIndex[$SessionId]
    if (-not $hit -and ([datetime]::UtcNow - $script:IndexBuiltAt).TotalSeconds -ge 10) {
        Update-TranscriptIndex
        $hit = $script:TranscriptIndex[$SessionId]
    }
    $hit
}

# Branch and opening prompt per session. Neither moves while the rain runs, so the
# transcript is opened once for both.
$script:SessionFact = @{}

function Get-SessionFact {
    <#
    .SYNOPSIS
        The branch and the opening prompt of a session, for its header.
    .DESCRIPTION
        One open of the transcript for both: the head holds the first user turn, and
        the tail holds the newest record, whose gitBranch is the current one. Read once
        per session, so a branch changed mid-session leaves the header stale until the
        rain restarts.

        Only a hit is cached. A session that starts while the rain runs has no
        transcript yet, and caching that miss would blank its header for the whole run.
    #>
    param([Parameter(Mandatory)] $Session)
    $TailBytes = 8KB          # enough for the newest record, which carries the branch
    $HeadLines = 60           # the opening prompt is within the first few records
    $id = $Session.SessionId
    if ($script:SessionFact.ContainsKey($id)) { return $script:SessionFact[$id] }

    $fact = @{ Branch = ''; Task = '' }
    $path = Get-SessionTranscript $id
    if ($path) {
        try {
            # FileShare ReadWrite: the session is appending to this file right now
            $fs = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
            try {
                $enc  = [System.Text.UTF8Encoding]::new($false)
                $head = [System.IO.StreamReader]::new($fs, $enc, $false, 4096, $true)
                $headEof = $false
                for ($i = 0; $i -lt $HeadLines -and -not $fact.Task; $i++) {
                    $line = $head.ReadLine()
                    if ($null -eq $line) { $headEof = $true; break }
                    # the reader is told not to detect encodings, so a BOM someone put
                    # on the transcript would otherwise hide line 1 from the parser
                    if ($i -eq 0 -and $line.Length -gt 0 -and $line[0] -eq [char]0xFEFF) {
                        $line = $line.Substring(1)
                    }
                    $fact.Task = Read-TaskLine $line
                }
                $head.Dispose()

                if ($fs.Length -gt $TailBytes) { [void]$fs.Seek(-$TailBytes, 'End') }
                elseif ($fs.CanSeek) { [void]$fs.Seek(0, 'Begin') }
                $raw = [System.IO.StreamReader]::new($fs, $enc).ReadToEnd()

                # Ordinal: the culture-sensitive default search is ~7x slower
                $at = $raw.LastIndexOf('"gitBranch"', [StringComparison]::Ordinal)
                if ($at -ge 0) {
                    $m = [regex]::Match($raw.Substring($at, [Math]::Min(200, $raw.Length - $at)),
                                        '"gitBranch"\s*:\s*"([^"]*)"')
                    if ($m.Success) { $fact.Branch = $m.Groups[1].Value }
                }
            } finally { $fs.Dispose() }
            # Only a read that got through is cached - and only when it answered. A file
            # locked for a moment must not blank the header for the rest of the run, same
            # as a missing transcript. Nor must the gap between a session starting and
            # its first prompt landing: a head that ended before HeadLines with no prompt
            # is a transcript still being born, so it is re-read next poll - until it
            # goes quiet. A short transcript nothing has written for 30 s has said all
            # it will say (a /command opener), and without settling it here it would be
            # re-opened on every poll for the rest of the run.
            if ($fact.Task -or -not $headEof -or
                ([datetime]::UtcNow - [System.IO.File]::GetLastWriteTimeUtc($path)).TotalSeconds -ge 30) {
                $script:SessionFact[$id] = $fact
            }
        } catch { }
    }
    $fact
}

function Read-TaskLine {
    # The prompt out of one transcript record, or '' if that record is not one. Meta
    # records, slash-command plumbing and the resume caveat are not prompts.
    param([string] $Line)
    if ($Line -notmatch '"type"\s*:\s*"user"') { return '' }
    try { $o = $Line | ConvertFrom-Json } catch { return '' }
    if ($o.type -ne 'user' -or $o.isMeta -or $o.isCompactSummary) { return '' }

    $c = $o.message.content
    $t = if ($c -is [string]) { $c } else { ($c | Where-Object { $_.type -eq 'text' } | Select-Object -First 1).text }
    if (-not $t) { return '' }

    $t = ConvertTo-CellText (((Remove-HarnessTag $t) -replace '\s+', ' ').Trim())
    if ($t.StartsWith('Caveat:') -or $t.StartsWith('/') -or $t.Length -lt 8) { return '' }
    # Three header rows never show more than ~2 KB, and the tab matcher tokenizes the
    # head of it; carrying a pasted multi-KB prompt is pure per-poll wrap cost.
    if ($t.Length -gt 2048) { $t = $t.Substring(0, 2048) }
    $t
}

function Get-SessionTitle {
    <#
    .SYNOPSIS
        The best name available for a session.
    .DESCRIPTION
        A name the user set with /rename wins. Claude Code omits nameSource for those
        and writes "derived" (cwd plus a suffix) or "collision" for the ones it made up
        itself, which say less than the folder and branch do.
    #>
    param([Parameter(Mandatory)] $Session)

    # A user-set name is the one string here somebody can put anything into, so it needs
    # the cell filter more than the derived ones do.
    if ($Session.NameSource -ne 'derived' -and $Session.NameSource -ne 'collision' -and $Session.Name) {
        return ConvertTo-CellText $Session.Name
    }

    $leaf = $Session.Cwd
    if ($leaf -and $leaf -ne '?') {
        $trim = $leaf.TrimEnd('\', '/')
        if ($trim -match '[\\/]' -and $trim -notmatch '^[A-Za-z]:$') { $leaf = Split-Path $trim -Leaf }
        elseif ($trim) { $leaf = $trim }
    }
    # HEAD is what a cwd outside a work tree reports, and it names nothing.
    # U+00B7 via escape, so nothing ever depends on how this file's bytes are decoded.
    $branch = (Get-SessionFact $Session).Branch
    $title = if ($branch -and $branch -ne 'HEAD' -and $branch -ne $leaf) { "$leaf $([char]0x00B7) $branch" } else { $leaf }
    ConvertTo-CellText $title
}

