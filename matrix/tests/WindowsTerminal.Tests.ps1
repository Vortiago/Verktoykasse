BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/terminal/windows-terminal.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')
    # New-TestSession comes from Fixtures.ps1: no Pid and an empty Name here,
    # so scoring rests on the task alone.
}

Describe 'Get-MatchToken' {
    It 'keeps only words long enough to mean something' {
        Get-MatchToken 'the Matrix rain in a PS console' | Should -Be @('matrix', 'rain', 'console')
    }

    It 'splits on punctuation and folds case' {
        Get-MatchToken 'D:\repos\Verktoykasse' | Should -Be @('repos', 'verktoykasse')
    }

    It 'has nothing to say about empty text' {
        Get-MatchToken '' | Should -HaveCount 0
        Get-MatchToken $null | Should -HaveCount 0
    }
}

Describe 'Test-TabSupport' {
    # matrix.ps1 asks the backend whether a tab map can be built at all, and prints
    # or throws with what comes back. Only the no-window answer is asserted here:
    # the other arm is Initialize-Uia, and nothing else in this suite depends on
    # UI Automation being installed on the runner.
    It 'names the missing window when the rain did not start in a terminal' {
        Test-TabSupport -Hwnd 0 | Should -BeLike '*not a Windows Terminal window*'
    }
}

Describe 'Resolve-SessionTab' {
    BeforeAll {
        $script:busy1  = New-TestTab 100 1 'alpha' 'busy'
        $script:idle2  = New-TestTab 100 2 'beta'  'idle'
        $script:idle2b = New-TestTab 200 2 'delta' 'idle'   # same index, other window
        $script:plain  = New-TestTab 100 9 'PowerShell' 'none'
        $script:busySes = New-TestSession 'A' 'busy' 'alpha'
    }

    It 'matches the only Claude tab to the only session' {
        $map = Resolve-SessionTab -Session @($busySes) -Tab @($busy1)
        $map['A'].Index | Should -Be 1
    }

    It 'never matches a tab with no Claude glyph' {
        # A session whose tab Claude has not titled yet is therefore a miss. The
        # caller has to re-try that miss instead of latching it.
        (Resolve-SessionTab -Session @($busySes) -Tab @($plain)).Count | Should -Be 0
    }

    It 'passes over the tab the rain itself runs in' {
        # It needs no excluding: the rain writes no tab title, so its tab carries no
        # Claude glyph and is not a candidate. Do not exclude by index: closing a tab
        # shifts every index to its right, and the stored one then named a real
        # session's tab.
        $rainTab = New-TestTab 100 0 'Matrix' 'none'
        (Resolve-SessionTab -Session @($busySes) -Tab @($rainTab)).Count | Should -Be 0
    }

    It 'prefers the tab that shares words with the session' {
        $a = New-TestSession 'A' 'idle' 'alpha work'
        $b = New-TestSession 'B' 'idle' 'delta work'
        $map = Resolve-SessionTab -Session @($a, $b) -Tab @($idle2, $idle2b)
        $map['A'].Text | Should -Be 'beta'    # 'alpha' shares nothing, but B takes delta
        $map['B'].Text | Should -Be 'delta'
    }

    It 'gives one tab to one session' {
        $a = New-TestSession 'A' 'idle' 'delta'
        $b = New-TestSession 'B' 'idle' 'delta'
        $map = Resolve-SessionTab -Session @($a, $b) -Tab @($idle2b)
        $map.Count | Should -Be 1
    }

    It 'does not let window z-order pick between two equal-scoring tabs' {
        # The tab list arrives in window z-order, and raising a window changes that.
        # Both tabs are idle, at index 2, and share no word with the session, so
        # only the tie-break separates them.
        $c = New-TestSession 'C' 'idle' 'nothing in common'
        $seen = @{}
        foreach ($order in @($idle2, $idle2b), @($idle2b, $idle2)) {
            $map = Resolve-SessionTab -Session @($c) -Tab $order
            $seen["$($map['C'].Hwnd):$($map['C'].Index)"] = $true
        }
        $seen.Count | Should -Be 1
    }

    It 'survives having nothing to work with' {
        (Resolve-SessionTab -Session @() -Tab @($busy1)).Count | Should -Be 0
        (Resolve-SessionTab -Session @($busySes) -Tab @()).Count | Should -Be 0
    }
}

Describe 'Resolve-SessionTab, one tab and one session' {
    It 'does not latch a lone tab that shares nothing with the session' {
        # The lone glyph tab can be a leftover from an exited claude in another window.
        # A match here disarms the caller's re-try, so a wrong latch lasts the whole
        # run. A miss keeps the re-try armed until the real tab is titled.
        $map = Resolve-SessionTab -Session @((New-TestSession 'sid' 'busy' 'nothing in common')) `
                                  -Tab @((New-TestTab 1 0 'unrelated title' 'idle'))
        $map.Count | Should -Be 0
    }

    It 'still matches through a lagging glyph when the words agree' {
        # The ordinary acquisition case: the registry flips to busy before the tab
        # glyph follows, but the title already carries the session's own words.
        $map = Resolve-SessionTab -Session @((New-TestSession 'sid' 'busy' 'refactor the parser')) `
                                  -Tab @((New-TestTab 1 0 'parser refactor' 'idle'))
        $map['sid'].Index | Should -Be 0
    }

    It 'still ignores a tab Claude never titled' {
        (Resolve-SessionTab -Session @((New-TestSession 'sid' 'busy' 'work')) `
                            -Tab @((New-TestTab 1 0 'pwsh' 'none'))).Count | Should -Be 0
    }
}

Describe 'Resolve-MachineTab' {
    # The route a click on a remote lane takes here, where no pid names a tab.
    # ssh leaves the remote shell's title in it, and a shell titles itself
    # user@machine. The reader is injected, the way every tab reader in the suite
    # is, and $script: because a seam runs inside the function under test.
    It 'finds the tab a shell titled user@machine' {
        $script:tabs = @((New-TestTab 1 0 'PowerShell' 'none'), (New-TestTab 1 1 'atle@lab1' 'none'),
                         (New-TestTab 1 2 'Matrix' 'none'))
        (Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs }).Index | Should -Be 1
    }

    It 'takes the short name out of a fully qualified one, with whatever follows' {
        # The hello carries the name cut at the first dot; a shell often writes
        # the whole thing, and the working directory after a colon.
        $script:tabs = @((New-TestTab 1 0 'atle@lab1.example.net: ~/repos' 'none'))
        (Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs }).Index | Should -Be 0
    }

    It 'ignores case, the way a host name does' {
        $script:tabs = @((New-TestTab 1 0 'atle@LAB1' 'none'))
        (Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs }).Index | Should -Be 0
    }

    It 'does not take the name inside a longer word' {
        $script:tabs = @((New-TestTab 1 0 'atle@lab10' 'none'), (New-TestTab 1 1 'lab1-old notes' 'none'))
        Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs } | Should -BeNullOrEmpty
    }

    It 'prefers user@machine over a tab that merely mentions the machine' {
        # A local Claude session can be working on that machine's code. Its tab
        # names the machine; the ssh tab is the one whose title says @machine.
        $script:tabs = @((New-TestTab 1 0 'lab1 deploy script' 'idle'),
                         (New-TestTab 1 1 'atle@lab1' 'none'))
        (Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs }).Index | Should -Be 1
    }

    It 'settles for a tab that names the machine as a word' {
        $script:tabs = @((New-TestTab 1 0 'PowerShell' 'none'), (New-TestTab 1 1 'ssh lab1' 'none'))
        (Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs }).Index | Should -Be 1
    }

    It 'takes the first of two equal matches, so a repeat click lands on the same tab' {
        $script:tabs = @((New-TestTab 1 3 'atle@lab1' 'none'), (New-TestTab 2 0 'atle@lab1' 'none'))
        (Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs }).Hwnd | Should -Be 1
    }

    It 'answers nothing when no title names the machine' {
        $script:tabs = @((New-TestTab 1 0 'PowerShell' 'none'), (New-TestTab 1 1 'atle@lab2' 'none'))
        Resolve-MachineTab -Machine 'lab1' -ReadTab { $script:tabs } | Should -BeNullOrEmpty
    }

    It 'answers nothing when there are no tabs at all' {
        Resolve-MachineTab -Machine 'lab1' -ReadTab { @() } | Should -BeNullOrEmpty
    }

    It 'reads the tabs each time, because a shell retitles its tab every prompt' {
        $script:reads = 0
        $reader = { $script:reads++; @((New-TestTab 1 0 'atle@lab1' 'none')) }
        [void](Resolve-MachineTab -Machine 'lab1' -ReadTab $reader)
        [void](Resolve-MachineTab -Machine 'lab1' -ReadTab $reader)
        $reads | Should -Be 2
    }
}
