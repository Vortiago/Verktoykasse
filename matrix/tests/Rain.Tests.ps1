# The script end to end. Everything else here tests a lib in isolation. These run the
# rain itself: the faults they cover exist only once the parts are wired up.
BeforeAll {
    $script:rain = Join-Path $PSScriptRoot '../matrix.ps1'
    # For Get-ProcessStartTicks: the fake registry's live record must carry the
    # same procStart this platform's Claude writes.
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/sessions.ps1')
    # pwsh installed as a dotnet global tool runs under the dotnet muxer. The process
    # path alone cannot relaunch it: the muxer needs pwsh.dll as its first argument.
    $script:pwshExe  = [Environment]::ProcessPath
    $script:pwshArgs = @()
    if ([IO.Path]::GetFileNameWithoutExtension($pwshExe) -eq 'dotnet') {
        $script:pwshArgs = @(Join-Path $PSHOME 'pwsh.dll')
    }

    # A Claude home with no sessions in it at all.
    $script:emptyHome = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-tests-$PID"
    New-Item -ItemType Directory -Path (Join-Path $emptyHome 'sessions') -Force | Out-Null

    # A Claude home with one genuinely live session: this process, which outlives
    # every child the tests start. Its transcript carries a word nothing else in a
    # frame could produce.
    $script:liveHome = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-live-$PID"
    $script:liveTask = 'zeppelin over the harbour'
    New-Item -ItemType Directory -Path (Join-Path $liveHome 'sessions') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $liveHome 'projects/P') -Force | Out-Null
    # The registry start time is a FILETIME on Windows and /proc clock ticks on
    # Linux; Get-ProcessStartTicks (sessions.ps1, sourced above) reads the one
    # this platform's Claude writes.
    $start = if ($IsWindows) {
        [System.Diagnostics.Process]::GetCurrentProcess().StartTime.ToFileTimeUtc()
    } else {
        Get-ProcessStartTicks -ProcessId $PID
    }
    @{  pid       = $PID
        procStart = "$start"
        sessionId = 'sid-live'; kind = 'interactive'; name = 'sid-live'
        cwd       = 'D:\repos\matrix'; status = 'busy'
        startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        statusUpdatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    } | ConvertTo-Json -Compress |
        Set-Content -LiteralPath (Join-Path $liveHome "sessions/$PID.json") -Encoding utf8
    (@{ type = 'user'; message = @{ content = $liveTask } } | ConvertTo-Json -Compress -Depth 5) |
        Set-Content -LiteralPath (Join-Path $liveHome 'projects/P/sid-live.jsonl') -Encoding utf8

    function Invoke-Rain ($claudeHome, [string[]] $argv, $script = $rain) {
        $out = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-$PID.out"
        $err = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-$PID.err"
        # Restore, do not null: a developer running the suite with a real
        # CLAUDE_CONFIG_DIR must not lose it from their process.
        $prevHome = $env:CLAUDE_CONFIG_DIR
        $env:CLAUDE_CONFIG_DIR = $claudeHome
        try {
            $p = Start-Process -FilePath $pwshExe -PassThru -Wait -NoNewWindow `
                    -RedirectStandardOutput $out -RedirectStandardError $err `
                    -ArgumentList ($pwshArgs + @('-NoProfile', '-File', $script) + $argv)
            [pscustomobject]@{
                ExitCode = $p.ExitCode
                Stdout   = (Get-Content -LiteralPath $out -Raw -ErrorAction SilentlyContinue)
                Stderr   = (Get-Content -LiteralPath $err -Raw -ErrorAction SilentlyContinue)
            }
        } finally {
            $env:CLAUDE_CONFIG_DIR = $prevHome
            Remove-Item $out, $err -Force -ErrorAction SilentlyContinue
        }
    }

    # Header text survives the frame diff as one run. Strip the colour changes and
    # it is greppable.
    function Remove-Sgr ([string] $Text) { $Text -replace "$([char]27)\[[0-9;?]*[A-Za-z]", '' }
}

AfterAll {
    Remove-Item -LiteralPath $emptyHome, $liveHome -Recurse -Force -ErrorAction SilentlyContinue
}

# The rain itself, end to end. It runs the same on every platform now: Windows
# reads the console API, Linux reads termios and SGR mouse, and neither fact is
# visible from the process boundary.
Describe 'matrix.ps1' {
    It 'says so when there are no sessions, rather than dying on the empty list' {
        # A Mandatory collection parameter rejects an empty array before the body runs.
        # The lane function's own "no sessions" branch was unreachable, and the rain
        # quit with "Cannot bind argument to parameter 'Live'". This is the FIRST thing
        # anyone sees, and only ever on a machine with nothing running.
        $r = Invoke-Rain $emptyHome @('-Seconds', '2', '-Fps', '10')
        $r.Stderr   | Should -Not -Match 'Cannot bind argument'
        $r.ExitCode | Should -Be 0
        $r.Stdout   | Should -Match 'no claude sessions'
    }

    It 'draws a live session, status and all' {
        $r = Invoke-Rain $liveHome @('-Seconds', '2', '-Fps', '10')
        $r.ExitCode | Should -Be 0
        (Remove-Sgr $r.Stdout) | Should -Match 'working'
    }

    It 'puts the task in the header whether or not tabs are wanted' {
        # The lane reads .Task off the session. The staple that puts it there must not
        # depend on -Click or -ThisWindow, the flags that ask for the tab map.
        $r = Invoke-Rain $liveHome @('-Seconds', '2', '-Fps', '10')
        (Remove-Sgr $r.Stdout) | Should -Match 'zeppelin'
    }
}

Describe 'preview-matrix.ps1' {
    # The preview renders the same lanes from the style file, with no session
    # reads behind them: it is where the render alone can be timed.
    BeforeAll {
        $script:preview = Join-Path $PSScriptRoot '../preview-matrix.ps1'
    }

    It 'shows the render stats when asked, and not otherwise' {
        # -Stats puts fps, build time and bytes on the bottom line, the same
        # numbers matrix.ps1 shows, so the render can be judged without the
        # session polling in the way.
        $r = Invoke-Rain $emptyHome @('-Seconds', '3', '-Fps', '20', '-Stats') $preview
        $r.ExitCode | Should -Be 0
        (Remove-Sgr $r.Stdout) | Should -Match 'ms/frame'
        (Remove-Sgr $r.Stdout) | Should -Match 'fps'

        $plain = Invoke-Rain $emptyHome @('-Seconds', '3', '-Fps', '20') $preview
        (Remove-Sgr $plain.Stdout) | Should -Not -Match 'ms/frame'
    }
}

