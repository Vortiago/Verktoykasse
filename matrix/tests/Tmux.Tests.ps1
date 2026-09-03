# The tmux answers to windows-terminal.ps1's six questions: which tmux session
# this pane lives in, which windows exist, and how a session finds its window.
# No server is involved - the tmux client call is a scriptblock seam, and the
# pid walk is injected. The parse helpers are pure, so Windows CI runs this
# file too.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/terminal/tmux.ps1')
    . (Join-Path $PSScriptRoot '../lib/terminal/tabmap.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')
    # list-panes -F rows join their fields on a tab character.
    $script:T = [char]9
}

Describe 'Resolve-MachineTab' {
    It 'answers nothing, and does not read the tabs to say so' {
        # The remote click is answered by the pid walk. The pane list carries no
        # title, so reading it would run a tmux process for nothing.
        $script:reads = 0
        Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:reads++; @() } | Should -BeNullOrEmpty
        $reads | Should -Be 0
    }
}

Describe 'ConvertTo-TmuxTab' {
    It 'shapes one list-panes row' {
        $row = @('$1', '@1', '2', '4242', '%1') -join $T
        $tab = ConvertTo-TmuxTab $row
        $tab.Hwnd   | Should -Be '$1'       # the owning SESSION id - the scope key
        $tab.Window | Should -Be '@1'       # what Select-TerminalTab targets
        $tab.Index  | Should -Be 1          # window_index 2, minus the 1-based print
        $tab.Pid    | Should -Be 4242       # what Resolve-SessionTab matches on
        $tab.Pane   | Should -Be '%1'       # part of the tab's identity
    }

    It 'shows the number tmux itself shows - window_index 0 is tab 0, not 1' {
        # tmux numbers windows from its base-index and prints that number in its
        # own status line, so the label is window_index, not a 1-based position
        # like Konsole's. window_index 0 (the default server's first window)
        # stores Index -1 for the shared "Index + 1" print and shows as tab 0.
        $row = @('$1', '@1', '0', '4242', '%1') -join $T
        (ConvertTo-TmuxTab $row).Index | Should -Be -1
    }

    It 'drops a row it cannot split' {
        ConvertTo-TmuxTab 'one field only' | Should -BeNullOrEmpty
    }
}

Describe 'Get-OwnTerminalWindow' {
    BeforeAll { $script:snap = Get-EnvSnapshot 'TMUX_PANE' }
    AfterAll  { Restore-EnvSnapshot $snap }

    It 'answers empty where no pane was exported' {
        Remove-Item Env:\TMUX_PANE -ErrorAction SilentlyContinue
        Get-OwnTerminalWindow -Call { throw 'unreachable' } | Should -Be ''
    }

    It 'asks the server for the pane''s own session, exactly' {
        # tmux sets TMUX_PANE before starting the shell in a pane, and display -p -t
        # answers for that pane alone. Unlike Windows, where the foreground window is
        # a guess, this is exact.
        $env:TMUX_PANE = '%0'
        $seen = @{}
        Get-OwnTerminalWindow -Call { param([string[]] $TmuxArgs)
            $seen.Args = $TmuxArgs
            '$5'
        } | Should -Be '$5'
        $seen.Args | Should -Contain '%0'
    }

    It 'answers empty when the server does not reply' {
        $env:TMUX_PANE = '%0'
        Get-OwnTerminalWindow -Call { throw 'server gone' } | Should -Be ''
    }
}

Describe 'Test-TabSupport' {
    # No dial seam: the function only reads preconditions, and the truthy-Hwnd
    # path is proved live by the rain test that runs the whole script.
    BeforeAll { $script:snap = Get-EnvSnapshot 'TMUX' }
    AfterAll  { Restore-EnvSnapshot $snap }

    It 'names the missing pane when tmux did not export one' {
        Remove-Item Env:\TMUX -ErrorAction SilentlyContinue
        Test-TabSupport -Hwnd 0 | Should -Be 'this shell is not running inside tmux'
    }

    It 'names the unreadable scope when the pane could not be asked' {
        $env:TMUX = 'stub,1,0'
        Test-TabSupport -Hwnd '' | Should -Be 'the rain could not read its own tmux session'
    }

    It 'answers empty once both preconditions hold' {
        $env:TMUX = 'stub,1,0'
        Test-TabSupport -Hwnd '$5' | Should -Be ''
    }
}

Describe 'Get-AllTerminalTab' {
    # The tmux call is a seam: the fake answers from canned list-panes output, the
    # function under test does the splitting and the shaping.
    BeforeAll {
        # Session $1 has two panes in window @1; session $2 has one in @2. One row
        # is malformed on purpose.
        $script:rows = @(
            (@('$1', '@1', '0', '4242', '%1') -join $T),
            (@('$1', '@1', '0', '4343', '%2') -join $T),
            (@('$2', '@2', '1', '9999', '%9') -join $T),
            'garbage'
        )
        $script:fake = {
            param([string[]] $TmuxArgs)
            if ($TmuxArgs[0] -ne 'list-panes') { throw "unexpected tmux $($TmuxArgs -join ' ')" }
            $script:rows -join "`n"
        }
        $script:badRows = {
            param([string[]] $TmuxArgs)
            if ($TmuxArgs[0] -eq 'list-panes') { throw 'no server running on /tmp/matrix-stub' }
            throw "unexpected tmux $($TmuxArgs -join ' ')"
        }
    }

    It 'lists one row per pane' {
        $tabs = @(Get-AllTerminalTab -Call $script:fake)
        $tabs.Count | Should -Be 3
    }
    It 'stamps each pane with the session that owns its window' {
        $tabs = @(Get-AllTerminalTab -Call $script:fake)
        $tabs | Where-Object { $_.Hwnd -eq '$1' } | Should -HaveCount 2
        $tabs | Where-Object { $_.Hwnd -eq '$2' } | Should -HaveCount 1
    }

    It 'carries the window both rows of a split click to' {
        $tabs = @(Get-AllTerminalTab -Call $script:fake)
        $panes = @($tabs | Where-Object { $_.Hwnd -eq '$1' })
        $panes[0].Window | Should -Be $panes[1].Window
        $panes[0].Pane   | Should -Not -Be $panes[1].Pane
    }

    It 'drops a row it cannot read' {
        @(Get-AllTerminalTab -Call $script:fake) | Where-Object { -not $_.Window } | Should -HaveCount 0
    }

    It 'answers nothing when the server has nothing to say' {
        @(Get-AllTerminalTab -Call $script:badRows) | Should -HaveCount 0
    }

    It 'asks tmux for exactly the five fields the parse reads' {
        # The rows above are only parseable because -F asked for these five fields
        # in this order. Every other fake here checks the subcommand and answers
        # from canned rows, so none of them would notice the format going missing -
        # and an empty -F makes tmux print blank lines, which reads upstream as a
        # server with no panes at all.
        $seen = @{}
        [void](Get-AllTerminalTab -Call { param([string[]] $TmuxArgs) $seen.Args = $TmuxArgs; '' })
        $seen.Args | Should -Be @('list-panes', '-a', '-F', $script:TmuxFormat)
        @($script:TmuxFormat -split $T) | Should -Be @('#{session_id}', '#{window_id}',
                                                       '#{window_index}', '#{pane_pid}', '#{pane_id}')
    }
}

Describe 'Invoke-Tmux' {
    # The one function no seam covers: the fork itself. This process stands in for
    # the tmux binary, because the contract under test is "hand back stdout, and
    # throw with stderr on a non-zero exit" - not tmux's own argv. Runs on both CI
    # platforms for the same reason.
    BeforeAll {
        # pwsh installed as a dotnet global tool runs under the muxer: the process
        # path alone cannot relaunch it, the way Rain.Tests.ps1 relaunches the rain.
        $script:exe = [Environment]::ProcessPath
        $script:pre = if ([IO.Path]::GetFileNameWithoutExtension($exe) -eq 'dotnet') {
                          @(Join-Path $PSHOME 'pwsh.dll')
                      } else { @() }
    }

    It 'hands back what the client wrote to stdout' {
        # A tmux-shaped row, tab and all: nothing between the fork and the parse
        # rewraps or re-splits what the client printed.
        Invoke-Tmux -Tmux $exe -TmuxArgs ($pre + @('-NoProfile', '-Command',
            "[Console]::Out.Write('`$0' + [char]9 + '@0')")) | Should -Be "`$0$T@0"
    }

    It 'throws with the stderr text when the client exits non-zero' {
        # tmux says why on stderr, and a raw write there would land on the alt
        # screen mid-frame and shear it. So it comes back as a message instead -
        # which is also the only place a caller could ever see it.
        { Invoke-Tmux -Tmux $exe -TmuxArgs ($pre + @('-NoProfile', '-Command',
            '[Console]::Error.Write("no server running"); exit 1')) } |
            Should -Throw -ExpectedMessage '*no server running*'
    }

    It 'names the call when there is no tmux to run' {
        { Invoke-Tmux -Tmux 'matrix-no-such-binary' -TmuxArgs @('list-panes', '-a') } |
            Should -Throw -ExpectedMessage '*list-panes -a*'
    }
}

Describe 'Select-TerminalTab' {
    It 'switches the client to the window that holds the pane' {
        # The recorder is a hashtable the fake mutates in place: script-scope
        # variables set inside an invoked scriptblock do not survive to the It.
        $seen = @{}
        $fake = { param([string[]] $TmuxArgs) $seen.Args = $TmuxArgs }
        $tab = [pscustomobject]@{ Hwnd = '$1'; Window = '@2'; Pane = '%1'; Index = 2 }
        Select-TerminalTab -Tab $tab -Call $fake | Should -BeTrue
        $seen.Args | Should -Be @('select-window', '-t', '@2')
    }

    It 'answers false when the switch fails' {
        $tab = [pscustomobject]@{ Hwnd = '$1'; Window = '@2'; Pane = '%1'; Index = 2 }
        Select-TerminalTab -Tab $tab -Call { throw 'window killed' } | Should -BeFalse
    }
}

Describe 'Get-TabKey' {
    # A tab's identity is the pane, not the window: two panes of one window are two
    # rows with the same destination, and keying on the window would let one
    # session's carried tab block the other's in Merge-SessionTab.
    It 'tells two panes of one window apart' {
        $a = [pscustomobject]@{ Hwnd = '$1'; Window = '@1'; Pane = '%1'; Index = 0; Pid = 10 }
        $b = [pscustomobject]@{ Hwnd = '$1'; Window = '@1'; Pane = '%2'; Index = 0; Pid = 20 }
        Get-TabKey $a | Should -Not -Be (Get-TabKey $b)
    }

    It 'stays put across a renumbered window' {
        $before = [pscustomobject]@{ Hwnd = '$1'; Window = '@7'; Pane = '%1'; Index = 0; Pid = 10 }
        $after  = [pscustomobject]@{ Hwnd = '$1'; Window = '@7'; Pane = '%1'; Index = 3; Pid = 10 }
        Get-TabKey $before | Should -Be (Get-TabKey $after)
    }
}

Describe 'Resolve-SessionTab' {
    # pane_pid is the pane's root process, and the last hop of a claude pid's
    # /proc walk inside a pane is exactly that process - the tmux twin of
    # Konsole's exact pid match. No title scoring: tmux window names say
    # nothing usable.
    BeforeAll {
        # The process tree: tmux() -> bash(10) -> claude(100); and separately
        # bash(20) -> ollama(200) -> claude(101). Panes %1 and %2 share window @1;
        # pane %3 sits in session $2. Pane %4 runs bash(30) with nothing under it.
        $script:tabs = @(
            [pscustomobject]@{ Hwnd = '$1'; Index = 0; Window = '@1'; Pid = 10; Pane = '%1' },
            [pscustomobject]@{ Hwnd = '$1'; Index = 0; Window = '@1'; Pid = 20; Pane = '%2' },
            [pscustomobject]@{ Hwnd = '$2'; Index = 1; Window = '@2'; Pid = 30; Pane = '%3' }
        )
        # pid -> its ancestors, including itself.
        $script:tree = @{
            100 = @(100, 10, 1)           # plain child of the pane's shell
            101 = @(101, 200, 20)         # claude nested under a wrapper
            999 = @(999, 555)             # lives outside every pane
        }
        $script:walk = { param([int] $ProcessId) $script:tree[$ProcessId] }
    }

    It 'matches a session running directly under the pane shell' {
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'A' -ProcessId 100)) -Tab $tabs -Ancestors $walk
        $map['A'].Pane | Should -Be '%1'
        $map['A'].Window | Should -Be '@1'
    }

    It 'matches a session nested under a wrapper process' {
        # claude is often not the pane shell's direct child: bash -> ollama -> claude.
        # Walking down from the pane would never find it; walking up from the
        # session does.
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'B' -ProcessId 101)) -Tab $tabs -Ancestors $walk
        $map['B'].Pane | Should -Be '%2'
    }

    It 'leaves a session outside every pane unmatched' {
        # The ssh-hosted case: the session's pid is not in this server's tree.
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'C' -ProcessId 999)) -Tab $tabs -Ancestors $walk
        $map.Count | Should -Be 0
    }

    It 'matches two sessions of one window to their own panes' {
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'A' -ProcessId 100), (New-TestSession -Id 'B' -ProcessId 101)) `
                                  -Tab $tabs -Ancestors $walk
        $map['A'].Pane | Should -Be '%1'
        $map['B'].Pane | Should -Be '%2'
    }

    It 'survives having nothing to work with' {
        (Resolve-SessionTab -Session @() -Tab $tabs -Ancestors $walk).Count | Should -Be 0
        (Resolve-SessionTab -Session @((New-TestSession -Id 'A' -ProcessId 100)) -Tab @() -Ancestors $walk).Count |
            Should -Be 0
    }
}

Describe 'the tmux backend against the tab map' {
    # One round trip through Update-SessionTabMap with the fake reader, to prove
    # the pane-shaped objects satisfy everything above them: Get-TabKey for the
    # carry, Resolve-SessionTab for the fresh match. The walk is a scope function,
    # because Update-SessionTabMap reaches Resolve-SessionTab without a seam.
    BeforeAll {
        function script:Get-ProcessAncestorId { param([int] $ProcessId) @{ 100 = @(100, 10) }[$ProcessId] }
        $script:tabs = @(
            [pscustomobject]@{ Hwnd = '$1'; Index = 0; Window = '@1'; Pid = 10; Pane = '%1' }
        )
        $script:readTab = { $script:tabs }
        $script:state = New-TabState
        $script:clock = [System.Diagnostics.Stopwatch]::StartNew()
    }

    # Take the stub back out: a scope function outlives the block that defined it,
    # and the real Get-ProcessAncestorId is what every file after this one wants.
    AfterAll { Remove-Item -LiteralPath 'Function:\Get-ProcessAncestorId' -ErrorAction SilentlyContinue }

    It 'lands a session in its pane the first time it is asked' {
        Update-SessionTabMap -Session @((New-TestSession -Id 'A' -ProcessId 100)) `
                             -State $state -ReadTab $readTab -Now $clock.ElapsedMilliseconds
        $state.Map['A'].Pane | Should -Be '%1'
        $state.RetryAt | Should -Be 0
    }
}
