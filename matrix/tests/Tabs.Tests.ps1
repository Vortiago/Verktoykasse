BeforeAll {
    . (Join-Path $PSScriptRoot '..\lib\tabs.ps1')

    function New-TestTab ($hwnd, $index, $text, $glyph) {
        # $glyph: 'busy', 'idle', or 'none' for a tab Claude has not titled
        [pscustomobject]@{
            Hwnd = $hwnd; Index = $index; Text = $text
            IsBusy = $glyph -eq 'busy'; IsIdle = $glyph -eq 'idle'
        }
    }
    function New-TestSession ($id, $status, $task) {
        [pscustomobject]@{ SessionId = $id; Status = $status; Task = $task; Name = ''; Cwd = '' }
    }
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
        # This is why a session whose tab Claude has not titled yet is a miss, and why
        # the caller has to re-try that miss instead of latching it.
        (Resolve-SessionTab -Session @($busySes) -Tab @($plain)).Count | Should -Be 0
    }

    It 'passes over the tab the rain itself runs in' {
        # It needs no excluding: the rain writes no tab title, so the tab carries no
        # Claude glyph and is not a candidate. Excluding it by index was worse than
        # useless, because closing a tab shifts every index to its right and the stored
        # one then named a real session's tab.
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
        # The tab list arrives in window z-order, which changes whenever a window is
        # raised. Both tabs are idle, at index 2, sharing no word with the session, so
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

Describe 'Merge-SessionTab' {
    BeforeAll {
        $script:t1 = New-TestTab 100 1 'alpha' 'busy'
        $script:t2 = New-TestTab 100 2 'beta'  'idle'
        $script:a  = New-TestSession 'A' 'busy' 'alpha'
        $script:b  = New-TestSession 'B' 'idle' 'beta'
    }

    It 'takes the fresh match over the previous one' {
        $map = Merge-SessionTab -Session @($a) -Fresh @{ A = $t2 } -Previous @{ A = $t1 }
        $map['A'].Index | Should -Be 2
    }

    It 'keeps the last tab of a session this pass could not match' {
        # A tab is retitled every turn and its glyph lags the registry, so a rebuild can
        # fail to re-match a session it matched a moment ago. Dropping it here is what
        # made a lane vanish the moment its session was prompted.
        $map = Merge-SessionTab -Session @($a, $b) -Fresh @{ B = $t2 } -Previous @{ A = $t1; B = $t2 }
        $map['A'].Index | Should -Be 1
        $map['B'].Index | Should -Be 2
    }

    It 'does not carry a tab this pass gave to someone else' {
        $map = Merge-SessionTab -Session @($a, $b) -Fresh @{ B = $t1 } -Previous @{ A = $t1 }
        $map.ContainsKey('A') | Should -BeFalse
        $map['B'].Index | Should -Be 1
    }

    It 'lets only one session inherit a tab' {
        $map = Merge-SessionTab -Session @($a, $b) -Fresh @{} -Previous @{ A = $t1; B = $t1 }
        $map.Count | Should -Be 1
    }

    It 'leaves a session with no evidence unmatched, which is what makes the caller re-try' {
        (Merge-SessionTab -Session @($a) -Fresh @{} -Previous @{}).Count | Should -Be 0
    }

    It 'returns nothing for no sessions, whatever it was given' {
        (Merge-SessionTab -Session @() -Fresh @{} -Previous @{ A = $t1 }).Count | Should -Be 0
    }
}
