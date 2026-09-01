# tmux on Linux: the backend tabmap.ps1 calls when the rain runs inside tmux.
# It answers the same six names konsole.ps1 does, so the map above it never asks
# which multiplexer it is on. matrix.ps1 loads one of them, not both, and a tmux
# pane is always tmux's first: the rain talks to the multiplexer it nests in,
# whether the outer terminal is Konsole, a plain xterm, or another tmux.
#
# A tab here is a window, and the scope -ThisWindow filters on is a session.
# Panes are never focused: the click is select-window, full stop.
#
# Every call goes through the -Call seam, which is how the tests drive these
# without a server. It defaults to Invoke-Tmux, so the call's defaults are
# written once. The rain's client reaches the right server on its own: tmux
# sets $TMUX in every pane, and that names the socket.

# One row per pane, fields on tab characters. A row names the session it
# belongs to, the window it sits in, and the pane whose shell would host a
# session - the pid the ancestor walk matches on.
$script:TmuxFormat = (@('#{session_id}', '#{window_id}', '#{window_index}',
                        '#{pane_pid}', '#{pane_id}') -join [char]9)

function Invoke-Tmux {
    # One fork of the tmux client. stdout AND stderr are captured: tmux writes
    # its errors to stderr, and a raw write there would land on the alt screen
    # mid-frame and shear it.
    param(
        [Parameter(Mandatory)] [string[]] $TmuxArgs,
        # test seam: a fake binary or a path that does not exist
        [string] $Tmux = 'tmux'
    )
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $Tmux
    foreach ($a in $TmuxArgs) { [void]$psi.ArgumentList.Add($a) }
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    # $p exists only once Start answers; the finally must survive a failed start.
    $p = $null
    try {
        $p = [System.Diagnostics.Process]::Start($psi)
        # Both pipes drain concurrently. ReadToEnd on one before the other
        # deadlocks the pair: a child blocked writing its full stderr pipe sits
        # there forever while the parent waits in ReadToEnd for stdout's EOF.
        $outTask = $p.StandardOutput.ReadToEndAsync()
        $errTask = $p.StandardError.ReadToEndAsync()
        $p.WaitForExit()
        # Read before Dispose: a disposed Process no longer answers for its exit.
        $code = $p.ExitCode
        $out = $outTask.GetAwaiter().GetResult()
        $err = $errTask.GetAwaiter().GetResult()
    } catch {
        throw "tmux $($TmuxArgs -join ' ') failed: $($_.Exception.Message)"
    } finally {
        if ($p) { $p.Dispose() }
    }
    if ($code -ne 0) {
        throw "tmux $($TmuxArgs -join ' ') failed: $($err.Trim())"
    }
    $out
}

function ConvertTo-TmuxTab {
    # One line of list-panes output -> a tab object, or nothing. Pure, so the
    # parse is tested on Windows CI too. Nothing reads a session or window
    # name, so the format carries none: a name is free text, and a tab
    # character inside one would break the split.
    param([Parameter(Mandatory)] [string] $Line)
    $f = $Line -split [char]9
    if ($f.Count -lt 5) { return $null }
    # window_index is a plain number, not an id. Both numeric fields parse: a row
    # whose pid does not cast must drop only itself, never throw out of the whole
    # pane list (Get-AllTerminalTab answers any throw with an empty server, which
    # reads upstream as "no windows at all").
    $idx = 0
    if (-not [int]::TryParse($f[2], [ref] $idx)) { return $null }
    $panePid = 0
    if (-not [int]::TryParse($f[3], [ref] $panePid)) { return $null }
    [pscustomobject]@{
        # The OWNING SESSION id ('$2') - the key -ThisWindow filters on. It stays a
        # string because tmux ids start at 0 and matrix.ps1 reads 0 as "no window".
        Hwnd    = [string]$f[0]
        Window  = [string]$f[1]                  # what Select-TerminalTab targets
        Index   = $idx - 1                       # printed back as Index + 1, the number tmux shows
        Pid     = $panePid                       # what Resolve-SessionTab matches on
        Pane    = [string]$f[4]                  # part of the tab's identity
    }
}

function Get-OwnTerminalWindow {
    # tmux sets TMUX_PANE before starting the shell in a pane, so display -p -t
    # answers for our pane alone: exact, like KONSOLE_DBUS_WINDOW and unlike the
    # Windows foreground-window guess.
    #
    # The answer is the session id STRING ('$0'), not its number. tmux ids start
    # at 0, and matrix.ps1 reads 0 as "no window" - a number would erase the
    # common case, the first session on a fresh server.
    param([scriptblock] $Call = ${function:Invoke-Tmux})
    if (-not $env:TMUX_PANE) { return '' }
    try {
        return [string](& $Call -TmuxArgs @('display-message', '-p', '-t', $env:TMUX_PANE,
                                            '#{session_id}')).Trim()
    } catch { return '' }
}

function Test-TabSupport {
    # The preconditions, checked here so the reason surfaces as a message at
    # startup instead of as an empty pane list, which -ThisWindow would read as
    # a session holding no windows at all. Same shape as konsole.ps1. No dial
    # of its own: Get-OwnTerminalWindow just forked the client, so a truthy
    # $Hwnd already proves the server answers.
    param([object] $Hwnd)
    if (-not $env:TMUX) { return 'this shell is not running inside tmux' }
    if (-not $Hwnd) { return 'the rain could not read its own tmux session' }
    ''
}

function Get-AllTerminalTab {
    # Every pane of every window of every session on the rain's tmux server. A
    # pane is one row, so two panes of one window are two rows with the same
    # destination - both sessions click to that window.
    param([scriptblock] $Call = ${function:Invoke-Tmux})

    try {
        # One pass, and a row that cannot be read drops itself. The trailing @()
        # keeps a lone tab from unrolling to a bare string, not from being filtered.
        $out = foreach ($line in (& $Call -TmuxArgs @('list-panes', '-a', '-F', $script:TmuxFormat)) -split "`n") {
            if ($line) {
                $tab = ConvertTo-TmuxTab $line
                if ($tab) { $tab }
            }
        }
        return @($out)
    } catch {
        return @()          # a dead server mid-run is no reason to blank the rain
    }
}

function Select-TerminalTab {
    # Switches the rain's client to the window that holds the session. The
    # window id targets the window exactly, across renumbering and base-index.
    # Two gaps, neither fixed here:
    #   - the rain's client jumps only when the window belongs to the session it
    #     is viewing. For a session in another tmux session, select-window moves
    #     THAT session's current window where nobody is looking - Konsole's
    #     "cannot raise" gap, one level up. switch-client would fix it and is
    #     deliberately out of scope.
    #   - a session sharing the rain's own window is a visible no-op.
    param(
        [Parameter(Mandatory)] $Tab,
        [scriptblock] $Call = ${function:Invoke-Tmux}
    )
    try {
        [void](& $Call -TmuxArgs @('select-window', '-t', $Tab.Window))
        return $true
    } catch {
        return $false
    }
}

function Get-TabKey {
    # A tab's identity. The pane, not the window: two panes of one window are
    # two rows with the same destination, and keying on the window would let one
    # session's carried tab block the other's in Merge-SessionTab. The pane id
    # is stable across renumbering, like Konsole's session id and unlike a
    # Windows index.
    param($Tab)
    "$($Tab.Hwnd):$($Tab.Pane)"
}

function Resolve-SessionTab {
    # The tmux twin of Konsole's exact match: pane_pid is the pane's root
    # process, and the last hop of a claude pid's /proc walk inside a pane is
    # exactly that process. No title scoring - tmux window names say nothing
    # usable. The walk goes up from the claude pid, because claude is often not
    # the pane shell's direct child (bash -> ollama -> claude).
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab,
        # test seam: pid -> ancestor pid list. ${function:...} resolves by name at
        # call time, so it reads $null - silently - whenever sessions.ps1 was not
        # sourced before this file. Name the missing dependency instead of dying
        # inside the poll on '&' against nothing.
        [scriptblock] $Ancestors = ${function:Get-ProcessAncestorId}
    )

    if (-not $Ancestors) {
        throw 'matrix: Get-ProcessAncestorId is not loaded - source lib/sessions.ps1 before the terminal backend'
    }

    $tabPids = @{}
    foreach ($t in $Tab) { $tabPids[[int]$t.Pid] = $t }

    $map = @{}
    foreach ($s in $Session) {
        foreach ($ancestor in @(& $Ancestors ([int]$s.Pid))) {
            # A walk that dies mid-chain returns $null inside an array, and
            # [int]$null is 0: skip it rather than match a pane with no pid.
            if (-not $ancestor) { continue }
            if ($tabPids.ContainsKey([int]$ancestor)) {
                $map[$s.SessionId] = $tabPids[[int]$ancestor]
                break
            }
        }
    }
    $map
}