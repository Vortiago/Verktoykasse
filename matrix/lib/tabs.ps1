# Windows Terminal windows and tabs, through UI Automation.
#
# Windows Terminal hosts EVERY window in one process, so a process tree cannot say which
# window anything is in. Windows are found by enumerating top-level
# CASCADIA_HOSTING_WINDOW_CLASS handles, and tabs by asking UIA for that window's
# TabItems.
#
# Which window we are in is the terminal that was in front when the rain started; see
# Get-OwnTerminalWindow for why nothing better is available.
#
# Which window a SESSION is in is a guess, because nothing maps a console process to the
# tab hosting it. Claude Code writes its own tab title: a status glyph, then an LLM
# summary of the turn.
#
#   U+25D0 / U+25D1   working   two frames of a spinner, 960 ms apart
#   U+2733            not working
#
# The glyph is a strong signal, because we already know each session's status. Word
# overlap against the session's opening prompt separates the rest. The match is shown in
# the lane header, so a wrong one is visible rather than silent. See README.md.

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
        The terminal in front. Nothing exact is available: every window shares one
        process, ConPTY leaves GetConsoleWindow null, and the terminal exposes only its
        chrome to UI Automation, no text to search.

        Naming our own tab and looking for that name IS exact, but Windows Terminal pins
        a tab renamed by hand and ignores it, which is common; it also overwrites the tab
        title of everyone whose tab is not pinned. Read this at startup, before anything
        slow, while the window the user typed into is still in front.
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

    $selProp = [System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty
    $out = for ($i = 0; $i -lt $found.Count; $i++) {
        $name = ''
        try { $name = [string]$found[$i].Current.Name } catch { }
        $sel = $false
        try { $sel = [bool]$found[$i].GetCurrentPropertyValue($selProp) } catch { }
        $lead = if ($name.Length -gt 0) { $name[0] } else { [char]0 }
        [pscustomobject]@{
            Hwnd       = $Hwnd
            Index      = $i
            Name       = $name
            Text       = $name.TrimStart(($script:BusyGlyph + $script:IdleGlyph)).Trim()
            IsBusy     = $script:BusyGlyph -contains $lead
            IsIdle     = $lead -eq $script:IdleGlyph
            IsSelected = $sel
            Element    = $found[$i]
        }
    }
    @($out)
}

function Select-TerminalTab {
    # Brings a tab to the front. SelectionItem is the pattern every WT tab exposes.
    param([Parameter(Mandatory)] $Tab)
    try {
        $p = $Tab.Element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $p.Select()
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
        The tab the rain itself runs in needs no excluding: it carries no Claude glyph,
        so it is not a candidate. Excluding it by "hwnd:index" was worse than useless,
        because an index is not an identity. Close a tab and every index to its right
        shifts down, and the stored one then names a real session's tab, which -ThisWindow
        would hide for the rest of the run.
    #>
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab
    )

    $map = @{}
    $cand = @($Tab | Where-Object { $_.IsBusy -or $_.IsIdle })
    if ($cand.Count -eq 0 -or $Session.Count -eq 0) { return $map }

    # One Claude tab and one session leaves nothing to guess.
    if ($cand.Count -eq 1 -and $Session.Count -eq 1) {
        $map[$Session[0].SessionId] = $cand[0]
        return $map
    }

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
        Fold a fresh match into the previous one, keeping a session's last tab when this
        pass could not match it.
    .DESCRIPTION
        A tab is retitled every turn and its glyph lags the registry, so a rebuild can
        fail to re-match a session it matched a moment ago. Dropping the lane on that is
        wrong: the old tab is the best evidence there is until a better one arrives. A
        fresh match always wins, and a tab this pass gave to someone else is never
        carried.
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

function Update-SessionTabMap {
    <#
    .SYNOPSIS
        Keep the session -> tab map current, at the lowest cost that stays correct.
    .DESCRIPTION
        Reading the tabs costs ~100 ms, more than three frames, so it runs only when the
        session set changes. An INCOMPLETE map is re-read on a timer as well, because a
        tab is always behind the registry: Claude titles a new tab, and moves its glyph,
        after the registry already carries the session. Latching that miss hides the
        session until its status happens to change, which for a session nobody has
        prompted yet is never.

        That re-try backs off to MaxRetryMs. A session Claude never titles a tab for -
        "Show status in terminal tab" off, or a background session with no tab at all -
        is missing for the whole run, and a fixed 2 s re-try is then a ~100 ms stall
        every 2 s forever. The first re-tries stay fast, which is what a tab catching up
        needs; a permanent miss decays to idle.
    .PARAMETER State
        Mutated in place. Sig: the session set the map was built from. Map: sessionId ->
        tab. RetryAt: when to re-read after an incomplete map, 0 for no re-try.
        RetryWait: the current backoff, reset whenever the session set changes.
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

    $tabs = @(& $ReadTab)
    # No windows at all is UI Automation failing, not an answer: keep the last good map
    # and come back next poll, or -ThisWindow blanks the screen.
    if ($tabs.Count -eq 0) { return }

    $fresh   = Resolve-SessionTab -Session $Session -Tab $tabs
    $settled = $sig -eq $State.Sig          # same session set, so this was a re-try
    $State.Sig = $sig
    $State.Map = Merge-SessionTab -Session $Session -Fresh $fresh -Previous $State.Map
    $miss = @($Session | Where-Object { -not $State.Map.ContainsKey($_.SessionId) }).Count
    if (-not $miss) { $State.RetryAt = 0; $State.RetryWait = 0; return }

    $wait = if ($settled -and $State.RetryWait) { [Math]::Min($State.RetryWait * 2, $MaxRetryMs) }
            else { $RetryMs }
    $State.RetryWait = $wait
    $State.RetryAt   = $Now + $wait
}
