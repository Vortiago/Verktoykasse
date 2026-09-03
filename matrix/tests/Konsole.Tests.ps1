# The Konsole answers to windows-terminal.ps1's six questions: which window
# this shell lives in, which tabs exist, and how a session finds its tab. No bus is
# involved - the D-Bus call is a scriptblock seam, and the pid walk is injected.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/terminal/konsole.ps1')
    # tabmap.ps1 too: Resolve-SessionTab is a two-line wrapper over the pid matcher
    # that lives there, because tmux's pane_pid takes the same walk.
    . (Join-Path $PSScriptRoot '../lib/terminal/tabmap.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')
}

Describe 'Resolve-MachineTab' {
    It 'answers nothing, and does not read the tabs to say so' {
        # The remote click is answered by the pid walk. A Konsole tab carries no
        # title, so reading them would spend D-Bus round trips for nothing.
        $script:reads = 0
        Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:reads++; @() } | Should -BeNullOrEmpty
        $reads | Should -Be 0
    }
}

Describe 'Get-OwnTerminalWindow' {
    # Restore, do not null: a developer running the suite inside a real Konsole tab
    # must not lose the variable from their process.
    BeforeAll { $script:snap = Get-EnvSnapshot 'KONSOLE_DBUS_WINDOW' }
    AfterAll  { Restore-EnvSnapshot $snap }

    It 'reads the window Konsole exported into the environment' {
        # Konsole sets KONSOLE_DBUS_WINDOW before starting the shell in a tab. Unlike
        # Windows, where the foreground window is a guess, this is exact.
        $env:KONSOLE_DBUS_WINDOW = '/Windows/1'
        Get-OwnTerminalWindow | Should -Be 1
    }

    It 'answers zero outside Konsole' {
        Remove-Item Env:\KONSOLE_DBUS_WINDOW -ErrorAction SilentlyContinue
        Get-OwnTerminalWindow | Should -Be 0
    }

    It 'answers zero for a value it does not understand' {
        $env:KONSOLE_DBUS_WINDOW = 'not-a-path'
        Get-OwnTerminalWindow | Should -Be 0
    }
}

Describe 'Test-TabSupport' {
    # The Konsole answer to the same question windows-terminal.ps1 answers for
    # Terminal, and the reason matrix.ps1 no longer asks which platform it is on.
    It 'names the missing tab when Konsole did not export a window' {
        Test-TabSupport -Hwnd 0 | Should -Be 'this shell is not running in a Konsole tab'
    }

    It 'names the missing bus when there is a window but nothing to ask' {
        # KONSOLE_DBUS_SERVICE is what Get-KonsoleBus dials, and it is unset
        # anywhere that is not a Konsole tab. Blank it for the length of this test
        # rather than trust the runner to be outside one: run the suite from a
        # Konsole tab and the real service would answer, and the assertion below
        # would be judging that machine's desktop instead of this branch.
        # Dialling here rather than at the first rebuild is the point: a failed call
        # inside Get-AllTerminalTab returns an empty list, which -ThisWindow would
        # render as a window holding no sessions rather than as a reason.
        $prevService = $script:KonsoleService
        $prevBus     = $script:KonsoleBus
        try {
            $script:KonsoleService = $null
            $script:KonsoleBus     = $null
            Test-TabSupport -Hwnd 1 | Should -Not -BeNullOrEmpty
        } finally {
            $script:KonsoleService = $prevService
            $script:KonsoleBus     = $prevBus
        }
    }
}

Describe 'Resolve-SessionTab' {
    # Konsole tab titles do not carry Claude's glyph - the default tab format is
    # "dir : shell", so the Windows title scoring has nothing to score. The tab's
    # process id is exact instead: walk a session's ancestors, and the tab whose
    # process id is one of them is the tab it runs in.
    BeforeAll {
        # The process tree: konsole(1) -> bash(10) -> claude(100); and separately
        # bash(20) -> ollama(200) -> claude(101). Tab 11 runs bash 10, tab 12 runs
        # bash 20, tab 13 runs bash 30 with nothing under it.
        $script:tabs = @(
            [pscustomobject]@{ Hwnd = 1; Index = 0; Name = ''; Text = ''; Element = 11; Pid = 10 },
            [pscustomobject]@{ Hwnd = 1; Index = 1; Name = ''; Text = ''; Element = 12; Pid = 20 },
            [pscustomobject]@{ Hwnd = 2; Index = 0; Name = ''; Text = ''; Element = 13; Pid = 30 }
        )
        # pid -> its ancestors, including itself.
        $script:tree = @{
            100 = @(100, 10, 1)                  # plain child of the tab's shell
            101 = @(101, 200, 20)                 # claude nested under a wrapper
            999 = @(999, 555)                     # lives outside every tab
        }
        $script:walk = { param([int] $ProcessId) $script:tree[$ProcessId] }
    }

    It 'matches a session running directly under the tab shell' {
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'A' -ProcessId 100)) -Tab $tabs -Ancestors $walk
        $map['A'].Element | Should -Be 11
    }

    It 'matches a session nested under a wrapper process' {
        # claude is often not the tab shell's direct child: bash -> ollama -> claude.
        # Walking down from the tab would never find it; walking up from the session
        # does.
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'B' -ProcessId 101)) -Tab $tabs -Ancestors $walk
        $map['B'].Element | Should -Be 12
    }

    It 'leaves a session outside every tab unmatched' {
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'C' -ProcessId 999)) -Tab $tabs -Ancestors $walk
        $map.Count | Should -Be 0
    }

    It 'matches each session to its own tab when two trees look alike' {
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'A' -ProcessId 100), (New-TestSession -Id 'B' -ProcessId 101)) `
                                  -Tab $tabs -Ancestors $walk
        $map['A'].Element | Should -Be 11
        $map['B'].Element | Should -Be 12
    }

    It 'never matches on the title, which Konsole does not decorate' {
        # A session whose tab says nothing about it still matches on pid alone.
        $map = Resolve-SessionTab -Session @((New-TestSession -Id 'A' -ProcessId 100)) `
                                  -Tab @($tabs[2]) -Ancestors $walk
        $map.Count | Should -Be 0
    }

    It 'survives having nothing to work with' {
        (Resolve-SessionTab -Session @() -Tab $tabs -Ancestors $walk).Count | Should -Be 0
        (Resolve-SessionTab -Session @((New-TestSession -Id 'A' -ProcessId 100)) -Tab @() -Ancestors $walk).Count |
            Should -Be 0
    }
}

Describe 'Get-AllTerminalTab' {
    # The D-Bus call is a seam: the fake answers from canned Konsole responses, the
    # function under test does the window walk and the shaping.
    BeforeAll {
        # /Windows holds windows 1 and 3. Window 1 has sessions 11 and 12; window 3
        # has session 31. processId is the pid of the shell the tab runs.
        $script:fake = {
            param([string] $Path, [string] $Iface, [string] $Member, [string] $OutSig)
            if ($Path -eq '/Windows' -and $Member -eq 'Introspect') {
                return @(('<node><node name="1"/><node name="3"/></node>'))
            }
            if ($Member -eq 'sessionList') {
                if ($Path -eq '/Windows/1') { return , ([string[]]@('11', '12')) }
                if ($Path -eq '/Windows/3') { return , ([string[]]@('31')) }
            }
            if ($Member -eq 'processId') {
                $pid_ = @{ '/Sessions/11' = 10; '/Sessions/12' = 20; '/Sessions/31' = 30 }[$Path]
                return @($pid_)
            }
            throw "unexpected call $Path $Member"
        }
    }

    It 'lists every tab of every window' {
        $tabs = @(Get-AllTerminalTab -Call $script:fake)
        $tabs.Count | Should -Be 3
        $tabs | Where-Object { $_.Hwnd -eq 1 } | Should -HaveCount 2
        $tabs | Where-Object { $_.Hwnd -eq 3 } | Should -HaveCount 1
    }

    It 'numbers the tabs within their window, in sessionList order' {
        $tabs = @(Get-AllTerminalTab -Call $script:fake)
        $tabs[0].Index | Should -Be 0
        $tabs[1].Index | Should -Be 1
        $tabs[2].Index | Should -Be 0
    }

    It 'carries the tab pid the session matching walks to' {
        $tabs = @(Get-AllTerminalTab -Call $script:fake)
        ($tabs | Where-Object { $_.Element -eq 12 }).Pid | Should -Be 20
    }

    It 'answers nothing when the bus has nothing to say' {
        @(Get-AllTerminalTab -Call { throw 'bus gone' }) | Should -HaveCount 0
    }
}

Describe 'Select-TerminalTab' {
    It "switches the window to the tab's session" {
        # The recorder is a hashtable the fake mutates in place: script-scope
        # variables set inside an invoked scriptblock do not survive to the It.
        $seen = @{}
        $fake = {
            # $Args would be shadowed by the automatic $args and never bind, so
            # the seam passes -InArgs.
            param([string] $Path, [string] $Iface, [string] $Member, [string] $InSig,
                  [object[]] $InArgs)
            $seen.Path = $Path; $seen.Member = $Member; $seen.Args = $InArgs
        }
        $tab = [pscustomobject]@{ Hwnd = 1; Element = 12 }
        Select-TerminalTab -Tab $tab -Call $fake | Should -BeTrue
        $seen.Path    | Should -Be '/Windows/1'
        $seen.Member  | Should -Be 'setCurrentSession'
        $seen.Args[0] | Should -Be 12
    }

    It 'answers false when the switch fails' {
        Select-TerminalTab -Tab ([pscustomobject]@{ Hwnd = 1; Element = 12 }) `
                           -Call { throw 'window closed' } | Should -BeFalse
    }
}

# Get-ProcessAncestorId moved to sessions.ps1, next to the other process-table
# readers - the tmux backend needs the same walk. Its live-/proc test moved to
# Sessions.Tests.ps1; everything here still exercises it through the -Ancestors
# seam.
