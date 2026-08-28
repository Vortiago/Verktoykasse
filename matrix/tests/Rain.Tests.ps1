# The script end to end. Everything else here tests a lib in isolation; these run the
# rain itself, because the faults they cover only exist once the parts are wired up.
BeforeAll {
    $script:rain = Join-Path $PSScriptRoot '..\matrix.ps1'
    $script:pwshExe = (Get-Process -Id $PID).Path

    # A Claude home with no sessions in it at all.
    $script:emptyHome = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-tests-$PID"
    New-Item -ItemType Directory -Path (Join-Path $emptyHome 'sessions') -Force | Out-Null

    # A Claude home holding one session that is genuinely alive: this process, which
    # outlives every child the tests start. Its transcript carries a word nothing else
    # in a frame could produce.
    $script:liveHome = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-live-$PID"
    $script:liveTask = 'zeppelin over the harbour'
    New-Item -ItemType Directory -Path (Join-Path $liveHome 'sessions') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $liveHome 'projects\P') -Force | Out-Null
    @{  pid       = $PID
        procStart = "$([System.Diagnostics.Process]::GetCurrentProcess().StartTime.ToFileTimeUtc())"
        sessionId = 'sid-live'; kind = 'interactive'; name = 'sid-live'
        cwd       = 'D:\repos\matrix'; status = 'busy'
        startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        statusUpdatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress |
        Set-Content -LiteralPath (Join-Path $liveHome "sessions\$PID.json") -Encoding utf8
    (@{ type = 'user'; message = @{ content = $liveTask } } | ConvertTo-Json -Compress -Depth 5) |
        Set-Content -LiteralPath (Join-Path $liveHome 'projects\P\sid-live.jsonl') -Encoding utf8

    function Invoke-Rain ($claudeHome, [string[]] $argv) {
        $out = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-$PID.out"
        $err = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-$PID.err"
        $env:CLAUDE_CONFIG_DIR = $claudeHome
        try {
            $p = Start-Process -FilePath $pwshExe -PassThru -Wait -NoNewWindow `
                    -RedirectStandardOutput $out -RedirectStandardError $err `
                    -ArgumentList (@('-NoProfile', '-File', $rain) + $argv)
            [pscustomobject]@{
                ExitCode = $p.ExitCode
                Stdout   = (Get-Content -LiteralPath $out -Raw -ErrorAction SilentlyContinue)
                Stderr   = (Get-Content -LiteralPath $err -Raw -ErrorAction SilentlyContinue)
            }
        } finally {
            $env:CLAUDE_CONFIG_DIR = $null
            Remove-Item $out, $err -Force -ErrorAction SilentlyContinue
        }
    }

    # Header text survives the frame diff as one run, so it is greppable once the colour
    # changes are out of the way.
    function Remove-Sgr ([string] $Text) { $Text -replace "$([char]27)\[[0-9;?]*[A-Za-z]", '' }
}

AfterAll {
    Remove-Item -LiteralPath $emptyHome, $liveHome -Recurse -Force -ErrorAction SilentlyContinue
}

Describe 'matrix.ps1 -Sessions' {
    It 'says so when there are no sessions, rather than dying on the empty list' {
        # A Mandatory collection parameter rejects an empty array before the body runs,
        # so the lane function's own "no sessions" branch was unreachable and the rain
        # quit with "Cannot bind argument to parameter 'Live'". This is the FIRST thing
        # anyone sees, and only ever on a machine with nothing running.
        $r = Invoke-Rain $emptyHome @('-Sessions', '-Seconds', '2', '-Fps', '10')
        $r.Stderr   | Should -Not -Match 'Cannot bind argument'
        $r.ExitCode | Should -Be 0
        $r.Stdout   | Should -Match 'no claude sessions'
    }

    It 'draws a live session, status and all' {
        $r = Invoke-Rain $liveHome @('-Sessions', '-Seconds', '2', '-Fps', '10')
        $r.ExitCode | Should -Be 0
        (Remove-Sgr $r.Stdout) | Should -Match 'working'
    }

    It 'puts the task in the header whether or not tabs are wanted' {
        # The lane reads .Task off the session, so the staple that puts it there must not
        # be conditional on -Click or -ThisWindow, which are what ask for the tab map.
        $r = Invoke-Rain $liveHome @('-Sessions', '-Seconds', '2', '-Fps', '10')
        (Remove-Sgr $r.Stdout) | Should -Match 'zeppelin'
    }
}

Describe 'matrix.ps1' {
    It 'rains, in every mode that does not need a desktop' {
        foreach ($argv in @('-Seconds', '1', '-Fps', '10'),
                          @('-Ascii', '-Seconds', '1', '-Fps', '10'),
                          @('-Palette', 'Amber', '-Stats', '-Seconds', '1', '-Fps', '10')) {
            $r = Invoke-Rain $emptyHome $argv
            $r.ExitCode | Should -Be 0 -Because "of $($argv -join ' ')"
            $r.Stderr   | Should -BeNullOrEmpty
        }
    }
}
