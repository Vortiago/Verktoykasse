# Live Claude Code sessions and their status. Needs ConvertTo-CellText from console.ps1.
#
# Source of truth: ~/.claude/sessions/<pid>.json, the registry Claude Code itself
# reads for peer discovery. Fields used here:
#
#   status       busy | waiting | idle           the three states we colour by
#   waitingFor   reason, only set on waiting      "input needed", "sandbox request", ...
#   procStart    the process start, platform-shaped  guards against PID reuse
#                (a FILETIME on Windows, /proc clock ticks on Linux)
#
# The file also names a peer pipe carrying notify_idle. That pipe rejects subscribers
# that are not registered sessions, so read status from the files. See README.md.

# The home to read, not the variable that happens to be set: a Linux shell can
# inherit USERPROFILE (WSLENV passes it through), and picking it there points the
# whole poll at a path that does not exist.
$script:ClaudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR }
                     elseif ($IsWindows)         { Join-Path $env:USERPROFILE '.claude' }
                     else                        { Join-Path $HOME '.claude' }

# status -> how the lane looks. Green flows, red crawls. Tune it in styles.psd1.
$script:SessionStyle = Import-PowerShellDataFile (Join-Path $PSScriptRoot '..' 'styles.psd1')

function Get-SessionStyle {
    # A status this table does not know degrades to idle.
    param([string] $Status)
    $s = $script:SessionStyle[$Status]
    if ($s) { $s } else { $script:SessionStyle['idle'] }
}

# /proc/N/stat field 22 is the process start, in clock ticks since boot. The comm
# field can hold spaces and ')', so the fields are counted from after the LAST ')'.
# The text there starts at field 3, so field 22 is index 19.
$script:ProcStartIndex = 19

function ConvertTo-ProcStartTicks {
    # Nothing, not zero, for a line this cannot read. Zero is a real tick value,
    # and the caller compares the answer against the registry and drops the
    # session when it differs.
    param([string] $Stat)
    $fields = ($Stat.Substring($Stat.LastIndexOf(')') + 2)) -split ' '
    if ($fields.Count -le $script:ProcStartIndex) { return $null }
    [long] $ticks = 0
    if (-not [long]::TryParse($fields[$script:ProcStartIndex], [ref] $ticks)) { return $null }
    $ticks
}

function Get-ProcessStartTicks {
    # What Claude writes as "procStart" on Linux. Split from the parse above so
    # the parse is testable on a box with no /proc. The test fixtures read this
    # to write their fake registries.
    param([int] $ProcessId)
    ConvertTo-ProcStartTicks ([System.IO.File]::ReadAllText("/proc/$ProcessId/stat"))
}

function Test-SessionAlive {
    # PID alive, and started when the file says. A recycled PID fails the second test.
    param([int] $ProcessId, [string] $ProcStart)
    if (-not $IsWindows) {
        # One /proc read answers both questions here: no stat file, no process.
        # GetProcessById would read the same /proc entry a second time.
        try { $start = Get-ProcessStartTicks -ProcessId $ProcessId }
        catch { return $false }
        if (-not $ProcStart) { return $true }
        # A field that will not parse verifies nothing, on either side of the
        # comparison. Keep the session: the Windows branch below answers the same.
        # A bare cast would throw, and the caller's per-record catch would drop a
        # live lane over an unreadable field.
        if ($null -eq $start) { return $true }
        [long] $want = 0
        if (-not [long]::TryParse($ProcStart, [ref] $want)) { return $true }
        return ($start -eq $want)
    }
    # GetProcessById, not Get-Process: the cmdlet enumerates every process and wraps
    # each in a PSObject. This lookup runs per session per poll.
    try { $p = [System.Diagnostics.Process]::GetProcessById($ProcessId) } catch { return $false }
    # Dispose: StartTime opens a kernel handle. This runs per session per poll.
    try {
        if (-not $ProcStart) { return $true }
        # Claude writes a FILETIME on Windows. 2 s of slop: the file holds the
        # value Claude read, not our conversion of it. No StartTime rights, or a
        # procStart that does not cast, verifies nothing. Keep the session
        # rather than kill the poll under EAP=Stop.
        try { return [Math]::Abs($p.StartTime.ToFileTimeUtc() - [int64]$ProcStart) -lt 20000000 }
        catch { return $true }
    } finally { $p.Dispose() }
}

function Get-ProcessAncestorId {
    # A pid and every pid above it, from /proc. The chain is short, and the walk
    # runs once per session per tab-map rebuild, not per poll.
    #
    # Lives here, next to the other process-table readers, because both tab
    # backends that match a session on a process tree - Konsole's tab shell and
    # tmux's pane_pid - walk the same one.
    param([Parameter(Mandatory)] [int] $ProcessId)
    $out = [System.Collections.Generic.List[int]]::new()
    $p = $ProcessId
    for ($i = 0; $i -lt 64 -and $p -ge 1; $i++) {
        $out.Add($p)
        try {
            $m = [regex]::Match([System.IO.File]::ReadAllText("/proc/$p/status"),
                                '(?m)^PPid:\s+(\d+)')
            if (-not $m.Success) { break }
            $p = [int]$m.Groups[1].Value
        } catch { break }
    }
    $out
}

function Get-ClaudeSession {
    <#
    .SYNOPSIS
        Every live interactive Claude Code session, with its current status.
    #>
    [CmdletBinding()]
    param()

    $dir = Join-Path $script:ClaudeHome 'sessions'
    if (-not [System.IO.Directory]::Exists($dir)) { return @() }

    # *.json only. The sibling *.key files hold peer credentials and are never read.
    # ReadAllText, not Get-Content -Raw: the provider and pipeline cost 7x on a file
    # this small. This runs per session per poll.
    $out = foreach ($f in [System.IO.Directory]::EnumerateFiles($dir, '*.json')) {
        # One try for the whole record. Unreadable JSON and a malformed field (a pid or
        # timestamp that does not cast) skip it the same way. Without it, the script's
        # ErrorActionPreference = Stop kills the whole rain.
        try {
            $r = ConvertFrom-Json ([System.IO.File]::ReadAllText($f))
            if (-not $r.pid -or -not $r.sessionId) { continue }
            if ($r.kind -ne 'interactive') { continue }
            if (-not (Test-SessionAlive -ProcessId $r.pid -ProcStart $r.procStart)) { continue }

            # A record with no status is not an idle session, it is a host that
            # writes none. Ask the transcript. A host that does write status is
            # always believed: it knows what a file cannot, such as why a session
            # is waiting.
            $status    = 'idle'
            $updatedAt = [int64]$r.statusUpdatedAt
            if     ($r.status)                              { $status = [string]$r.status }
            elseif ($t = Get-TranscriptStatus $r.sessionId) { $status = $t.Status; $updatedAt = $t.UpdatedAt }
            [pscustomobject]@{
                Pid        = [int]$r.pid
                SessionId  = [string]$r.sessionId
                Name       = if ($r.name) { [string]$r.name } else { "claude-$($r.pid)" }
                NameSource = if ($r.nameSource) { [string]$r.nameSource } else { 'user' }
                Cwd        = if ($r.cwd)  { [string]$r.cwd }  else { '?' }
                Status     = $status
                WaitingFor = if ($r.waitingFor) { [string]$r.waitingFor } else { '' }
                StartedAt  = [int64]$r.startedAt
                UpdatedAt  = $updatedAt
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
# starts mid-run is not indexed, so a miss rebuilds the index, at most every 10 s.
# The throttle stops a session with no transcript yet from rebuilding on every poll.
$script:TranscriptIndex = $null
$script:IndexBuiltAt    = [datetime]::MinValue

function Update-TranscriptIndex {
    $root = Join-Path $script:ClaudeHome 'projects'
    $script:TranscriptIndex = @{}
    $script:IndexBuiltAt    = [datetime]::UtcNow
    if (-not [System.IO.Directory]::Exists($root)) { return }
    # The walk must not kill the poll. An ACL'd subfolder, a junction, or a project
    # folder deleted mid-walk throws out of the lazy enumeration, outside every
    # caller's try. Keep whatever was indexed before the throw; the 10 s rebuild
    # throttle picks up the rest.
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
    # The project folder is the cwd with every character outside [A-Za-z0-9-] replaced.
    # So the index is keyed on the file name, not a rebuilt slug.
    param([string] $SessionId)
    if ($null -eq $script:TranscriptIndex) { Update-TranscriptIndex }
    $hit = $script:TranscriptIndex[$SessionId]
    if (-not $hit -and ([datetime]::UtcNow - $script:IndexBuiltAt).TotalSeconds -ge 10) {
        Update-TranscriptIndex
        $hit = $script:TranscriptIndex[$SessionId]
    }
    $hit
}

# Status for a session whose registry record does not carry one. Claude Code's CLI
# rewrites its record on every status change; the VS Code extension writes it once,
# at startup, and never returns - no "status", no "statusUpdatedAt". Those sessions
# read as idle for their whole life, whatever they are doing.
#
# The transcript is the second witness. Every host appends it in real time, and its
# last record says whether the turn is over:
#
#   assistant, not stopped on a tool  the turn ended, the prompt is showing    idle
#   assistant, stop_reason tool_use   stopped for a tool, waiting on its result busy
#   user                              a prompt or a tool result just landed     busy
#
# Bookkeeping records are skipped, not read as records: see ConversationRecord.
#
# A mid-turn transcript that has not grown for BlockedSeconds is not working, it is
# blocked. A permission prompt is written to no file: the turn stops dead at the
# tool_use record until it is answered, and the transcript goes quiet with it. A
# tool that honestly runs that long - a build, a long test suite - reads as blocked
# too. That is the trade worth making: a working session shown red early is a
# nuisance, a blocked session shown green forever is the bug this exists to fix.
$script:BlockedSeconds = 90

# Tail windows for the newest record, tried in order. A seek into the middle of the
# file cuts the first line in half and a record still being written cuts the last,
# so the read walks back to the newest record it can read. 16 KB holds any ordinary
# one; a single tool_result can be far larger, and the second window covers it
# rather than answering "cannot tell" for the whole of a turn.
$script:StatusTailBytes = @(16KB, 256KB)

# The record types that are part of the conversation. Everything else in a
# transcript is bookkeeping Claude Code appends around the turn - last-prompt,
# ai-title, cost-state, permission-mode, queue-operation, file-history-delta - and
# almost always after it: of 82 transcripts on the machine this was written for,
# 68 end on last-prompt and 2 on an assistant record. So the newest record in the
# file is nearly never the newest thing that was said, and reading it as though it
# were called every finished session mid-turn, then blocked.
$script:ConversationRecord = @('assistant', 'user')

# sessionId -> the last verdict, as @{ MTime; Status; Since }. An unchanged file
# cannot have changed its answer, and the age in the header wants the write that
# changed the status, not the newest. A Status of $null is "this file cannot say".
$script:TranscriptState = @{}

function Read-StreamTail {
    <#
    .SYNOPSIS
        The newest $Bytes of an open transcript, as text.
    #>
    param([Parameter(Mandatory)] [System.IO.FileStream] $Stream,
          [Parameter(Mandatory)] [int] $Bytes)

    $n = [int][Math]::Min([int64]$Bytes, $Stream.Length)
    if ($Stream.Length -gt $n) { [void]$Stream.Seek(-$n, 'End') }
    elseif ($Stream.CanSeek)   { [void]$Stream.Seek(0, 'Begin') }

    # One exact-size read, not StreamReader.ReadToEnd: the reader grows a builder by
    # doubling and carries its own buffers on top, ~4x the window in garbage per
    # call. This runs per session per poll, inside a frame the rain is drawing.
    $buf = [byte[]]::new($n)
    $got = 0
    while ($got -lt $n) {
        $read = $Stream.Read($buf, $got, $n - $got)
        if ($read -le 0) { break }
        $got += $read
    }
    $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $got)
    # Only a window that starts at byte 0 can carry the file's BOM, and a BOM left
    # in place hides the first line from the parser. Every other window starts
    # mid-file, where there is none.
    if ($text.Length -and $text[0] -eq [char]0xFEFF) { $text.Substring(1) } else { $text }
}

function Test-TranscriptEnded {
    <#
    .SYNOPSIS
        $true when the newest conversation record of a transcript ended the turn,
        $false when it did not, $null when no such record could be read.
    #>
    param([Parameter(Mandatory)] [string] $Path)

    foreach ($window in $script:StatusTailBytes) {
        # FileShare ReadWrite: the session is appending to this file right now.
        $fs = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
        try { $raw = Read-StreamTail -Stream $fs -Bytes $window } finally { $fs.Dispose() }

        $lines = $raw -split "`n"
        for ($i = $lines.Count - 1; $i -ge 0; $i--) {
            $line = $lines[$i].Trim()
            # The tail is mostly bookkeeping, and none of it can end a turn. One
            # match skips a record without parsing it - the gate Read-TaskLine uses,
            # for the same reason: a parse costs ~8x what the test does, and this
            # walks back over several records to reach the one that answers.
            if ($line -notmatch '"type"\s*:\s*"(assistant|user)"') { continue }
            try { $o = ConvertFrom-Json $line } catch { continue }
            # The match is a prefilter over the whole record, so a bookkeeping one
            # that quotes a conversation record reaches here. The parsed type is the
            # authority.
            if ($script:ConversationRecord -notcontains $o.type) { continue }
            # An assistant record that stopped to call a tool is waiting on the
            # result: the turn is open. Every other reason it stopped ends it,
            # including the null a subagent transcript ends on. A user record is a
            # prompt or a tool result, and the turn is open either way.
            return ($o.type -eq 'assistant' -and $o.message.stop_reason -ne 'tool_use')
        }
    }
    return $null
}

function Get-TranscriptStatus {
    <#
    .SYNOPSIS
        Status and its age for a session, read from its transcript.
    .DESCRIPTION
        A hashtable of Status (busy | waiting | idle) and UpdatedAt (epoch ms), or
        $null when the transcript cannot answer - no file yet, or not one readable
        record in it. A caller that gets $null keeps whatever the registry said.
    #>
    param([Parameter(Mandatory)] [string] $SessionId)

    $path = Get-SessionTranscript $SessionId
    if (-not $path) { return $null }

    try {
        $mtime = [System.IO.File]::GetLastWriteTimeUtc($path)
        # The verdict is the newest record plus how old it is. Only the first needs
        # the file, so an unchanged mtime re-ages the last one instead of reading a
        # tail again. A busy session writes every second or two; this runs per
        # session per poll. A cached $null is cached too: without it a transcript
        # that says nothing re-reads both windows on every poll for the whole run.
        $seen = $script:TranscriptState[$SessionId]
        if ($seen -and $seen.MTime -eq $mtime) {
            if ($null -eq $seen.Status) { return $null }
            $ended = $seen.Status -eq 'idle'
        }
        else {
            $ended = Test-TranscriptEnded $path
            if ($null -eq $ended) {
                $script:TranscriptState[$SessionId] = @{ MTime = $mtime; Status = $null; Since = $mtime }
                return $null
            }
        }

        $quiet  = ([datetime]::UtcNow - $mtime).TotalSeconds
        $status = if ($ended) { 'idle' }
                  elseif ($quiet -ge $script:BlockedSeconds) { 'waiting' }
                  else { 'busy' }

        # How long the status has held, which is not how long since the last write:
        # a working lane appending every second would read "working 0s" forever.
        # The write that changed the answer is when the answer changed - exact for a
        # turn that ended, and for one that stalled. A session already mid-turn when
        # the rain starts has no such write to point at, so its first age is short
        # and grows true from there.
        $since = if ($seen -and $seen.Status -eq $status) { $seen.Since } else { $mtime }
        $script:TranscriptState[$SessionId] = @{ MTime = $mtime; Status = $status; Since = $since }

        @{ Status    = $status
           UpdatedAt = [DateTimeOffset]::new($since, [timespan]::Zero).ToUnixTimeMilliseconds() }
    } catch { $null }
}

# Branch and opening prompt per session. Neither moves while the rain runs, so open
# the transcript once for both.
$script:SessionFact  = @{}
$script:SessionProbe = @{}   # last empty read per unsettled session, keyed to the file's mtime

function Get-SessionFact {
    <#
    .SYNOPSIS
        The branch and the opening prompt of a session, for its header.
    .DESCRIPTION
        One open of the transcript serves both. The head holds the first user turn.
        The tail holds the newest record, whose gitBranch is the current one. Read
        once per session: a branch changed mid-session stays stale until the rain
        restarts.

        A hit is cached at once. A miss is re-read while the first prompt may still
        be growing, and settles into the cache after 30 s of file quiet. The comment
        on the cache condition below has the full rule.
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
            # Stat before open. An unsettled transcript is re-visited on every poll,
            # and an unchanged file cannot answer differently: reuse the last empty
            # read without opening. Reuse ends when the file grows, or goes quiet
            # long enough for the condition at the bottom to settle it into the cache.
            $mtime = [System.IO.File]::GetLastWriteTimeUtc($path)
            $probe = $script:SessionProbe[$id]
            if ($probe -and $probe.MTime -eq $mtime) {
                if (([datetime]::UtcNow - $mtime).TotalSeconds -ge 30) {
                    $script:SessionFact[$id] = $probe.Fact
                    $script:SessionProbe.Remove($id)
                }
                return $probe.Fact
            }

            # FileShare ReadWrite: the session is appending to this file right now
            $fs = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
            try {
                $enc  = [System.Text.UTF8Encoding]::new($false)
                # BOM detection on: the reader consumes a BOM put on the transcript.
                # A BOM left in place hides line 1 from the parser.
                $head = [System.IO.StreamReader]::new($fs, $enc, $true, 4096, $true)
                $headEof = $false
                for ($i = 0; $i -lt $HeadLines -and -not $fact.Task; $i++) {
                    $line = $head.ReadLine()
                    if ($null -eq $line) { $headEof = $true; break }
                    $fact.Task = Read-TaskLine $line
                }
                $head.Dispose()

                $raw = Read-StreamTail -Stream $fs -Bytes $TailBytes

                # Ordinal: the culture-sensitive default search is ~7x slower
                $at = $raw.LastIndexOf('"gitBranch"', [StringComparison]::Ordinal)
                if ($at -ge 0) {
                    $m = [regex]::Match($raw.Substring($at, [Math]::Min(200, $raw.Length - $at)),
                                        '"gitBranch"\s*:\s*"([^"]*)"')
                    if ($m.Success) { $fact.Branch = $m.Groups[1].Value }
                }
            } finally { $fs.Dispose() }
            # Cache only a read that got through and answered. A briefly locked file,
            # or a missing transcript, must not blank the header for the rest of the
            # run. A head that ends before HeadLines with no prompt is a transcript
            # still being born: probe it next poll, until it goes quiet. A transcript
            # quiet for 30 s has said all it will say (a /command opener). Settle it
            # here, or it is probed on every poll for the rest of the run.
            if ($fact.Task -or -not $headEof -or
                ([datetime]::UtcNow - $mtime).TotalSeconds -ge 30) {
                $script:SessionFact[$id] = $fact
                $script:SessionProbe.Remove($id)
            } else {
                $script:SessionProbe[$id] = @{ MTime = $mtime; Fact = $fact }
            }
        } catch { }
    }
    $fact
}

function Read-TaskLine {
    # The prompt out of one transcript record, or '' when the record is not one. Meta
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
    # Three header rows never show more than ~2 KB, and the tab matcher tokenizes
    # only the head. Carrying a pasted multi-KB prompt is pure per-poll wrap cost.
    if ($t.Length -gt 2048) { $t = $t.Substring(0, 2048) }
    $t
}

function Get-SessionTitle {
    <#
    .SYNOPSIS
        The best name available for a session.
    .DESCRIPTION
        A name the user set with /rename wins; Claude Code omits nameSource for those.
        It writes "derived" (cwd plus a suffix) or "collision" for names it made up.
        Those say less than the folder and branch do.
    #>
    param([Parameter(Mandatory)] $Session)

    # A user-set name is the one string here that can hold anything. It needs the
    # cell filter more than the derived ones do.
    if ($Session.NameSource -ne 'derived' -and $Session.NameSource -ne 'collision' -and $Session.Name) {
        return ConvertTo-CellText $Session.Name
    }

    $leaf = $Session.Cwd
    if ($leaf -and $leaf -ne '?') {
        $trim = $leaf.TrimEnd('\', '/')
        if ($trim -match '[\\/]' -and $trim -notmatch '^[A-Za-z]:$') { $leaf = Split-Path $trim -Leaf }
        elseif ($trim) { $leaf = $trim }
    }
    # A cwd outside a work tree reports HEAD, which names nothing.
    # U+00B7 via escape, so nothing ever depends on how this file's bytes are decoded.
    $branch = (Get-SessionFact $Session).Branch
    $title = if ($branch -and $branch -ne 'HEAD' -and $branch -ne $leaf) { "$leaf $([char]0x00B7) $branch" } else { $leaf }
    ConvertTo-CellText $title
}

