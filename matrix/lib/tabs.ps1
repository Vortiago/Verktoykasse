# Windows Terminal windows and tabs, through UI Automation.
#
# Windows Terminal hosts EVERY window in one process. A process tree cannot say which
# window anything is in. Find windows by enumerating top-level
# CASCADIA_HOSTING_WINDOW_CLASS handles. Find tabs by asking UIA for that window's
# TabItems.
#
# Our own window is the terminal in front when the rain started. See
# Get-OwnTerminalWindow for why nothing better is available.
#
# A SESSION's window is a guess: nothing maps a console process to the tab hosting it.
# Claude Code writes its own tab title: a status glyph, then an LLM summary of the
# turn.
#
#   U+25D0 / U+25D1   working   two frames of a spinner, 960 ms apart
#   U+2733            not working
#
# The glyph is a strong signal: each session's status is already known. Word overlap
# against the session's opening prompt separates the rest. The match is shown in the
# lane header, so a wrong one is visible, not silent. See README.md.

$script:UiaReady  = $false
$script:BusyGlyph = [char]0x25D0, [char]0x25D1
$script:IdleGlyph = [char]0x2733

function Initialize-Uia {
    if ($script:UiaReady) { return $true }
    try {
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes -ErrorAction Stop
        $script:UiaReady = $true
    } catch { $script:UiaReady = $false }
    $script:UiaReady
}

function Get-TerminalWindow {
    # Handles of the visible Windows Terminal windows, in z-order.
    @($WinFinder::Terminals())
}

function Get-AllTerminalTab {
    # Every tab of every terminal window, each carrying the handle of the window it is in.
    $out = foreach ($h in Get-TerminalWindow) { Get-TerminalTab -Hwnd $h }
    @($out)
}

function Get-OwnTerminalWindow {
    <#
    .SYNOPSIS
        The Windows Terminal window this rain is running in, or 0.
    .DESCRIPTION
        The terminal in front. Nothing exact is available. Every window shares one
        process. ConPTY leaves GetConsoleWindow null. The terminal exposes only its
        chrome to UI Automation, no text to search.

        Naming our own tab and looking for that name IS exact. But Windows Terminal
        pins a tab renamed by hand and ignores it, which is common. It also overwrites
        the tab title of everyone whose tab is not pinned. Read this at startup, before
        anything slow, while the window the user typed into is still in front.
    #>
    $WinFinder::Foreground()
}

function Get-TerminalTab {
    <#
    .SYNOPSIS
        The tabs of one Windows Terminal window, left to right.
    .PARAMETER Hwnd
        Window handle from Get-TerminalWindow.
    #>
    param([Parameter(Mandatory)] [long] $Hwnd)
    if (-not (Initialize-Uia)) { return @() }

    try {
        $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$Hwnd)
        if (-not $root) { return @() }
        $cond = [System.Windows.Automation.PropertyCondition]::new(
                    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                    [System.Windows.Automation.ControlType]::TabItem)
        $found = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
    } catch { return @() }

    $out = for ($i = 0; $i -lt $found.Count; $i++) {
        $name = ''
        try { $name = [string]$found[$i].Current.Name } catch { }
        $lead = if ($name.Length -gt 0) { $name[0] } else { [char]0 }
        [pscustomobject]@{
            Hwnd       = $Hwnd
            Index      = $i
            Name       = $name
            Text       = $name.TrimStart(($script:BusyGlyph + $script:IdleGlyph)).Trim()
            IsBusy     = $script:BusyGlyph -contains $lead
            IsIdle     = $lead -eq $script:IdleGlyph
            Element    = $found[$i]
        }
    }
    @($out)
}

function Select-TerminalTab {
    # Brings a tab to the front. SelectionItem is the pattern every WT tab exposes.
    # Select() flips the tab only within its own window, so raise the window too.
    # Otherwise a click on a session in another window switches it invisibly.
    param([Parameter(Mandatory)] $Tab)
    try {
        $p = $Tab.Element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $p.Select()
        if ($Tab.Hwnd) { [void]$WinFinder::Activate($Tab.Hwnd) }
        $true
    } catch { $false }
}

function Get-MatchToken {
    # lower-case words worth comparing; the short ones match everything
    param([string] $Text)
    if (-not $Text) { return @() }
    @(($Text.ToLowerInvariant() -split '[^a-z0-9]+') | Where-Object { $_.Length -ge 4 })
}

function Get-TabKey {
    # A tab's identity within one pass. The window is part of it: two windows both have
    # a tab 3. Not an identity across passes, because closing a tab renumbers the rest.
    param($Tab)
    "$($Tab.Hwnd):$($Tab.Index)"
}

function Resolve-SessionTab {
    <#
    .SYNOPSIS
        Assign each session the tab most likely to be showing it.
    .DESCRIPTION
        Scores every session/tab pair, then takes the best pairs first, one tab per
        session. Returns a hashtable of sessionId -> tab; the tab carries the Hwnd of
        the window holding it.
    .NOTES
        The rain's own tab needs no excluding: it carries no Claude glyph, so it is
        not a candidate. Do not exclude it by "hwnd:index": an index is not an
        identity. Close a tab and every index to its right shifts down. The stored key
        then names a real session's tab, which -ThisWindow would hide for the whole run.
    #>
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab
    )

    $map = @{}
    $cand = @($Tab | Where-Object { $_.IsBusy -or $_.IsIdle })
    if ($cand.Count -eq 0 -or $Session.Count -eq 0) { return $map }

    # One tab and one session still goes through the scoring. The lone glyph tab can
    # be a leftover from an exited claude in another window. Latching it silently
    # would also disarm the caller's re-try. A true match scores positive on its own;
    # a lag miss is carried by Merge-SessionTab and re-tried.
    $pairs = foreach ($s in $Session) {
        $want = Get-MatchToken (($s.Task, $s.Name, $s.Cwd) -join ' ')
        foreach ($t in $cand) {
            $score = 0
            # the glyph is live and cheap to trust: busy tabs spin, the rest do not
            if ($t.IsBusy -eq ($s.Status -eq 'busy')) { $score += 6 } else { $score -= 4 }
            $have = Get-MatchToken $t.Text
            foreach ($w in $have) { if ($want -contains $w) { $score += 3 } }
            [pscustomobject]@{ SessionId = $s.SessionId; Tab = $t; Score = $score }
        }
    }

    # Sort-Object is not stable, so ties need their own key or an equal-scoring pair
    # switches tabs between rebuilds.
    $usedTab = @{}; $usedSes = @{}
    foreach ($p in ($pairs | Sort-Object @{E = 'Score'; D = $true}, SessionId, @{E = { Get-TabKey $_.Tab }})) {
        if ($p.Score -le 0) { break }                      # a negative match is no match
        $key = Get-TabKey $p.Tab
        if ($usedTab[$key] -or $usedSes[$p.SessionId]) { continue }
        $usedTab[$key] = $true; $usedSes[$p.SessionId] = $true
        $map[$p.SessionId] = $p.Tab
    }
    $map
}

function Merge-SessionTab {
    <#
    .SYNOPSIS
        Fold a fresh match into the previous one. Keep a session's last tab when this
        pass could not match it.
    .DESCRIPTION
        A tab is retitled every turn and its glyph lags the registry. So a rebuild can
        fail to re-match a session it matched a moment ago. Do not drop the lane: the
        old tab is the best evidence until a better one arrives. A fresh match always
        wins, and a tab this pass gave to someone else is never carried.
    #>
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [hashtable] $Fresh,
        [Parameter(Mandatory)] [hashtable] $Previous
    )

    $map   = @{}
    $taken = @{}
    foreach ($k in $Fresh.Keys) {
        $map[$k] = $Fresh[$k]
        $taken[(Get-TabKey $Fresh[$k])] = $true
    }
    foreach ($s in $Session) {
        if ($map.ContainsKey($s.SessionId)) { continue }
        $old = $Previous[$s.SessionId]
        if (-not $old -or $taken[(Get-TabKey $old)]) { continue }
        $map[$s.SessionId] = $old
        $taken[(Get-TabKey $old)] = $true
    }
    $map
}

function Get-NextWait {
    # Doubles while the same sessions keep missing, restarts when the set changes.
    param([int] $Wait, [bool] $Settled, [int] $RetryMs, [int] $MaxRetryMs)
    if ($Settled -and $Wait) { [Math]::Min($Wait * 2, $MaxRetryMs) } else { $RetryMs }
}

function New-TabState {
    # The state Update-SessionTabMap owns, spelled in one place: matrix.ps1 and the
    # tests must not each hand-roll the shape. Fields: see .PARAMETER State.
    @{ Sig = ''; Set = ''; Map = @{}; RetryAt = 0; RetryWait = 0 }
}

function Update-SessionTabMap {
    <#
    .SYNOPSIS
        Keep the session -> tab map current, at the lowest cost that stays correct.
    .DESCRIPTION
        A tab read costs ~100 ms (three frames). Run it only when the session set
        changes. An INCOMPLETE map is also re-read on a timer: a tab is always behind
        the registry. Claude titles a new tab, and moves its glyph, after the registry
        already carries the session. Latching that miss hides the session until its
        status changes - never, for a session nobody has prompted yet.

        That re-try backs off to MaxRetryMs. A session Claude never titles a tab for
        ("Show status in terminal tab" off, or a background session with no tab) is
        missing for the whole run. A fixed 2 s re-try is then a ~100 ms stall every
        2 s forever. The first re-tries stay fast, which a tab catching up needs; a
        permanent miss decays to idle.
    .PARAMETER State
        Mutated in place. Sig: the session set last acted on - a map build, or a tab
        read that failed and armed a re-try. Map: sessionId -> tab. RetryAt: when to
        re-read after an incomplete map, 0 for no re-try. RetryWait: the current
        backoff. Set: the session set; it resets the backoff. Sig carries status too:
        resetting on Sig would restart the backoff on every status change, and a
        permanent miss would never decay.
    .PARAMETER ReadTab
        Returns every terminal tab. Injected, so this is testable without a desktop.
    .PARAMETER Now
        Monotonic milliseconds. Injected for the same reason.
    #>
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [hashtable] $State,
        [Parameter(Mandatory)] [scriptblock] $ReadTab,
        [Parameter(Mandatory)] [long] $Now,
        [int] $RetryMs    = 2000,
        [int] $MaxRetryMs = 30000
    )

    $sig = ($Session | ForEach-Object { "$($_.Pid):$($_.Status)" }) -join '|'
    $due = $State.RetryAt -gt 0 -and $Now -ge $State.RetryAt
    if ($sig -eq $State.Sig -and -not $due) { return }

    # Past the gate only: on the common no-change poll it would be computed and thrown away.
    $set     = (($Session | ForEach-Object { $_.Pid } | Sort-Object) -join '|')
    $settled = $set -eq $State.Set          # same sessions, so any wait already served counts

    $tabs = @(& $ReadTab)
    # Latch Sig whatever the read said. Leaving it behind on a failed read holds the
    # gate above open. The ~100 ms read this backoff rations then runs on every poll
    # for the whole outage (fullscreen terminal, locked desktop).
    $State.Sig = $sig
    $State.Set = $set

    # No windows at all is UI Automation failing, not an answer: keep the last good map,
    # count it as a miss, and let RetryAt drive the next look.
    $miss = $true
    if ($tabs.Count -gt 0) {
        $fresh     = Resolve-SessionTab -Session $Session -Tab $tabs
        $State.Map = Merge-SessionTab -Session $Session -Fresh $fresh -Previous $State.Map
        # Count against the FRESH match, not the merged map. A carried tab is the last
        # good guess, not a confirmation: its window and index are from an earlier pass.
        # A session living on one must keep re-trying until a fresh pass agrees.
        $miss = @($Session | Where-Object { -not $fresh.ContainsKey($_.SessionId) }).Count
        if (-not $miss) { $State.RetryAt = 0; $State.RetryWait = 0; return }
    }

    $State.RetryWait = Get-NextWait $State.RetryWait $settled $RetryMs $MaxRetryMs
    $State.RetryAt   = $Now + $State.RetryWait
}
