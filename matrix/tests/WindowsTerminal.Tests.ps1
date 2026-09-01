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
