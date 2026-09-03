# The session -> tab map over time: built once, kept current at the lowest cost
# that stays correct, and carried across a pass that failed to re-match.
#
# Nothing here knows which terminal it is on. It calls Get-TabKey,
# Get-AllTerminalTab and Resolve-SessionTab by name, and exactly one backend
# under this directory defines them - windows-terminal.ps1 on Windows,
# konsole.ps1 or tmux.ps1 on Linux.
#
# Resolve-SessionTabByPid below is the one piece of matching that lives here
# instead: it knows nothing about terminals either, and both Linux backends
# answer Resolve-SessionTab with it rather than each carrying the walk.

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

function Resolve-SessionTabByPid {
    <#
    .SYNOPSIS
        Match each session to the tab whose process is one of the session's ancestors.
    .DESCRIPTION
        The exact match both Linux backends want, written once. Konsole's tab shell
        and tmux's pane_pid are the same kind of pid - the process the terminal
        started in that tab or pane - so the walk and the matching are the same code,
        and only the field names around them differ. It is also why
        Get-ProcessAncestorId lives in sessions.ps1 rather than in either backend.

        No title scoring: neither Konsole nor tmux decorates a title with anything
        Claude puts there, which is the whole reason the Windows backend cannot
        share this.

        The walk goes UP from the claude pid, because claude is often not the tab or
        pane shell's direct child (bash -> ollama -> claude).
    .PARAMETER Ancestors
        pid -> the pid and every pid above it. Injected, so this is testable without
        a process tree.
    #>
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab,
        [scriptblock] $Ancestors
    )

    # The backends default this to ${function:Get-ProcessAncestorId}, which resolves
    # by name at call time and so reads $null - silently - whenever sessions.ps1 was
    # not sourced first. Name the missing dependency instead of dying inside the
    # poll on '&' against nothing.
    if (-not $Ancestors) {
        throw 'matrix: Get-ProcessAncestorId is not loaded - source lib/sessions.ps1 before the terminal backend'
    }

    $tabPids = @{}
    foreach ($t in $Tab) { $tabPids[[int]$t.Pid] = $t }

    $map = @{}
    foreach ($s in $Session) {
        $hit = Resolve-TabByPid -ProcessId ([int]$s.Pid) -TabPid $tabPids -Ancestors $Ancestors
        if ($hit) { $map[$s.SessionId] = $hit }
    }
    $map
}

function Resolve-TabByPid {
    <#
    .SYNOPSIS
        The tab whose process is the nearest ancestor of one pid, or nothing.
    .DESCRIPTION
        Split out of Resolve-SessionTabByPid so the remote click can walk from an
        ssh client's pid to the pane holding it without carrying its own copy of
        the walk. One pid in, one tab out.

        The loop is over ANCESTORS, not over tabs, and that ordering is the whole
        answer: a pid nested two panes deep has two tab pids in its line, and only
        the nearest one is the pane it actually sits in.
    .PARAMETER TabPid
        pid -> tab. Built once by the caller, because the session matcher reuses it
        across every session.
    #>
    param([Parameter(Mandatory)] [int] $ProcessId,
          [Parameter(Mandatory)] [hashtable] $TabPid,
          [scriptblock] $Ancestors)

    if (-not $Ancestors) {
        throw 'matrix: Get-ProcessAncestorId is not loaded - source lib/sessions.ps1 before the terminal backend'
    }
    foreach ($ancestor in @(& $Ancestors $ProcessId)) {
        # A seam is free to answer with holes, and [int]$null is 0: skip it
        # rather than match a tab whose own pid failed to parse. The real walk
        # never emits one - it only adds a pid it already proved is >= 1.
        if (-not $ancestor) { continue }
        if ($TabPid.ContainsKey([int]$ancestor)) { return $TabPid[[int]$ancestor] }
    }
    $null
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
