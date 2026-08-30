# The script end to end. Everything else here tests a lib in isolation. These run the
# rain itself: the faults they cover exist only once the parts are wired up.
BeforeAll {
    $script:rain = Join-Path $PSScriptRoot '..\matrix.ps1'
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
        # Restore, do not null: a developer running the suite with a real
        # CLAUDE_CONFIG_DIR must not lose it from their process.
        $prevHome = $env:CLAUDE_CONFIG_DIR
        $env:CLAUDE_CONFIG_DIR = $claudeHome
        try {
            $p = Start-Process -FilePath $pwshExe -PassThru -Wait -NoNewWindow `
                    -RedirectStandardOutput $out -RedirectStandardError $err `
                    -ArgumentList ($pwshArgs + @('-NoProfile', '-File', $rain) + $argv)
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

# Windows only: the rain's input loop P/Invokes kernel32. The script itself cannot
# run elsewhere. The lib suites cover everything else cross-platform.
Describe 'matrix.ps1 -Sessions' -Skip:(-not $IsWindows) {
    It 'says so when there are no sessions, rather than dying on the empty list' {
        # A Mandatory collection parameter rejects an empty array before the body runs.
        # The lane function's own "no sessions" branch was unreachable, and the rain
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
        # The lane reads .Task off the session. The staple that puts it there must not
        # depend on -Click or -ThisWindow, the flags that ask for the tab map.
        $r = Invoke-Rain $liveHome @('-Sessions', '-Seconds', '2', '-Fps', '10')
        (Remove-Sgr $r.Stdout) | Should -Match 'zeppelin'
    }
}

Describe 'matrix.ps1' -Skip:(-not $IsWindows) {
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
