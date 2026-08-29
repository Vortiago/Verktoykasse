# The tab map over time, which is where the lanes went wrong: a session the matcher
# missed once stayed missed, and a prompted session lost the tab it already had.
BeforeAll {
    . (Join-Path $PSScriptRoot '..\lib\tabs.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    # Pid too: the map's signature is built from it. New-TabState comes from tabs.ps1,
    # so the tests cannot drift from the shape matrix.ps1 actually initialises.
    function New-TestSession ($id, $pid_, $status, $task) {
        [pscustomobject]@{ SessionId = $id; Pid = $pid_; Status = $status; Task = $task
                           Name = $task; Cwd = '' }
    }
}

Describe 'Update-SessionTabMap' {
    BeforeEach {
        $script:reads = 0
        # Two settled sessions, each with a titled tab, plus the tab the rain runs in.
        $script:alpha = New-TestSession 'sid-a' 101 'idle' 'alpha work here'
        $script:beta  = New-TestSession 'sid-b' 102 'idle' 'beta work here'
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
            # The reported bug: a new tab has no Claude glyph for a moment, so the match
            # misses. Latching that miss hid the session until its status changed, and a
            # session nobody has prompted never changes status.
            $reader = { $script:reads++; $script:settledTabs }
            Update-SessionTabMap -Session @($alpha, $beta) -State $state -ReadTab $reader -Now 0

            # The third session appears. Claude has opened the tab but not titled it.
            $gamma = New-TestSession 'sid-c' 103 'idle' 'gamma work here'
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
            $gamma = New-TestSession 'sid-c' 103 'idle' 'gamma work here'
            $tabs = $settledTabs + @(New-TestTab 900 3 'Claude Code' 'idle')
            Update-SessionTabMap -Session @($alpha, $beta, $gamma) -State $state -ReadTab { $tabs } -Now 0
            $state.Map['sid-c'].Index | Should -Be 3
        }
    }

    Context 'a session that is prompted' {
        It 'keeps its lane while the tab glyph catches up' {
            # The registry flips to busy the moment you press enter; the tab glyph and
            # title follow later. The rebuild in that gap used to match nothing and the
            # lane vanished.
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
            # "Show status in terminal tab" off: no tab carries a glyph, so nothing can
            # ever match and the re-try would otherwise stall the rain for the whole run.
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
            # Sig carries status, so resetting the backoff on Sig restarted it every turn
            # anyone took. A permanent miss then never decayed, and the ~100 ms read this
            # backoff exists to ration went on running every 2 s for the whole session.
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
            # match disarmed the re-try, so nothing ever re-checked it.
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:settledTabs } -Now 0
            $state.RetryAt | Should -Be 0

            $alpha.Status = 'busy'          # rebuild, with no glyph anywhere to match on
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab { $script:blind } -Now 100
            $state.Map['sid-a'] | Should -Not -BeNullOrEmpty      # the lane survives
            $state.RetryAt      | Should -BeGreaterThan 100       # but it is not settled
        }

        It 'backs off when the desktop cannot be read at all' {
            # Zero windows is UI Automation failing, and the early return left RetryAt in
            # the past, so a desktop that never answers was re-read on every single poll.
            $reader = { $script:reads++; @() }
            $now = 0
            $waits = foreach ($i in 1..4) {
                Update-SessionTabMap -Session @($alpha) -State $state -ReadTab $reader -Now $now
                $now = $state.RetryAt
                $state.RetryWait
            }
            $waits | Should -Be @(2000, 4000, 8000, 16000)

            # A poll BETWEEN re-tries must not read. The failed attempt has to latch
            # Sig, or this gate stays open and the ~100 ms read the backoff exists to
            # ration runs on every poll for the whole outage.
            Update-SessionTabMap -Session @($alpha) -State $state -ReadTab $reader -Now ($now - 1)
            $reads | Should -Be 4
        }
    }

    It 'does not lose a session when the tabs are renumbered' {
        # Tab 0 is the rain. Close the tab to the left of a session and every index after
        # it shifts down; a rain that had memorised "the tab at index 0 is mine" would
        # then be holding a real session's tab and would hide it for the rest of the run.
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
