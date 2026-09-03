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

function Test-TabSupport {
    <#
    .SYNOPSIS
        '' when a tab map can be built here, or the reason it cannot.
    .DESCRIPTION
        The backend's own readiness, answered by name like the rest of this file.
        matrix.ps1 asks once and prints or throws; it never asks which platform it
        is on, and a third terminal is a lib file rather than another branch there.
    #>
    param([long] $Hwnd)
    if (-not $Hwnd) {
        return 'this is not a Windows Terminal window, or it was not in front at startup'
    }
    if (-not (Initialize-Uia)) { return 'UI Automation is unavailable' }
    ''
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

function Resolve-MachineTab {
    <#
    .SYNOPSIS
        The tab holding an ssh session to a machine, or nothing. A guess, by design.
    .DESCRIPTION
        What a click on a remote lane falls back to, and here the only thing it
        has: every window is one process, so no pid names a tab and the remote
        click would otherwise switch the far machine's window and leave the ssh
        session holding it behind whatever is in front.

        ssh leaves the remote shell's title in the tab, and a shell titles itself
        user@machine. So a tab saying @machine beats one that merely has the
        machine as a word, and two equal matches go to the first, which makes a
        repeat click land where the last one did.

        Never cached, unlike the pid answer the Linux backends give: a shell
        retitles its tab every prompt, so a click that misses now can hit next
        time.
    .PARAMETER ReadTab
        -> every tab of every window. The reader, not the tabs: this is the one
        thing a click here costs (~100 ms), and the backends that cannot answer
        at all must not spend it to say so.
    #>
    param([Parameter(Mandatory)] [string] $Machine,
          [scriptblock] $ReadTab = { Get-AllTerminalTab })

    $best = $null; $bestScore = 0
    foreach ($tab in @(& $ReadTab)) {
        if ($null -eq $tab) { continue }
        # Text, not Name: the glyph Claude leads a title with is not part of any
        # host name, and Get-TerminalTab has already taken it off.
        $score = Get-MachineTitleScore -Title ([string]$tab.Text) -Machine $Machine
        if ($score -gt $bestScore) { $best = $tab; $bestScore = $score }
    }
    $best
}

function Get-MachineTitleScore {
    <#
    .SYNOPSIS
        2 when the title says @machine, 1 when it names the machine as a word, 0 otherwise.
    .DESCRIPTION
        Not Get-MatchToken, which lower-cases, splits on every non-alphanumeric
        and drops words under four characters. All three would lose this: the @
        is the whole signal, a dot separates a host name from its domain rather
        than one word from another, and lab1 is three characters of machine name.

        A word is cut at its first dot before comparing, so the short name a
        hello carries matches the fully qualified one a shell writes. It is not
        cut anywhere else: lab1-old is not lab1, and neither is lab10.
    #>
    param([AllowEmptyString()] [string] $Title, [Parameter(Mandatory)] [string] $Machine)
    if (-not $Title) { return 0 }
    $score = 0
    foreach ($word in ($Title -split '[\s:;,()\[\]"''<>|]+')) {
        if (-not $word) { continue }
        $at = $word.IndexOf('@')
        $name = if ($at -ge 0) { $word.Substring($at + 1) } else { $word }
        $name = ($name -split '\.')[0]
        if ($name -ine $Machine) { continue }
        if ($at -ge 0) { return 2 }
        $score = 1
    }
    $score
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
