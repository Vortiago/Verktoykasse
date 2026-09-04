BeforeAll {
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    # sessions.ps1 reads CLAUDE_CONFIG_DIR once, at load. Put the fake home in place
    # before dot-sourcing it. Restore, do not null: a developer running the suite
    # with a real CLAUDE_CONFIG_DIR must not lose it from their process.
    $script:snap = Get-EnvSnapshot 'CLAUDE_CONFIG_DIR'
    $script:fakeHome = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-tests-$PID"
    $env:CLAUDE_CONFIG_DIR = $fakeHome
    New-Item -ItemType Directory -Path (Join-Path $fakeHome 'sessions') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fakeHome 'projects/D--repos-matrix') -Force | Out-Null

    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/sessions.ps1')

    # This process is the only PID guaranteed alive, with a start time we can read.
    $script:livePid   = $PID
    $script:liveStart = Get-TestProcStart
    $script:deadPid   = 999999

    function Write-Registry ($name, $record) {
        $path = Join-Path $fakeHome "sessions/$name.json"
        ($record | ConvertTo-Json -Compress) | Set-Content -LiteralPath $path -Encoding utf8
    }
    function New-Record ($id, $status, $overrides) {
        $r = @{ pid = $livePid; procStart = "$liveStart"; sessionId = $id; kind = 'interactive'
                name = $id; cwd = 'D:\repos\matrix'; status = $status
                startedAt = 1000; statusUpdatedAt = 2000 }
        if ($overrides) { foreach ($k in $overrides.Keys) { $r[$k] = $overrides[$k] } }
        $r
    }
    function Clear-Registry {
        Get-ChildItem (Join-Path $fakeHome 'sessions') -File | Remove-Item -Force
    }
    # One place to drop every per-session cache in sessions.ps1, so a new one is
    # added here rather than to each BeforeEach that has to forget it.
    function Clear-SessionCache {
        $script:TranscriptIndex = $null
        $script:SessionFact     = @{}
        $script:SessionProbe    = @{}
        $script:TranscriptState = @{}
    }

    # The transcript is the only witness for a host that writes no status, so these
    # write real records and move the file's mtime to place them in time.
    function Write-Transcript ($id, $records, $quietSeconds = 0) {
        $path = Join-Path $fakeHome "projects/D--repos-matrix/$id.jsonl"
        ($records | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 6 }) |
            Set-Content -LiteralPath $path -Encoding utf8
        [System.IO.File]::SetLastWriteTimeUtc($path, [datetime]::UtcNow.AddSeconds(-$quietSeconds))
        $path
    }
    function New-Ended   { @{ type = 'assistant'; message = @{ stop_reason = 'end_turn' } } }
    function New-MidTurn { @{ type = 'assistant'; message = @{ stop_reason = 'tool_use' } } }
    # What Claude Code actually appends after a turn ends. A transcript almost never
    # ends on the assistant record: 68 of 82 on the machine this was written for end
    # on last-prompt. Any fixture that leaves this off tests a file shape that does
    # not occur.
    function New-Bookkeeping {
        @{ type = 'cost-state' }, @{ type = 'last-prompt' }, @{ type = 'permission-mode' }
    }
    # A finished turn the way it really lands on disk: the assistant record, then
    # the bookkeeping written after it.
    function New-EndedTurn { @(New-Ended) + @(New-Bookkeeping) }
}

AfterAll {
    Restore-EnvSnapshot $snap
    Remove-Item -LiteralPath $fakeHome -Recurse -Force -ErrorAction SilentlyContinue
}

Describe 'Get-SessionStyle' {
    It 'colours each status the way the lane reads it' {
        (Get-SessionStyle 'busy').Label    | Should -Be 'working'
        (Get-SessionStyle 'idle').Label    | Should -Be 'idle'
        (Get-SessionStyle 'waiting').Label | Should -Be 'needs you'
    }

    It 'falls back to idle for a status it does not know' {
        (Get-SessionStyle 'something-new').Label | Should -Be 'idle'
        (Get-SessionStyle '').Label              | Should -Be 'idle'
    }

    It 'makes a busy lane flow and a blocked one crawl' {
        (Get-SessionStyle 'busy').Speed | Should -BeGreaterThan (Get-SessionStyle 'waiting').Speed
    }
}

Describe 'Remove-HarnessTag' {
    It 'takes out a tag and everything inside it' {
        Remove-HarnessTag 'before <system-reminder>plumbing</system-reminder> after' |
            Should -Be 'before   after'
    }

    It 'takes out a stray tag on its own' {
        Remove-HarnessTag 'a <local-command-stdout> b' | Should -Be 'a   b'
    }

    It 'spans newlines, because a reminder is never one line' {
        Remove-HarnessTag "a <tag>one`ntwo</tag> b" | Should -Be 'a   b'
    }

    It 'leaves prose that merely looks like markup' {
        Remove-HarnessTag 'use a < b and c > d' | Should -Be 'use a < b and c > d'
    }
}

Describe 'Read-TaskLine' {
    It 'reads the prompt out of a user record' {
        $line = @{ type = 'user'; message = @{ content = 'Move the matrix into the toolbox' } } |
                ConvertTo-Json -Compress -Depth 5
        Read-TaskLine $line | Should -Be 'Move the matrix into the toolbox'
    }

    It 'reads the first text block of a structured record' {
        $line = @{ type = 'user'; message = @{ content = @(
                    @{ type = 'image' }, @{ type = 'text'; text = 'the actual prompt here' }) } } |
                ConvertTo-Json -Compress -Depth 5
        Read-TaskLine $line | Should -Be 'the actual prompt here'
    }

    It 'is not fooled by a record that is not a user turn' {
        $line = @{ type = 'assistant'; message = @{ content = 'a reply, not a prompt' } } |
                ConvertTo-Json -Compress -Depth 5
        Read-TaskLine $line | Should -Be ''
    }

    It 'skips the harness records that are not prompts' {
        foreach ($flag in 'isMeta', 'isCompactSummary') {
            $r = @{ type = 'user'; message = @{ content = 'looks like a prompt but is not' } }
            $r[$flag] = $true
            Read-TaskLine ($r | ConvertTo-Json -Compress -Depth 5) | Should -Be ''
        }
    }

    It 'skips a slash command, a resume caveat, and anything too short to say' {
        foreach ($text in '/simplify the code', 'Caveat: this session was resumed', 'hi') {
            $line = @{ type = 'user'; message = @{ content = $text } } |
                    ConvertTo-Json -Compress -Depth 5
            Read-TaskLine $line | Should -Be ''
        }
    }

    It 'strips the harness tags and collapses the whitespace' {
        $line = @{ type = 'user'; message = @{ content = "the real prompt`n<tag>noise</tag>  here" } } |
                ConvertTo-Json -Compress -Depth 5
        Read-TaskLine $line | Should -Be 'the real prompt here'
    }

    It 'says nothing about a line that is not JSON at all' {
        Read-TaskLine 'not json, but it does mention "type": "user"' | Should -Be ''
        Read-TaskLine '' | Should -Be ''
    }
}

Describe 'Get-ClaudeSession' {
    BeforeEach {
        Clear-Registry
        Clear-SessionCache
    }

    It 'reads a live interactive session' {
        Write-Registry 'a' (New-Record 'sid-a' 'busy')
        $live = @(Get-ClaudeSession)
        $live | Should -HaveCount 1
        $live[0].SessionId | Should -Be 'sid-a'
        $live[0].Status    | Should -Be 'busy'
        $live[0].Style.Label | Should -Be 'working'
    }

    It 'drops a session whose process is gone' {
        Write-Registry 'a' (New-Record 'sid-a' 'busy' @{ pid = $deadPid })
        @(Get-ClaudeSession) | Should -HaveCount 0
    }

    It 'drops a recycled PID, which is what procStart is for' {
        # Same live PID, a start time that is not this process's. Through the
        # fixture, because the value has to be readable and wrong: a bare '1' is
        # a mismatch in clock ticks and in a FILETIME, but it is not an asctime
        # string at all, and an unreadable field verifies nothing and keeps the
        # session. That would have passed here on two platforms and asserted the
        # opposite of the feature on the third.
        Write-Registry 'a' (New-Record 'sid-a' 'busy' @{ procStart = (Get-TestProcStartMismatch) })
        @(Get-ClaudeSession) | Should -HaveCount 0
    }

    It 'keeps a session whose procStart it cannot read at all' {
        # The other half of the rule above, and the reason the fixture exists.
        # Unreadable is not mismatched: dropping a live lane over a field shape
        # this platform does not recognise is the worse failure.
        Write-Registry 'a' (New-Record 'sid-a' 'busy' @{ procStart = 'not a start time' })
        @(Get-ClaudeSession) | Should -HaveCount 1
    }

    It 'accepts the start time Claude writes on this platform' {
        # The registry holds a FILETIME on Windows, /proc clock ticks on Linux,
        # and an asctime string in UTC on macOS. A check that reads one as
        # another finds every session dead.
        Write-Registry 'a' (New-Record 'sid-a' 'busy')
        @(Get-ClaudeSession) | Should -HaveCount 1
    }

    It 'shows only interactive sessions' {
        Write-Registry 'a' (New-Record 'sid-a' 'busy' @{ kind = 'background' })
        @(Get-ClaudeSession) | Should -HaveCount 0
    }

    It 'skips a record it cannot read instead of failing the poll' {
        'not json at all' | Set-Content -LiteralPath (Join-Path $fakeHome 'sessions/broken.json')
        Write-Registry 'a' (New-Record 'sid-a' 'busy')
        @(Get-ClaudeSession) | Should -HaveCount 1
    }

    It 'skips a record with no pid or no session id' {
        Write-Registry 'a' (New-Record 'sid-a' 'busy' @{ pid = 0 })
        Write-Registry 'b' (New-Record '' 'busy')
        @(Get-ClaudeSession) | Should -HaveCount 0
    }

    It 'never opens the sibling key files, which hold peer credentials' {
        # A VALID live record in the .key file: an enumeration widened past *.json
        # would parse and surface it, so its absence proves the claim.
        # (A garbage fixture proved nothing: unparseable files are skipped anyway.)
        (New-Record 'sid-from-key-file' 'busy' | ConvertTo-Json -Compress) |
            Set-Content -LiteralPath (Join-Path $fakeHome 'sessions/1234.abcd.key')
        Write-Registry 'a' (New-Record 'sid-a' 'busy')
        $live = @(Get-ClaudeSession)
        $live | Should -HaveCount 1
        $live[0].SessionId | Should -Be 'sid-a'
    }

    It 'fills in what a record leaves out' {
        # A transcript, because a status-less record without one has never taken a
        # turn and gets no lane at all.
        Write-Transcript 'sid-a' (New-EndedTurn) | Out-Null
        Write-Registry 'a' (New-Record 'sid-a' $null @{ name = $null; cwd = $null; nameSource = $null })
        $s = @(Get-ClaudeSession)[0]
        $s.Status     | Should -Be 'idle'
        $s.Name       | Should -Be "claude-$livePid"
        $s.Cwd        | Should -Be '?'
        $s.NameSource | Should -Be 'user'
    }

    It 'orders sessions by when they started, so lanes do not shuffle' {
        Write-Registry 'a' (New-Record 'sid-late'  'busy' @{ startedAt = 3000 })
        Write-Registry 'b' (New-Record 'sid-early' 'busy' @{ startedAt = 1000 })
        (@(Get-ClaudeSession)).SessionId | Should -Be @('sid-early', 'sid-late')
    }

    It 'has nothing to report when there is no registry' {
        Clear-Registry
        @(Get-ClaudeSession) | Should -HaveCount 0
    }
}

Describe 'Get-SessionFact' {
    BeforeEach {
        Clear-SessionCache
    }

    It 'reads the opening prompt from the head and the branch from the tail' {
        $id = 'sid-fact'
        $lines = @(
            (@{ type = 'user'; isMeta = $true; message = @{ content = 'plumbing' } } | ConvertTo-Json -Compress -Depth 5),
            (@{ type = 'user'; message = @{ content = 'the opening prompt of this session' } } | ConvertTo-Json -Compress -Depth 5),
            (@{ type = 'assistant'; gitBranch = 'old-branch' } | ConvertTo-Json -Compress -Depth 5),
            (@{ type = 'assistant'; gitBranch = 'matrix' } | ConvertTo-Json -Compress -Depth 5)
        )
        $lines | Set-Content -LiteralPath (Join-Path $fakeHome "projects/D--repos-matrix/$id.jsonl") -Encoding utf8

        $fact = Get-SessionFact ([pscustomobject]@{ SessionId = $id })
        $fact.Task   | Should -Be 'the opening prompt of this session'
        $fact.Branch | Should -Be 'matrix'          # the newest record wins
    }

    It 'does not cache a read that failed' {
        # The session appends to this file as we read it. A moment's sharing
        # violation must not blank the header for the rest of the run, exactly as a
        # missing transcript does not.
        $id = 'sid-locked'
        $path = Join-Path $fakeHome "projects/D--repos-matrix/$id.jsonl"
        (@{ type = 'user'; message = @{ content = 'the opening prompt of this session' } } |
            ConvertTo-Json -Compress -Depth 5) | Set-Content -LiteralPath $path -Encoding utf8
        $script:TranscriptIndex = $null

        $lock = [System.IO.File]::Open($path, 'Open', 'ReadWrite', 'None')
        try {
            (Get-SessionFact ([pscustomobject]@{ SessionId = $id })).Task | Should -Be ''
            $script:SessionFact.ContainsKey($id) | Should -BeFalse
        } finally { $lock.Dispose() }

        # The lock is gone, so the next look gets the answer.
        (Get-SessionFact ([pscustomobject]@{ SessionId = $id })).Task |
            Should -Be 'the opening prompt of this session'
    }

    It 'has nothing for a session with no transcript yet, and does not cache that' {
        # Do not cache the miss. That blanks the header of a session started mid-run
        # for the rest of the run.
        $s = [pscustomobject]@{ SessionId = 'sid-none' }
        (Get-SessionFact $s).Task | Should -Be ''
        $script:SessionFact.ContainsKey('sid-none') | Should -BeFalse
    }

    It 'does not latch an empty prompt while the transcript is still short' {
        # The registry lists a session the moment it starts. Its transcript exists
        # for a beat before the first user turn lands. Caching that gap as "no prompt"
        # blanked the header for the whole run.
        $id = 'sid-young'
        $path = Join-Path $fakeHome "projects/D--repos-matrix/$id.jsonl"
        (@{ type = 'assistant'; gitBranch = 'matrix' } | ConvertTo-Json -Compress -Depth 5) |
            Set-Content -LiteralPath $path -Encoding utf8
        (Get-SessionFact ([pscustomobject]@{ SessionId = $id })).Task | Should -Be ''
        $script:SessionFact.ContainsKey($id) | Should -BeFalse      # not latched

        (@{ type = 'user'; message = @{ content = 'the prompt that arrived a moment later' } } |
            ConvertTo-Json -Compress -Depth 5) | Add-Content -LiteralPath $path -Encoding utf8
        (Get-SessionFact ([pscustomobject]@{ SessionId = $id })).Task |
            Should -Be 'the prompt that arrived a moment later'
    }
}

Describe 'Get-SessionTitle' {
    BeforeEach {
        Clear-SessionCache
    }

    It 'uses a name the user set' {
        Get-SessionTitle ([pscustomobject]@{
            NameSource = 'user'; Name = 'my session'; Cwd = 'D:\repos\matrix'; SessionId = 'x' }) |
            Should -Be 'my session'
    }

    It 'replaces a name Claude made up with the folder' {
        # A derived name is the cwd plus a suffix. It says less than the folder does.
        foreach ($source in 'derived', 'collision') {
            Get-SessionTitle ([pscustomobject]@{
                NameSource = $source; Name = 'matrix-9a'; Cwd = 'D:\repos\matrix'; SessionId = 'x' }) |
                Should -Be 'matrix'
        }
    }

    It 'adds the branch when it says something the folder does not' {
        $id = 'sid-title'
        (@{ type = 'assistant'; gitBranch = 'feature-x' } | ConvertTo-Json -Compress -Depth 5) |
            Set-Content -LiteralPath (Join-Path $fakeHome "projects/D--repos-matrix/$id.jsonl") -Encoding utf8
        # [char] escape, so the expectation never depends on this file's encoding.
        Get-SessionTitle ([pscustomobject]@{
            NameSource = 'derived'; Name = 'x'; Cwd = 'D:\repos\matrix'; SessionId = $id }) |
            Should -Be "matrix $([char]0x00B7) feature-x"
    }

    It 'leaves out a branch that names nothing' {
        # HEAD is what a cwd outside a work tree reports.
        $id = 'sid-head'
        (@{ type = 'assistant'; gitBranch = 'HEAD' } | ConvertTo-Json -Compress -Depth 5) |
            Set-Content -LiteralPath (Join-Path $fakeHome "projects/D--repos-matrix/$id.jsonl") -Encoding utf8
        Get-SessionTitle ([pscustomobject]@{
            NameSource = 'derived'; Name = 'x'; Cwd = 'D:\repos\matrix'; SessionId = $id }) |
            Should -Be 'matrix'
    }

    It 'copes with a cwd that is only a drive, or missing' {
        Get-SessionTitle ([pscustomobject]@{
            NameSource = 'derived'; Name = 'x'; Cwd = 'D:'; SessionId = 'q' }) | Should -Be 'D:'
        Get-SessionTitle ([pscustomobject]@{
            NameSource = 'derived'; Name = 'x'; Cwd = '?'; SessionId = 'q' }) | Should -Be '?'
    }

    It 'puts a user-set name through the cell filter' {
        # The one string here somebody can put anything into.
        Get-SessionTitle ([pscustomobject]@{
            NameSource = 'user'; Name = "tab`there"; Cwd = 'D:\repos\matrix'; SessionId = 'x' }) |
            Should -Be 'tab here'
    }
}

Describe 'Get-TranscriptStatus' {
    BeforeEach { Clear-SessionCache }

    It 'calls a turn that ended idle, past the bookkeeping written after it' {
        # The shape a real finished transcript has. Reading the newest record rather
        # than the newest conversation record calls this mid-turn, and then blocked.
        Write-Transcript 'ts-idle' (@(New-MidTurn) + (New-EndedTurn)) | Out-Null
        (Get-TranscriptStatus 'ts-idle').Status | Should -Be 'idle'
    }

    It 'calls a turn that ended on <reason> idle too' -ForEach @(
        @{ reason = 'stop_sequence' }, @{ reason = 'max_tokens' }, @{ reason = $null }
    ) {
        # Only tool_use leaves a turn open. A subagent transcript ends on a null
        # stop_reason, and reading end_turn as the sole end marker misses every one.
        Write-Transcript "ts-stop-$reason" @(
            @{ type = 'assistant'; message = @{ stop_reason = $reason } } ) | Out-Null
        (Get-TranscriptStatus "ts-stop-$reason").Status | Should -Be 'idle'
    }

    It 'calls a turn still running busy' {
        # An assistant record that stopped to call a tool has not ended the turn.
        Write-Transcript 'ts-busy' @((New-Ended), (New-MidTurn)) | Out-Null
        (Get-TranscriptStatus 'ts-busy').Status | Should -Be 'busy'
    }

    It 'calls a user record busy: a prompt or a tool result, and the turn is open' {
        Write-Transcript 'ts-mid-user' @((New-Ended), @{ type = 'user' }) | Out-Null
        (Get-TranscriptStatus 'ts-mid-user').Status | Should -Be 'busy'
    }

    It 'walks back past a <type> record, which says nothing about the turn' -ForEach @(
        @{ type = 'attachment' }, @{ type = 'system' }, @{ type = 'queue-operation' }
    ) {
        # Bookkeeping is not a conversation record either way round: it must not end
        # a turn, and it must not keep one open.
        Write-Transcript "ts-book-$type" @((New-MidTurn), @{ type = $type }) | Out-Null
        (Get-TranscriptStatus "ts-book-$type").Status | Should -Be 'busy'
    }

    It 'calls a mid-turn transcript that has gone quiet waiting' {
        # A permission prompt is written to no file. The turn stops at the tool_use
        # record and the transcript stops with it, which is the only sign there is.
        Write-Transcript 'ts-blocked' @((New-MidTurn)) ($script:BlockedSeconds + 10) | Out-Null
        (Get-TranscriptStatus 'ts-blocked').Status | Should -Be 'waiting'
    }

    It 'leaves a finished turn idle however long it has been quiet' {
        Write-Transcript 'ts-old-idle' (New-EndedTurn) ($script:BlockedSeconds + 600) | Out-Null
        (Get-TranscriptStatus 'ts-old-idle').Status | Should -Be 'idle'
    }

    It 'does not take a conversation record quoted inside a bookkeeping one' {
        # The cheap match that skips bookkeeping runs over the whole record, so one
        # that carries an assistant record inside it reaches the parse. The parsed
        # type is what decides.
        Write-Transcript 'ts-quoted' @(
            (New-MidTurn)
            @{ type = 'last-prompt'; echo = '{"type":"assistant","stop_reason":"end_turn"}' }
        ) | Out-Null
        (Get-TranscriptStatus 'ts-quoted').Status | Should -Be 'busy'
    }

    It 'ages a status from the write that changed it, not the newest one' {
        # A working lane appends every second or two. Aged from the newest write it
        # would read "working 0s" for the whole turn.
        $id = 'ts-age'
        Write-Transcript $id @((New-MidTurn)) 30 | Out-Null
        $first = Get-TranscriptStatus $id
        Write-Transcript $id @((New-MidTurn), (New-MidTurn)) 0 | Out-Null
        $second = Get-TranscriptStatus $id

        $second.Status    | Should -Be 'busy'
        $second.UpdatedAt | Should -Be $first.UpdatedAt
    }

    It 'restarts the age when the status changes' {
        $id = 'ts-flip'
        Write-Transcript $id @((New-MidTurn)) 30 | Out-Null
        $busy = Get-TranscriptStatus $id
        Write-Transcript $id @((New-MidTurn), (New-Ended)) 0 | Out-Null
        $idle = Get-TranscriptStatus $id

        $idle.Status    | Should -Be 'idle'
        $idle.UpdatedAt | Should -BeGreaterThan $busy.UpdatedAt
    }

    It 'reads the newest record past a first line the seek cut in half' {
        # The tail window starts mid-file, so line one is a fragment. Only the
        # newest line that parses is the answer.
        $id = 'ts-cut'
        Write-Transcript $id (@(@{ type = 'user'; message = @{ content = ('x' * 40KB) } }) +
                              (New-EndedTurn)) | Out-Null
        (Get-TranscriptStatus $id).Status | Should -Be 'idle'
    }

    It 'widens the window for a last record too big for the first one' {
        # One tool_result can be far larger than the ordinary window. Answering
        # "cannot tell" there would blank the status for the whole of a turn.
        $id = 'ts-huge'
        Write-Transcript $id @(
            (New-MidTurn)
            @{ type = 'assistant'; pad = ('x' * 40KB); message = @{ stop_reason = 'end_turn' } }
        ) | Out-Null
        (Get-TranscriptStatus $id).Status | Should -Be 'idle'
    }

    It 'answers nothing for a session with no transcript' {
        Get-TranscriptStatus 'ts-missing' | Should -BeNullOrEmpty
    }

    It 'answers nothing when not one record parses' {
        # Not idle. The caller keeps what the registry said rather than colouring a
        # working session amber on the strength of an unreadable file.
        $path = Join-Path $fakeHome 'projects/D--repos-matrix/ts-junk.jsonl'
        'not json at all' | Set-Content -LiteralPath $path -Encoding utf8
        Get-TranscriptStatus 'ts-junk' | Should -BeNullOrEmpty
    }

    It 'answers nothing for a transcript it cannot open' {
        $id = 'ts-locked'
        $path = Write-Transcript $id @((New-Ended))
        $script:TranscriptIndex = $null
        $lock = [System.IO.File]::Open($path, 'Open', 'ReadWrite', 'None')
        try { Get-TranscriptStatus $id | Should -BeNullOrEmpty } finally { $lock.Dispose() }

        # The lock is gone, so the next look gets the answer. Nothing was cached.
        (Get-TranscriptStatus $id).Status | Should -Be 'idle'
    }
}

Describe 'Get-ClaudeSession status without a registry status' {
    BeforeEach {
        Clear-Registry
        Clear-SessionCache
    }

    It 'believes a registry that writes a status, whatever the transcript says' {
        # The CLI knows what a file cannot, such as why a session is waiting.
        $id = 'reg-wins'
        Write-Transcript $id (New-EndedTurn) | Out-Null
        Write-Registry 'r1' (New-Record $id 'busy')

        $s = @(Get-ClaudeSession)
        $s.Count        | Should -Be 1
        $s[0].Status    | Should -Be 'busy'
        $s[0].UpdatedAt | Should -Be 2000        # the registry's own timestamp
    }

    It 'asks the transcript when the registry carries no status' {
        # What the VS Code extension leaves behind: a record written once, at
        # startup, with no status and no statusUpdatedAt in it at all.
        $id = 'reg-blank'
        Write-Transcript $id @((New-MidTurn)) | Out-Null
        Write-Registry 'r1' (New-Record $id $null @{ statusUpdatedAt = 0 })

        $s = @(Get-ClaudeSession)
        $s[0].Status      | Should -Be 'busy'
        $s[0].Style.Label | Should -Be 'working'
        $s[0].UpdatedAt   | Should -BeGreaterThan 0     # aged off the transcript
    }

    It 'stays idle when the transcript is there but cannot answer' {
        # An unreadable file is not evidence of anything. The lane keeps the
        # registry's answer rather than being recoloured on a bad read.
        $path = Join-Path $fakeHome 'projects/D--repos-matrix/reg-junk.jsonl'
        'not json at all' | Set-Content -LiteralPath $path -Encoding utf8
        Write-Registry 'r1' (New-Record 'reg-junk' $null)
        @(Get-ClaudeSession)[0].Status | Should -Be 'idle'
    }

    It 'drops a session that has no transcript at all: it has never taken a turn' {
        # The empty session a VS Code window opens with, still registered and still
        # alive after the user opened a past session in its place. It rained a
        # second lane for the same window with nothing in it.
        Write-Registry 'r1' (New-Record 'reg-notranscript' $null)
        @(Get-ClaudeSession).Count | Should -Be 0
    }

    It 'keeps the used session when the unused one shares its window' {
        # Both PIDs are alive and both records are real: only the transcript tells
        # them apart.
        $used = 'reg-resumed'
        Write-Transcript $used (New-EndedTurn) | Out-Null
        Write-Registry 'r1' (New-Record $used   $null @{ statusUpdatedAt = 0 })
        Write-Registry 'r2' (New-Record 'reg-untouched' $null @{ statusUpdatedAt = 0 })

        $s = @(Get-ClaudeSession)
        $s.Count       | Should -Be 1
        $s[0].SessionId | Should -Be $used
    }
}

Describe 'ConvertTo-ProcStartTicks' {
    # /proc/N/stat field 22, read out of the line rather than off the disk, so the
    # parse is testable on a box that has no /proc at all.
    It 'reads the start time out of a stat line' {
        # Fields 3 through 21 stand in as zeros; 22 is the one that matters.
        $stat = '4242 (pwsh) S ' + ((1..18 | ForEach-Object { 0 }) -join ' ') + ' 987654'
        ConvertTo-ProcStartTicks $stat | Should -Be 987654
    }

    It 'counts from the last close paren, so a comm with spaces and parens does not shift it' {
        # comm is whatever the binary was called, up to 15 bytes, and the kernel
        # does not escape it: "(a b) c)" is a legal one.
        $stat = '4242 (a b) c) S ' + ((1..18 | ForEach-Object { 0 }) -join ' ') + ' 987654'
        ConvertTo-ProcStartTicks $stat | Should -Be 987654
    }

    It 'answers nothing for a line that is too short to hold the field' {
        # Not 0. Zero is a real tick value, and a caller comparing it against the
        # registry would read "started at boot" and drop a live session.
        ConvertTo-ProcStartTicks '4242 (pwsh) S 1 2 3' | Should -BeNullOrEmpty
    }

    It 'answers nothing for a line with no comm at all' {
        ConvertTo-ProcStartTicks 'nothing here' | Should -BeNullOrEmpty
    }

    It 'answers nothing when the field is not a number' {
        $stat = '4242 (pwsh) S ' + ((1..18 | ForEach-Object { 0 }) -join ' ') + ' later'
        ConvertTo-ProcStartTicks $stat | Should -BeNullOrEmpty
    }
}

Describe 'Test-SessionAlive on an unreadable stat line' -Skip:(-not $IsLinux) {
    # Linux only, and now spelled that way: only the /proc branch reads a stat
    # line at all. -Skip:($IsWindows) used to mean the same thing and stopped
    # meaning it the moment macOS became a platform this runs on.
    It 'keeps the session, the same answer an unreadable procStart gets' {
        # The rule sessions.ps1 already states for a procStart that will not
        # parse. The reading side has to answer the same way, or a live lane
        # vanishes for the rest of the run over an unreadable stat line.
        Mock Get-ProcessStartTicks { $null }
        Test-SessionAlive -ProcessId $PID -ProcStart '12345' | Should -BeTrue
    }
}

Describe 'ConvertTo-ProcStartUtc' {
    # What Claude writes as procStart on macOS: asctime, in UTC. A pure parse, so
    # it is read on every platform. The value below is a real record off a Mac.
    It 'reads an asctime string as UTC' {
        $t = ConvertTo-ProcStartUtc 'Fri Sep  4 12:03:56 2026'
        $t | Should -Not -BeNullOrEmpty
        $t.Kind   | Should -Be ([System.DateTimeKind]::Utc)
        $t.Year   | Should -Be 2026
        $t.Month  | Should -Be 9
        $t.Day    | Should -Be 4
        $t.Hour   | Should -Be 12
        $t.Minute | Should -Be 3
        $t.Second | Should -Be 56
    }

    It 'reads a two-digit day, which is padded with one space less' {
        # "Sep  4" and "Sep 14" differ in width. A format that only fits one of
        # them drops every session started on the other half of the month.
        $t = ConvertTo-ProcStartUtc 'Mon Sep 14 12:03:56 2026'
        $t.Day | Should -Be 14
    }

    It 'does not read it as local time' {
        # The bug this guards: procStart is UTC, and StartTime is local. Comparing
        # the two without converting drops every session on a box that is not on
        # UTC, which is most of them.
        $t = ConvertTo-ProcStartUtc 'Fri Sep  4 12:03:56 2026'
        $t.ToUniversalTime().Hour | Should -Be 12
    }

    It 'answers nothing for a string it cannot read, so the session is kept' {
        ConvertTo-ProcStartUtc ''              | Should -BeNullOrEmpty
        ConvertTo-ProcStartUtc '12345'         | Should -BeNullOrEmpty
        ConvertTo-ProcStartUtc 'not a date'    | Should -BeNullOrEmpty
        # A FILETIME, which is what the same field holds on Windows.
        ConvertTo-ProcStartUtc '133012345678'  | Should -BeNullOrEmpty
    }
}

Describe 'ConvertTo-ProcParentMap' {
    # `ps -Ao pid=,ppid=` is how a platform with no /proc answers the parent
    # question. The parse is split from the call, so it runs on every platform.
    It 'reads the pid and ppid columns' {
        $map = ConvertTo-ProcParentMap "    1     0`n   93     1`n  456    93`n"
        $map[1]   | Should -Be 0
        $map[93]  | Should -Be 1
        $map[456] | Should -Be 93
    }

    It 'drops a row that does not hold two numbers' {
        # The blank last line, and anything ps prints that is not a row.
        $map = ConvertTo-ProcParentMap "  1  0`n`n  PID PPID`n  2  1`n"
        $map.Count | Should -Be 2
        $map[1] | Should -Be 0
        $map[2] | Should -Be 1
    }

    It 'answers an empty map for no output' {
        (ConvertTo-ProcParentMap '').Count   | Should -Be 0
        (ConvertTo-ProcParentMap $null).Count | Should -Be 0
    }
}

Describe 'Get-ProcessAncestorId without /proc' {
    # The branch macOS takes. Driven through the seam, so it is read on every
    # platform rather than only where ps exists.
    It 'walks a table it was handed' {
        $table = { @{ 500 = 400; 400 = 300; 300 = 1; 1 = 0 } }
        $chain = @(Get-ProcessAncestorId -ProcessId 500 -Parents $table)
        $chain | Should -Be @(500, 400, 300, 1)
    }

    It 'stops at a pid the table does not name, rather than looping' {
        $chain = @(Get-ProcessAncestorId -ProcessId 500 -Parents { @{ 500 = 400 } })
        $chain | Should -Be @(500, 400)
    }

    It 'answers with just the pid when the table is empty' {
        # What Windows gets: there is no ps to run, so the walk stops at once.
        $chain = @(Get-ProcessAncestorId -ProcessId 500 -Parents { @{} })
        $chain | Should -Be @(500)
    }

    It "walks this shell's own chain for real" -Skip:($IsWindows -or (Test-Path '/proc')) {
        # macOS only: the one place the default seam runs a real ps. Its chain
        # contains itself and reaches launchd at pid 1.
        $chain = @(Get-ProcessAncestorId -ProcessId $PID)
        $chain.Count | Should -BeGreaterThan 1
        $chain[0]    | Should -Be $PID
        $chain       | Should -Contain 1
    }
}

Describe 'Get-ProcessAncestorId' {
    # Lives here, next to the other process-table readers, once both tab backends
    # that need it (Konsole, tmux) get it from sessions.ps1 instead of carrying
    # their own copy.
    It "walks this shell's own chain through /proc" -Skip:(-not (Test-Path '/proc')) {
        # The only process the test can promise exists. Its chain contains itself
        # and its parent, and reaches init at the top. Only Linux has /proc, so this
        # is the one test the Windows run of this file skips.
        $chain = @(Get-ProcessAncestorId -ProcessId $PID)
        $chain.Count | Should -BeGreaterThan 1
        $chain[0]   | Should -Be $PID
        $chain      | Should -Contain 1              # the walk reaches init
    }
}
