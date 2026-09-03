# The rain side of the remote protocol: which machines are connected, what they
# last said, and when they stopped saying it. No sockets here. Accepting, reading,
# writing and closing are four injected scriptblocks, the way the tab map takes
# -ReadTab, so every timing case below is tested with a fake clock and no peer.
#
# Needs wire.ps1, and through it console.ps1 and sessions.ps1.
#
# One clock, epoch milliseconds, everywhere in this file. The tab map runs on a
# monotonic stopwatch instead. These must not be mixed: this one is compared
# against timestamps another machine wrote, and that is what forces the choice.

function New-RemoteHub {
    <#
    .SYNOPSIS
        The state Update-RemoteHub keeps between polls.
    .PARAMETER StaleMs
        No frame for this long and the machine's lanes go offline. They keep their
        last data: a blanked lane reads as a session that ended.
    .PARAMETER DropMs
        No frame for this long and the connection is closed. A closed laptop
        leaves a half-open socket that never reports itself shut, and lanes frozen
        for an hour are worse than lanes that go away.
    #>
    param([AllowEmptyString()] [string] $Token = '',
          [int] $StaleMs = 5000,
          [int] $DropMs = 60000)

    @{
        Token = $Token; StaleMs = $StaleMs; DropMs = $DropMs
        Peer = [System.Collections.Generic.List[hashtable]]::new()
        # The last thing the user needs told. The rain owns the whole screen, so a
        # note waits here for the empty lane to have room for it. One string, not
        # a log: nothing reads an earlier note, and a peer retrying every second
        # would fill a list nobody empties.
        Note = ''
    }
}

function New-RemotePeer {
    param([Parameter(Mandatory)] $Conn, [Parameter(Mandatory)] [long] $Now)
    @{
        Conn = $Conn
        Machine = ''          # named by the hello, so empty until it arrives
        Buffer = ''           # the partial line held over from the last read
        Skew = [long]0        # host clock minus peer clock
        LastMs = $Now         # when this peer last said anything usable
        Hello = $false
        Welcomed = $false     # the answer to the hello has been written
        RefusedWhy = ''       # failed the hello: what it is told, then hang up
        Session = @()
        Tab = $null           # the local tab holding this peer's ssh, found on a click
        PidTried = $false     # the pid route has run; the title route runs every click
    }
}

function Update-RemoteHub {
    <#
    .SYNOPSIS
        Take one poll's worth of input from every connected machine.
    .DESCRIPTION
        Nothing here blocks. Accept and Read are expected to answer at once with
        whatever is ready, because this runs inside the frame loop and a stall
        shows as a dropped frame. Write is in that budget too: the only thing
        written here is the answer to a hello, which is a couple of dozen bytes
        and cannot fill a send window.
    .PARAMETER Accept
        -> the connections that arrived since the last call, or nothing.
    .PARAMETER Read
        conn -> the text waiting on it. '' when nothing is waiting, $null when the
        peer closed. The two differ: '' is a quiet peer, $null is a peer that has
        gone.
    .PARAMETER Write
        conn, line -> writes it. Used once per peer, to answer the hello: a
        welcome, or the reason it was refused. Throwing is how it reports a
        broken pipe, and one line that short can only fail for that reason.
    .PARAMETER Close
        conn -> hangs it up. Called once per peer, by this function only.
    #>
    param([Parameter(Mandatory)] [hashtable] $Hub,
          [Parameter(Mandatory)] [long] $Now,
          [Parameter(Mandatory)] [scriptblock] $Accept,
          [Parameter(Mandatory)] [scriptblock] $Read,
          [Parameter(Mandatory)] [scriptblock] $Write,
          [Parameter(Mandatory)] [scriptblock] $Close)

    foreach ($conn in @(& $Accept)) {
        if ($conn) { $Hub.Peer.Add((New-RemotePeer -Conn $conn -Now $Now)) }
    }

    # Backwards: a peer is removed by index, and removing from the front would
    # renumber everything after it.
    for ($i = $Hub.Peer.Count - 1; $i -ge 0; $i--) {
        $peer = $Hub.Peer[$i]
        $gone = $false

        $text = $null
        try { $text = & $Read $peer.Conn } catch { $text = $null }

        if ($null -eq $text) {
            $gone = $true
        } elseif ($text) {
            $split = Split-NdjsonBuffer -Buffer $peer.Buffer -Text $text
            $peer.Buffer = $split.Rest
            if ($split.Overflow) {
                $Hub.Note = 'matrix: a machine sent a line too long to read, and it was dropped'
            }
            foreach ($line in $split.Line) {
                if (Read-RemoteLine -Hub $Hub -Peer $peer -Line $line -Now $Now) { $peer.LastMs = $Now }
                # The hub hangs up on a peer that failed the hello. Ignoring
                # it would hold a socket open to something that has already
                # proved it is not a reporting rain, and would re-read its lines
                # to the same verdict. It is told why first, best effort: the
                # socket is going anyway, so a failed write changes nothing.
                if ($peer.RefusedWhy) {
                    try { & $Write $peer.Conn (ConvertTo-RefusedLine -Why $peer.RefusedWhy) } catch { }
                    $gone = $true; break
                }
            }
        }

        # Answered as soon as the hello is in, and once. sshd accepts the peer's
        # connection whether or not a rain is behind it, and this line is what
        # tells the peer which it got. A welcome that cannot be written is a
        # connection that was never usable: drop it now rather than let it sit
        # out the whole drop window as a half-open peer.
        if (-not $gone -and $peer.Hello -and -not $peer.Welcomed) {
            $peer.Welcomed = $true
            try { & $Write $peer.Conn (ConvertTo-WelcomeLine) } catch { $gone = $true }
        }

        # Only after the read: a peer that closed and a peer that went quiet at the
        # same poll are the same outcome, and the close is the more specific one.
        if (-not $gone -and ($Now - $peer.LastMs) -gt $Hub.DropMs) { $gone = $true }

        if ($gone) {
            try { & $Close $peer.Conn } catch { }
            $Hub.Peer.RemoveAt($i)
        }
    }
}

function Read-RemoteLine {
    <#
    .SYNOPSIS
        Apply one line to a peer. True when it was a line worth counting as life.
    .DESCRIPTION
        A refused or unreadable line does not refresh LastMs. A peer that sends
        nothing but noise has to go stale like a peer that sends nothing at all.
    #>
    param([Parameter(Mandatory)] [hashtable] $Hub,
          [Parameter(Mandatory)] [hashtable] $Peer,
          [Parameter(Mandatory)] [AllowEmptyString()] [string] $Line,
          [Parameter(Mandatory)] [long] $Now)

    $o = ConvertFrom-WireLine $Line
    if (-not $Peer.Hello) {
        $why = Test-RemoteHello $o -Token $Hub.Token
        if ($why) {
            $Hub.Note = "matrix: a machine was refused, $why"
            # Test-RemoteHello answers a reason or nothing, so this doubles as
            # the flag that the peer failed: one field, no pair to keep in step.
            $Peer.RefusedWhy = $why
            return $false
        }
        $Peer.Hello = $true
        # The refusal note is stale as soon as one peer gets in.
        $Hub.Note = ''
        $Peer.Machine = ConvertTo-WireText $o.machine 64
        $helloNow = ConvertTo-WireEpoch $o.now 0
        if ($helloNow -gt 0) { $Peer.Skew = $Now - $helloNow }
        return $true
    }

    if ($null -eq $o -or [string]$o.t -ne 'frame') { return $false }

    # Re-measured every frame, not taken once from the hello: a peer that runs for
    # hours drifts, and one that suspends and resumes drifts in a step.
    $peerNow = ConvertTo-WireEpoch $o.now 0
    if ($peerNow -gt 0) { $Peer.Skew = $Now - $peerNow }

    # The record cap is ConvertFrom-RemoteFrame's own default: one constant, in
    # wire.ps1, next to the other caps it belongs with.
    $Peer.Session = @(ConvertFrom-RemoteFrame -Frame $o -Peer $Peer -SkewMs $Peer.Skew)
    $true
}

function Get-RemoteSession {
    <#
    .SYNOPSIS
        Every connected machine's sessions, ready to hand to Get-SessionLanes.
    .DESCRIPTION
        A machine that has gone quiet keeps its lanes and turns grey. The copy is
        deliberate. The stored session keeps its real status, so the lane returns
        to its old colour when the machine reports again.

        Two ssh sessions to one machine both reach the same forwarded port, so the
        same session can arrive twice. The peer that spoke most recently wins.
    #>
    param([Parameter(Mandatory)] [hashtable] $Hub, [Parameter(Mandatory)] [long] $Now)

    # Oldest peer first, so the last write wins and "most recent speaker wins"
    # needs no second dictionary of times to compare against.
    $best = [ordered]@{}
    foreach ($peer in @($Hub.Peer | Sort-Object { $_.LastMs })) {
        if (-not $peer.Hello) { continue }
        $stale = ($Now - $peer.LastMs) -gt $Hub.StaleMs
        foreach ($s in $peer.Session) {
            $out = $s
            if ($stale) {
                $out = $s.PSObject.Copy()
                $out.Status = 'offline'
                $out.WaitingFor = ''
                $out.Style = Get-SessionStyle 'offline'
            }
            $best[$s.SessionId] = $out
        }
    }
    # No comma-wrap: the caller collects with @(). See Split-Wrap in lanes.ps1.
    @($best.Values)
}

function Get-RemotePeer {
    # The peer a lane came from, by the machine name its session id carries.
    # Most recent speaker first, which is the rule Get-RemoteSession applies when
    # two peers report the same machine name.
    param([Parameter(Mandatory)] [hashtable] $Hub, [Parameter(Mandatory)] $Session)
    foreach ($peer in @($Hub.Peer | Sort-Object { $_.LastMs } -Descending)) {
        if ($peer.Hello -and $peer.Machine -eq $Session.RemoteHost) { return $peer }
    }
    $null
}

function Resolve-RemoteTab {
    <#
    .SYNOPSIS
        The local tab holding this machine's ssh session, or nothing.
    .DESCRIPTION
        Two routes, exact one first. The port comes off the accepted socket, and
        Resolve-PeerProcessId turns it into the pid of the local ssh client. From
        there it is Resolve-TabByPid, which stops at the nearest tab. That answer
        is cached per peer, miss included: the ssh client's pid does not change
        for the life of the connection, and ss is an external call.

        Where no pid names a tab, the backend's own Resolve-MachineTab answers
        instead, by whatever its terminal gives it. It is asked on every click
        rather than cached, because what it reads can change between two of them.
        A backend with nothing to answer says so without reading anything, which
        is why it is handed the reader and not the tabs.

        Resolved on the click, not on the poll. A tab read costs about 100 ms, and
        the frame loop must not pay it once a second for a click that may never
        come. Between the two routes it is paid at most once.
    .PARAMETER OwnerOf
        port -> the pid holding it. Injected, so this is testable with no socket.
    .PARAMETER Ancestors
        pid -> the pid and every pid above it.
    .PARAMETER ReadTab
        -> every tab of every window.
    #>
    param([Parameter(Mandatory)] [hashtable] $Peer,
          [scriptblock] $OwnerOf = { param($port) Resolve-PeerProcessId -Port $port },
          [scriptblock] $Ancestors = ${function:Get-ProcessAncestorId},
          [scriptblock] $ReadTab = { Get-AllTerminalTab })

    if ($Peer.Tab) { return $Peer.Tab }

    if (-not $Peer.PidTried) {
        $Peer.PidTried = $true
        $port = 0
        if ($Peer.Conn) { $port = [int]$Peer.Conn.PeerPort }
        $owner = 0
        if ($port -gt 0) { try { $owner = [int](& $OwnerOf $port) } catch { $owner = 0 } }
        if ($owner -gt 0) {
            try {
                $tabPids = @{}
                foreach ($tab in @(& $ReadTab)) { if ($tab -and $tab.Pid) { $tabPids[[int]$tab.Pid] = $tab } }
                $Peer.Tab = Resolve-TabByPid -ProcessId $owner -TabPid $tabPids -Ancestors $Ancestors
            } catch { }
        }
        if ($Peer.Tab) { return $Peer.Tab }
    }

    if (-not $Peer.Machine) { return $null }
    try { Resolve-MachineTab -Machine $Peer.Machine -ReadTab $ReadTab } catch { $null }
}

function Send-RemoteCommand {
    <#
    .SYNOPSIS
        Write one line to a peer. False when it could not be written.
    .DESCRIPTION
        A failed write is not fatal here: the peer is dropped on its next read,
        which is the one place a connection is removed.
    #>
    param([Parameter(Mandatory)] [hashtable] $Peer,
          [Parameter(Mandatory)] [string] $Line,
          [Parameter(Mandatory)] [scriptblock] $Write)
    if (-not $Peer.Hello) { return $false }
    try { & $Write $Peer.Conn $Line; return $true } catch { return $false }
}

function Stop-RemoteHub {
    # Hang up on everyone. The rain calls this from its finally, so a peer is not
    # left holding a socket against a process that is gone.
    param([Parameter(Mandatory)] [hashtable] $Hub, [Parameter(Mandatory)] [scriptblock] $Close)
    foreach ($peer in $Hub.Peer) { try { & $Close $peer.Conn } catch { } }
    $Hub.Peer.Clear()
}
