# The script end to end. Everything else here tests a lib in isolation. These run the
# rain itself: the faults they cover exist only once the parts are wired up.
BeforeAll {
    $script:rain = Join-Path $PSScriptRoot '../matrix.ps1'
    # For Get-TestProcStart: the fake registry's live record must carry the same
    # procStart this platform's Claude writes. Fixtures reads it through
    # sessions.ps1, so both are sourced.
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/sessions.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')
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
    $start = Get-TestProcStart
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
        $snap = Get-EnvSnapshot 'CLAUDE_CONFIG_DIR'
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
            Restore-EnvSnapshot $snap
            Remove-Item $out, $err -Force -ErrorAction SilentlyContinue
        }
    }

    # Header text survives the frame diff as one run. Strip the colour changes and
    # it is greppable.
    function Remove-Sgr ([string] $Text) { $Text -replace "$([char]27)\[[0-9;?]*[A-Za-z]", '' }

    # The remote cases need the rain running while the test talks to it, so this
    # is Invoke-Rain without the wait. The caller stops it and reads the output.
    function Start-RainAsync ($claudeHome, [string[]] $argv, $script = $rain) {
        $stem = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-async-$PID-$(Get-Random)"
        $snap = Get-EnvSnapshot 'CLAUDE_CONFIG_DIR'
        $env:CLAUDE_CONFIG_DIR = $claudeHome
        try {
            $p = Start-Process -FilePath $pwshExe -PassThru -NoNewWindow `
                    -RedirectStandardOutput "$stem.out" -RedirectStandardError "$stem.err" `
                    -ArgumentList ($pwshArgs + @('-NoProfile', '-File', $script) + $argv)
            @{ Process = $p; Out = "$stem.out"; Err = "$stem.err" }
        } finally { Restore-EnvSnapshot $snap }
    }

    function Stop-RainAsync ($Run) {
        # -Seconds stops it on its own. This is the backstop for a case that fails
        # before then, so a failing test leaves no rain behind.
        if (-not $Run.Process.HasExited) {
            try { $Run.Process.Kill() } catch { }
        }
        [void]$Run.Process.WaitForExit(5000)
        $out = Get-Content -LiteralPath $Run.Out -Raw -ErrorAction SilentlyContinue
        $err = Get-Content -LiteralPath $Run.Err -Raw -ErrorAction SilentlyContinue
        Remove-Item "$($Run.Out)", "$($Run.Err)" -Force -ErrorAction SilentlyContinue
        [pscustomobject]@{ Stdout = $out; Stderr = $err; ExitCode = $Run.Process.ExitCode }
    }

    # A free loopback port, found by taking one and letting it go. Nothing here
    # may use the real 9999: a developer running the suite may have a rain up.
    function Get-FreePort {
        $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
        $l.Start()
        try { $l.LocalEndpoint.Port } finally { $l.Stop() }
    }

    # One -ExposeOnSSH run against a listener playing the rain: take the
    # report's connection, hand it to $Answer, give back what the run drew.
    #
    # Read after the run ENDS. A redirected stdout cannot be opened while the
    # child holds it, so a mid-run read answers nothing and a wait on one is
    # only sitting out the run and calling that a pass.
    function Invoke-ExposeRain ($claudeHome, [string[]] $argv, [scriptblock] $Answer) {
        $port = Get-FreePort
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        $listener.Start()
        $run = $null; $conn = $null
        try {
            $run = Start-RainAsync $claudeHome (@('-Fps', '10', '-ExposeOnSSH',
                                                  '-RemotePort', "$port") + $argv)
            (Wait-Until -TimeoutMs 20000 -StepMs 20 -Condition { $listener.Pending() }) |
                Should -BeTrue -Because 'the report should dial in'
            $conn = $listener.AcceptTcpClient()
            & $Answer $conn
            (Wait-Until -TimeoutMs 20000 -StepMs 100 -Condition { $run.Process.HasExited }) |
                Should -BeTrue -Because '-Seconds should stop the rain on its own'
        } finally {
            if ($conn) { try { $conn.Dispose() } catch { } }
            $listener.Stop()
            $r = if ($run) { Stop-RainAsync $run } else { $null }
        }
        $r
    }
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

# Another machine's sessions, end to end. The test plays the part of the machine.
# It connects to the rain's port over loopback, exactly as the reporting side
# would, and that is what the ssh forward delivers anyway. Nothing here needs ssh,
# and both runners run all of it.
Describe 'matrix.ps1 -Remote' {
    It 'shows a machine that reports in, and names it in the lane' {
        $port = Get-FreePort
        $run = Start-RainAsync $emptyHome @('-Seconds', '12', '-Fps', '10',
                                            '-Remote', '-RemotePort', "$port")
        $client = $null
        try {
            # The rain compiles on a first run, so the port is not there at once.
            $client = [System.Net.Sockets.TcpClient]::new()
            (Wait-Until -TimeoutMs 15000 -StepMs 50 -Condition {
                try { $client.Connect('127.0.0.1', $port); $true } catch { $false }
            }) | Should -BeTrue -Because 'the rain should be listening within the timeout'

            $stream = $client.GetStream()
            $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $hello = '{"v":1,"t":"hello","machine":"orkanger","token":"","now":' + $now + '}'
            $frame = '{"v":1,"t":"frame","seq":1,"now":' + $now + ',"sessions":[' +
                     '{"id":"r1","status":"busy","waitingFor":"","title":"kaleidoscope",' +
                     '"task":"","startedAt":' + $now + ',"updatedAt":' + $now + '}]}'
            foreach ($line in @($hello, $frame)) {
                $b = [System.Text.Encoding]::UTF8.GetBytes("$line`n")
                $stream.Write($b, 0, $b.Length); $stream.Flush()
            }
            # The answer the reporting side's -Stats line reads.
            (Wait-Until -TimeoutMs 15000 -StepMs 50 -Condition { $client.Available -gt 0 }) |
                Should -BeTrue -Because 'the rain should answer the hello'
            $buf = [byte[]]::new(4096)
            $n = $stream.Read($buf, 0, $buf.Length)
            $answer = ConvertFrom-Json (([System.Text.Encoding]::UTF8.GetString($buf, 0, $n) -split "`n")[0])
            $answer.t | Should -Be 'welcome'
            # Frames stop after this one, so the lane goes offline five seconds
            # later. Give the rain a moment to draw it before that.
            Start-Sleep -Milliseconds 1500
        } finally {
            if ($client) { try { $client.Dispose() } catch { } }
            $r = Stop-RainAsync $run
        }
        $r.Stderr | Should -Not -Match 'Exception'
        $text = Remove-Sgr $r.Stdout
        $text | Should -Match 'orkanger'
        $text | Should -Match 'kaleidoscope'
    }

    It 'says it is waiting when no machine has reported' {
        # An empty screen with no explanation is the failure this wording exists
        # to prevent: the user cannot tell a quiet network from a wrong port.
        $port = Get-FreePort
        $r = Invoke-Rain $emptyHome @('-Seconds', '2', '-Fps', '10',
                                      '-Remote', '-RemotePort', "$port")
        $r.ExitCode | Should -Be 0
        (Remove-Sgr $r.Stdout) | Should -Match 'waiting for a machine to report'
    }

    It 'keeps drawing local lanes when the port is already taken' {
        # A second rain on one machine must say what is wrong and carry on. Dying
        # at startup would make the flag worse than not having it.
        $held = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
        $held.Start()
        try {
            $r = Invoke-Rain $liveHome @('-Seconds', '2', '-Fps', '10',
                                         '-Remote', '-RemotePort', "$($held.LocalEndpoint.Port)")
            $r.ExitCode | Should -Be 0
            (Remove-Sgr $r.Stdout) | Should -Match 'cannot listen'
            (Remove-Sgr $r.Stdout) | Should -Match 'zeppelin'
        } finally { $held.Stop() }
    }
}

Describe 'matrix.ps1 -ExposeOnSSH' {
    It 'reports this machine to a listener while it draws' {
        $r = Invoke-ExposeRain $liveHome @('-Seconds', '10', '-RemoteName', 'orkanger') {
            param($conn)
            $stream = $conn.GetStream()
            $script:text = ''
            $buf = [byte[]]::new(8192)
            (Wait-Until -TimeoutMs 15000 -StepMs 50 -Condition {
                if ($conn.Available -gt 0) {
                    $n = $stream.Read($buf, 0, $buf.Length)
                    $script:text += [System.Text.Encoding]::UTF8.GetString($buf, 0, $n)
                }
                ($script:text -split "`n").Count -ge 3   # hello, one frame, and the rest
            }) | Should -BeTrue -Because 'a hello and a frame should arrive'

            $lines = @($script:text -split "`n" | Where-Object { $_ })
            $hello = ConvertFrom-Json $lines[0]
            $hello.t | Should -Be 'hello'
            $hello.machine | Should -Be 'orkanger'
            $frame = ConvertFrom-Json $lines[1]
            $frame.t | Should -Be 'frame'
            @($frame.sessions).Count | Should -BeGreaterThan 0
        }
        # The other half of the flag: it draws the local session as well as
        # reporting it.
        (Remove-Sgr $r.Stdout) | Should -Match 'zeppelin'
        $r.Stdout | Should -Match ([regex]::Escape("$([char]27)[?1049h"))
    }

    # Each case reads the FIRST line its rain stamps: the screen is diffed, so a
    # later change arrives as moved cells and cannot be grepped whole.
    # -PollSeconds 0.2 puts an answer in before that line falls due.
    It 'says it is connecting while the host has not answered' {
        # sshd accepts whether or not a rain is behind it, so this is exactly
        # what a host running no rain looks like, for as long as it lasts.
        $r = Invoke-ExposeRain $emptyHome @('-Seconds', '5', '-Stats', '-PollSeconds', '0.2') {
            param($conn)
        }
        $text = Remove-Sgr $r.Stdout
        $text | Should -Match 'host connecting'
        $text | Should -Not -Match 'host connected'
    }

    It 'says it is connected once the host welcomes it' {
        $r = Invoke-ExposeRain $emptyHome @('-Seconds', '5', '-Stats', '-PollSeconds', '0.2') {
            param($conn)
            $stream = $conn.GetStream()
            $welcome = [System.Text.Encoding]::UTF8.GetBytes('{"v":1,"t":"welcome"}' + "`n")
            $stream.Write($welcome, 0, $welcome.Length); $stream.Flush()
        }
        (Remove-Sgr $r.Stdout) | Should -Match 'host connected'
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
        # The split is the point of the line: our build time and the time blocked
        # in the terminal are the two answers, and one number could not tell them
        # apart.
        (Remove-Sgr $r.Stdout) | Should -Match 'build'
        (Remove-Sgr $r.Stdout) | Should -Match 'write'
        (Remove-Sgr $r.Stdout) | Should -Match 'runs'
        (Remove-Sgr $r.Stdout) | Should -Match 'fps'

        $plain = Invoke-Rain $emptyHome @('-Seconds', '3', '-Fps', '20') $preview
        (Remove-Sgr $plain.Stdout) | Should -Not -Match 'build'
    }
}

Describe 'matrix.ps1 inside tmux' {
    # Which backend runs is decided by $TMUX, and that decision only shows at the
    # process boundary: with TMUX set, the rain must go and ask tmux. The stub
    # binary records every argv it is handed into $TMUX_STUB_LOG and answers the
    # two reads the rain makes, so the run reaches a real frame, and the log
    # proves which backend was loaded.
    BeforeAll {
        $script:stubDir = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-tmux-stub-$PID"
        New-Item -ItemType Directory -Path $stubDir -Force | Out-Null
        $script:stubLog = Join-Path $stubDir 'calls.log'
        # A POSIX stub: answer the own-session read, list one pane in each of two
        # sessions, exit 0 for anything else (select-window). The -replace keeps a
        # CRLF checkout's line endings out of the shebang - sh would read
        # '#!/bin/sh\r' and refuse to exec it, failing this Linux-only test
        # somewhere far from the cause.
        Set-Content -LiteralPath (Join-Path $stubDir 'tmux') -Encoding utf8NoBOM `
            -Value (@'
#!/bin/sh
printf '%s\n' "$*" >> "$TMUX_STUB_LOG"
case "$*" in
    *display-message*) echo '$5' ;;
    *list-panes*)
        printf '$1\t@1\t0\t4242\t%%1\n$2\t@2\t0\t9999\t%%9\n' ;;
esac
'@ -replace "`r", '')
        if (-not $IsWindows) { & chmod +x (Join-Path $stubDir 'tmux') }
    }

    AfterAll {
        Remove-Item $stubDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    It 'asks tmux, not the outer terminal, when TMUX is set' -Skip:($IsWindows) {
        Remove-Item (Join-Path $stubDir 'calls.log') -ErrorAction SilentlyContinue
        $snap = Get-EnvSnapshot 'TMUX', 'TMUX_PANE', 'TMUX_STUB_LOG', 'PATH'
        try {
            # TMUX names the innermost server, so matrix must pick the tmux backend
            # even though no Konsole variable exists in this child.
            $env:TMUX = 'stub,1,0'
            $env:TMUX_PANE = '%0'
            $env:TMUX_STUB_LOG = $stubLog
            $env:PATH = "$stubDir$([System.IO.Path]::PathSeparator)$env:PATH"
            # liveHome, not emptyHome: the tab map is only rebuilt when a session
            # exists, so the stub's list-panes - the call that names the backend -
            # would never run against an empty one. The stub's own session ('$5')
            # owns neither listed pane ('$1', '$2'), so -ThisWindow drops the lane
            # whether or not the pid walk placed it, and the empty header proves
            # the tmux wording rather than the pid match.
            $r = Invoke-Rain $liveHome @('-Seconds', '2', '-Fps', '10', '-ThisWindow')
            $r.ExitCode | Should -Be 0
            $r.Stderr | Should -Not -Match 'Konsole'
                (Remove-Sgr $r.Stdout) | Should -Match 'none in this tmux session'
            $calls = @(Get-Content -LiteralPath $stubLog -ErrorAction SilentlyContinue)
            $calls | Where-Object { $_ -match '^display-message' } | Should -Not -BeNullOrEmpty
            $calls | Where-Object { $_ -match '^list-panes' }      | Should -Not -BeNullOrEmpty
        } finally {
            Restore-EnvSnapshot $snap
        }
    }
}

