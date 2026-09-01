# The session -> tab map over time: built once, kept current at the lowest cost
# that stays correct, and carried across a pass that failed to re-match.
#
# Nothing here knows which terminal it is on. It calls Get-TabKey,
# Get-AllTerminalTab and Resolve-SessionTab by name, and exactly one backend
# under this directory defines them - windows-terminal.ps1 on Windows,
# konsole.ps1 or tmux.ps1 on Linux.

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
