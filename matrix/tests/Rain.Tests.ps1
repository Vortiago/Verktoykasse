# The script end to end. Everything else here tests a lib in isolation; these run the
# rain itself, because the faults they cover only exist once the parts are wired up.
BeforeAll {
    $script:rain = Join-Path $PSScriptRoot '..\matrix.ps1'
    $script:pwshExe = (Get-Process -Id $PID).Path

    # A Claude home with no sessions in it at all.
    $script:emptyHome = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-rain-tests-$PID"
    New-Item -ItemType Directory -Path (Join-Path $emptyHome 'sessions') -Force | Out-Null

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
}

AfterAll {
    Remove-Item -LiteralPath $emptyHome -Recurse -Force -ErrorAction SilentlyContinue
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
