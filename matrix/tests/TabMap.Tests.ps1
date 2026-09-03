# The tab map over time: this is where the lanes went wrong. A session the matcher
# missed once stayed missed, and a prompted session lost the tab it already had.
BeforeAll {
    # The map, plus a backend to give it Get-TabKey. Windows Terminal's is the
    # one that runs on both CI legs.
    . (Join-Path $PSScriptRoot '../lib/terminal/windows-terminal.ps1')
    . (Join-Path $PSScriptRoot '../lib/terminal/tabmap.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    # New-TestSession comes from Fixtures.ps1, and carries a Pid: the map's
    # signature builds from it. New-TabState comes from tabmap.ps1, so the tests
    # cannot drift from the shape matrix.ps1 actually initialises.
}

Describe 'Update-SessionTabMap' {
    BeforeEach {
        $script:reads = 0
        # Two settled sessions, each with a titled tab, plus the tab the rain runs in.
        $script:alpha = New-TestSession 'sid-a' 'idle' 'alpha work here' 101
        $script:beta  = New-TestSession 'sid-b' 'idle' 'beta work here' 102
        $script:settledTabs = @(
            (New-TestTab 900 0 'Matrix' 'none'),
            (New-TestTab 900 1 'alpha work here' 'idle'),
            (New-TestTab 900 2 'beta work here'  'idle')
        )
        $script:state = New-TabState
    }

    It 'matches what it is given the first time' {
        $reader = { $script:reads++; $script:settledTabs }
        Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab $reader -Now 0
        $state.Map.Count | Should -Be 2
        $state.RetryAt   | Should -Be 0            # nothing missing, nothing to re-try
        $reads | Should -Be 1
    }

    It 'does not read the tabs again while the session set holds still' {
        # ~100 ms per read, more than three frames.
        $reader = { $script:reads++; $script:settledTabs }
        foreach ($t in 0, 1000, 2000, 60000) {
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab $reader -Now $t
        }
        $reads | Should -Be 1
    }

    It 'reads again as soon as a session changes status' {
        $reader = { $script:reads++; $script:settledTabs }
        Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab $reader -Now 0
        $alpha.Status = 'busy'
        Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab $reader -Now 100
        $reads | Should -Be 2
    }

    Context 'a session that starts while the rain runs' {
        It 'picks it up on its own, once its tab carries a glyph' {
            # The reported bug: a new tab has no Claude glyph for a moment, so the
            # match misses. Latching that miss hid the session until a status change,
            # and a session nobody has prompted never changes status.
            $reader = { $script:reads++; $script:settledTabs }
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab $reader -Now 0

            # The third session appears. Claude has opened the tab but not titled it.
            $gamma = New-TestSession 'sid-c' 'idle' 'gamma work here' 103
            $untitled = $settledTabs + @(New-TestTab 900 3 'PowerShell' 'none')
            $reader = { $script:reads++; $untitled }
            Update-SessionTabMap -Session @($alpha, $beta, $gamma) -State $state -ReadTab $reader -Now 1000
            $state.Map.ContainsKey('sid-c') | Should -BeFalse
            $state.RetryAt | Should -BeGreaterThan 1000      # armed to look again

            # A poll before the re-try is due changes nothing.
            Update-SessionTabMap -Session @($alpha, $beta, $gamma) -State $state -ReadTab $reader -Now 2000
            $state.Map.ContainsKey('sid-c') | Should -BeFalse

            # Claude titles the tab. The next re-try finds it, with no help from anyone.
            $titled = $settledTabs + @(New-TestTab 900 3 'gamma work here' 'idle')
            $reader = { $script:reads++; $titled }
            Update-SessionTabMap -Session @($alpha, $beta, $gamma) -State $state -ReadTab $reader -Now 3100
            $state.Map.ContainsKey('sid-c') | Should -BeTrue
            $state.Map['sid-c'].Index | Should -Be 3
            $state.RetryAt | Should -Be 0
        }

        It 'is found even when its tab says only what Claude puts there before a turn' {
            # A fresh tab reads "Claude Code": the right glyph, and no word in common
            # with the session. The glyph alone has to be enough.
            $gamma = New-TestSession 'sid-c' 'idle' 'gamma work here' 103
            $tabs = $settledTabs + @(New-TestTab 900 3 'Claude Code' 'idle')
            Update-SessionTabMap -Session @($alpha, $beta, $gamma) -State $state -ReadTab { $tabs } -Now 0
            $state.Map['sid-c'].Index | Should -Be 3
        }
    }

    Context 'a session that is prompted' {
        It 'keeps its lane while the tab glyph catches up' {
            # The registry flips to busy the moment you press enter. The tab glyph and
            # title follow later. The rebuild in that gap used to match nothing, and
            # the lane vanished.
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $script:settledTabs } -Now 0
            $state.Map['sid-a'].Index | Should -Be 1

            $alpha.Status = 'busy'                       # prompted, tab still idle
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $script:settledTabs } -Now 500
            $state.Map['sid-a'].Index | Should -Be 1      # the lane survives
        }

        It 'follows the tab when the title is rewritten for the new turn' {
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $script:settledTabs } -Now 0
            $alpha.Status = 'busy'
            $retitled = @(
                (New-TestTab 900 0 'Matrix' 'none'),
                (New-TestTab 900 1 'something else entirely now' 'busy'),
                (New-TestTab 900 2 'beta work here' 'idle')
            )
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $retitled } -Now 500
            $state.Map['sid-a'].Index | Should -Be 1
            $state.Map['sid-b'].Index | Should -Be 2
        }
    }

    Context 'when the desktop cannot be read' {
        It 'keeps the last good map instead of blanking the screen' {
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $script:settledTabs } -Now 0
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { @() } -Now 5000
            $state.Map.Count | Should -Be 2
        }

        It 'comes back to it, rather than treating no windows as an answer' {
            $alpha.Status = 'busy'
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { @() } -Now 0
            $state.RetryAt | Should -BeGreaterThan 0          # armed to look again
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:settledTabs } -Now $state.RetryAt
            $state.Map.Count | Should -Be 1
        }
    }

    Context 'a session that can never be matched' {
        BeforeEach {
            # "Show status in terminal tab" off: no tab carries a glyph, so nothing
            # can ever match. The re-try would otherwise stall the rain all run.
            $script:blind = @(
                (New-TestTab 900 0 'Matrix' 'none'),
                (New-TestTab 900 1 'PowerShell' 'none')
            )
        }

        It 'backs the re-try off instead of reading the tabs every two seconds' {
            $reader = { $script:reads++; $script:blind }
            $now = 0
            $waits = foreach ($i in 1..6) {
                Update-SessionTabMap -Session @($alpha) -State $state -ReadTab $reader -Now $now
                $now = $state.RetryAt
                $state.RetryWait
            }
            $waits | Should -Be @(2000, 4000, 8000, 16000, 30000, 30000)
        }

        It 'goes back to a fast re-try the moment the session set changes' {
            # A tab catching up needs the early re-tries to stay quick.
            $reader = { $script:reads++; $script:blind }
            $now = 0
            1..4 | ForEach-Object {
                Update-SessionTabMap -Session @($alpha) -State $state -ReadTab $reader -Now $now
                $now = $state.RetryAt
            }
            $state.RetryWait | Should -BeGreaterThan 2000

            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab $reader -Now $now
            $state.RetryWait | Should -Be 2000
        }

        It 'stops re-trying once everything is matched' {
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:blind } -Now 0
            $state.RetryAt | Should -BeGreaterThan 0
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:settledTabs } -Now $state.RetryAt
            $state.RetryAt   | Should -Be 0
            $state.RetryWait | Should -Be 0
        }

        It 'keeps backing off while a session only changes status' {
            # Sig carries status. Resetting the backoff on Sig restarted it every turn
            # anyone took. A permanent miss then never decayed. This backoff rations
            # the ~100 ms read, which ran every 2 s for the whole session.
            $reader = { $script:reads++; $script:blind }
            $now = 0
            $waits = foreach ($i in 1..4) {
                $alpha.Status = if ($i % 2) { 'busy' } else { 'idle' }
                Update-SessionTabMap -Session @($alpha) -State $state -ReadTab $reader -Now $now
                $now = $state.RetryAt
                $state.RetryWait
            }
            $waits | Should -Be @(2000, 4000, 8000, 16000)
        }

        It 'keeps re-trying while a session is living on a carried tab' {
            # The carry keeps the lane on screen, but the tab it names came from an
            # earlier pass: its window and index can both be stale. Counting it as a
            # match disarmed the re-try, and nothing ever re-checked it.
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:settledTabs } -Now 0
            $state.RetryAt | Should -Be 0

            $alpha.Status = 'busy'          # rebuild, with no glyph anywhere to match on
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:blind } -Now 100
            $state.Map['sid-a'] | Should -Not -BeNullOrEmpty      # the lane survives
            $state.RetryAt      | Should -BeGreaterThan 100       # but it is not settled
        }

        It 'backs off when the desktop cannot be read at all' {
            # Zero windows means UI Automation failed. The early return left RetryAt
            # in the past, so every single poll re-read a desktop that never answers.
            $reader = { $script:reads++; @() }
            $now = 0
            $waits = foreach ($i in 1..4) {
                Update-SessionTabMap -Session @($alpha) -State $state -ReadTab $reader -Now $now
                $now = $state.RetryAt
                $state.RetryWait
            }
            $waits | Should -Be @(2000, 4000, 8000, 16000)

            # A poll BETWEEN re-tries must not read. The failed attempt has to latch
            # Sig. Otherwise this gate stays open. The backoff exists to ration the
            # ~100 ms read, and it then runs on every poll for the whole outage.
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab $reader -Now ($now - 1)
            $reads | Should -Be 4
        }
    }

    It 'does not lose a session when the tabs are renumbered' {
        # Tab 0 is the rain. Closing a tab left of a session shifts every later index
        # down. A rain that memorised "the tab at index 0 is mine" would then hold a
        # real session's tab and hide it for the rest of the run.
        Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $script:settledTabs } -Now 0
        $shifted = @(
            (New-TestTab 900 0 'alpha work here' 'idle'),
            (New-TestTab 900 1 'beta work here'  'idle')
        )
        $alpha.Status = 'busy'                      # something moved, so the map is rebuilt
        Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $shifted } -Now 100
        $state.Map.Count | Should -Be 2
        $state.Map['sid-a'].Index | Should -Be 0
    }

    It 'forgets a session that has gone' {
        Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab { $script:settledTabs } -Now 0
        Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:settledTabs } -Now 100
        $state.Map.Count  | Should -Be 1
        $state.Map['sid-a'] | Should -Not -BeNullOrEmpty
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
        # A tab is retitled every turn, and its glyph lags the registry. A rebuild can
        # fail to re-match a session it matched a moment ago. Dropping it here made a
        # lane vanish the moment its session was prompted.
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
