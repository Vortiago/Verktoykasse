BeforeAll {
    # sessions.ps1 reads CLAUDE_CONFIG_DIR once, at load. Put the fake home in place
    # before dot-sourcing it.
    $script:realHome = $env:CLAUDE_CONFIG_DIR
    $script:fakeHome = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-tests-$PID"
    $env:CLAUDE_CONFIG_DIR = $fakeHome
    New-Item -ItemType Directory -Path (Join-Path $fakeHome 'sessions') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fakeHome 'projects/D--repos-matrix') -Force | Out-Null

    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/sessions.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

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
}

AfterAll {
    $env:CLAUDE_CONFIG_DIR = $realHome
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
        $script:TranscriptIndex = $null
        $script:SessionFact = @{}
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
        # Same live PID, a start time that is not this process's.
        Write-Registry 'a' (New-Record 'sid-a' 'busy' @{ procStart = '1' })
        @(Get-ClaudeSession) | Should -HaveCount 0
    }

    It 'accepts the start time Claude writes on this platform' {
        # The registry holds a FILETIME on Windows and /proc clock ticks on Linux.
        # A check that reads one as the other finds every session dead.
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
        $script:TranscriptIndex = $null
        $script:SessionFact = @{}
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
        $script:TranscriptIndex = $null
        $script:SessionFact = @{}
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

Describe 'Test-SessionAlive on an unreadable stat line' -Skip:($IsWindows) {
    It 'keeps the session, the same answer an unreadable procStart gets' {
        # The rule this file already states for a procStart that will not parse:
        # a field that verifies nothing is not evidence the process is gone. The
        # reading side has to answer the same way, or a live lane vanishes for
        # the rest of the run over a stat line nobody could read.
        Mock Get-ProcessStartTicks { $null }
        Test-SessionAlive -ProcessId $PID -ProcStart '12345' | Should -BeTrue
    }
}
