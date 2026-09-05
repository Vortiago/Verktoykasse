# The title the reporting side writes onto the tab holding its own ssh session.
#
# Every seam is injected, so the whole file runs on both platforms: no tmux, no
# ssh, and no character device. The one real write goes to a temp file, which
# answers the same FileStream calls a tty does.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/wire.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/title.ps1')
    # The other half of the contract: the scorer that reads what this writes. It
    # defers every Add-Type to Initialize-Uia, so sourcing it costs nothing here.
    . (Join-Path $PSScriptRoot '../lib/terminal/windows-terminal.ps1')

    # $script:ESC comes from console.ps1. BEL has no constant there, because
    # nothing else in the rain ends a sequence with one.
    $script:BEL = [char]7
}

Describe 'title: the sequence' {
    It 'wraps user@machine in an OSC 0' {
        # OSC 0 sets the icon name AND the window title. Windows Terminal shows
        # the latter on the tab, which is what Resolve-MachineTab reads.
        Get-TabTitleSequence -Machine 'lab1' -User 'atle' |
            Should -Be "$script:ESC]0;atle@lab1$script:BEL"
    }

    It 'says matrix when the machine reports no user name' {
        # Never the bare machine name: Get-MachineTitleScore scores an @ form 2
        # and a bare word 1, and the whole point is to stop competing with a
        # tab that merely mentions the machine.
        Get-TabTitleSequence -Machine 'lab1' -User '' |
            Should -Be "$script:ESC]0;matrix@lab1$script:BEL"
    }

    It 'filters a user name that carries an escape' {
        # A user name is environment text. An ESC inside it would end this
        # sequence and start whatever the rest of the name spells.
        Get-TabTitleSequence -Machine 'lab1' -User "at$($script:ESC)le" |
            Should -Be "$script:ESC]0;at le@lab1$script:BEL"
    }

    It 'caps the user name' {
        Get-TabTitleSequence -Machine 'lab1' -User ('a' * 100) |
            Should -Be "$script:ESC]0;$('a' * 32)@lab1$script:BEL"
    }

    It 'trims the ends rather than titling a tab with a space' {
        Get-TabTitleSequence -Machine 'lab1' -User '  atle  ' |
            Should -Be "$script:ESC]0;atle@lab1$script:BEL"
    }

    It 'writes what the host scores highest' {
        # The two ends of this feature are on different machines and in
        # different files, and nothing else crosses them: the producer runs on
        # the reporting side, the scorer on Windows. Tighten Get-MachineTitleScore
        # without this and every remote click breaks with the suite still green.
        $title = Get-TabTitleSequence -Machine 'lab1' -User 'atle'
        # As the tab carries it: Get-TerminalTab hands Resolve-MachineTab the
        # name alone, without the sequence around it.
        $shown = $title.Trim($script:ESC, $script:BEL) -replace '^\]0;', ''
        Get-MachineTitleScore -Title $shown -Machine 'lab1' | Should -Be 2
    }
}

Describe 'title: finding the tty under tmux' {
    It 'asks tmux for the attached client tty' {
        # client_tty is the pty sshd allocated for this login. tmux runs on top
        # of it, so a write there goes out under tmux and reaches the terminal.
        $script:asked = $null
        $call = { param($TmuxArgs) $script:asked = $TmuxArgs; "/dev/pts/3`n" }
        Get-TmuxClientTty -Call $call | Should -Be '/dev/pts/3'
        $script:asked -join ' ' | Should -Be 'display-message -p #{client_tty}'
    }

    It 'answers nothing when tmux fails' {
        # No server, no client, or no tmux at all. The caller falls back to
        # stdout, and a poll must not carry a throw.
        Get-TmuxClientTty -Call { throw 'no server running' } | Should -Be ''
    }

    It 'answers nothing for a path that is not a device' {
        # The write below opens whatever this names. tmux is ours, but a stray
        # answer must not be able to point the write at a file.
        Get-TmuxClientTty -Call { 'no client' } | Should -Be ''
        Get-TmuxClientTty -Call { '/etc/passwd ; rm' } | Should -Be ''
        Get-TmuxClientTty -Call { '' } | Should -Be ''
    }

    It 'answers nothing when no tmux backend is loaded' {
        # The seam defaults to ${function:Invoke-Tmux}, which resolves to $null
        # wherever tmux.ps1 was not sourced. That is Windows and Konsole.
        Get-TmuxClientTty -Call $null | Should -Be ''
    }
}

Describe 'title: the tmux route' {
    It 'writes the sequence to the tty it was given' {
        $script:wrote = ''
        Write-TmuxClientTitle -Text 'seq' -Tty { '/dev/pts/3' } `
                              -Write { param($p, $t) $script:wrote = "$p|$t" } | Should -BeTrue
        $script:wrote | Should -Be '/dev/pts/3|seq'
    }

    It 'answers false when no client is attached' {
        # A tmux server nobody is looking at. There is no tab to title.
        $script:wrote = ''
        Write-TmuxClientTitle -Text 'seq' -Tty { '' } `
                              -Write { param($p, $t) $script:wrote = "$p|$t" } | Should -BeFalse
        $script:wrote | Should -Be ''
    }
}

Describe 'title: where the write goes' {
    BeforeEach {
        $script:tmux = [System.Collections.Generic.List[string]]::new()
        $script:out = [System.Collections.Generic.List[string]]::new()
        $script:writeTmux = { param($t) $script:tmux.Add($t); $true }
        $script:writeOut = { param($t) $script:out.Add($t) }
    }

    It 'takes the tmux route when this is a tmux pane' {
        $wrote = Set-RemoteTabTitle -Machine 'lab1' -User 'atle' -Tmux '/tmp/tmux-1000/default,42,0' `
                                    -WriteTmux $script:writeTmux -Write $script:writeOut
        $wrote | Should -BeTrue
        $script:tmux | Should -Be "$script:ESC]0;atle@lab1$script:BEL"
        # stdout under tmux reaches the pane and stops there. Writing both would
        # retitle the pane as well, which is not this machine's tab.
        $script:out.Count | Should -Be 0
    }

    It 'writes to stdout when this is not a tmux pane' {
        $wrote = Set-RemoteTabTitle -Machine 'lab1' -User 'atle' -Tmux '' `
                                    -WriteTmux $script:writeTmux -Write $script:writeOut
        $wrote | Should -BeTrue
        $script:out | Should -Be "$script:ESC]0;atle@lab1$script:BEL"
        # No tmux, no fork to ask one anything.
        $script:tmux.Count | Should -Be 0
    }

    It 'falls back to stdout when no tmux client is attached' {
        $wrote = Set-RemoteTabTitle -Machine 'lab1' -User 'atle' -Tmux 'default,42,0' `
                                    -WriteTmux { $false } -Write $script:writeOut
        $wrote | Should -BeTrue
        $script:out.Count | Should -Be 1
    }

    It 'swallows a write that fails' {
        # A tty that went away between the lookup and the open. This runs on the
        # poll path of a frame loop and must never throw into it.
        { Set-RemoteTabTitle -Machine 'lab1' -Tmux 'default' -WriteTmux { throw 'gone' } `
                             -Write $script:writeOut } | Should -Not -Throw
    }

    It 'reports nothing written when there is nowhere to write' {
        Set-RemoteTabTitle -Machine 'lab1' -Tmux '' -Write $null | Should -BeFalse
    }
}

Describe 'title: the real write' {
    It 'puts the bytes on the device' {
        # A tty is opened, never created or truncated, and never appended to:
        # append wants a seek a character device does not have. A temp file
        # answers the same calls, which is what makes this runnable on Windows.
        $path = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-title-$([guid]::NewGuid()).tmp"
        [System.IO.File]::WriteAllText($path, '')
        try {
            Write-TtyText -Path $path -Text "$script:ESC]0;atle@lab1$script:BEL"
            [System.IO.File]::ReadAllText($path) | Should -Be "$script:ESC]0;atle@lab1$script:BEL"
        } finally { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
    }
}
