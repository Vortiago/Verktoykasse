# The protocol the reporting side speaks to the rain, and nothing else. No sockets,
# no clock, no state: a string in, a verdict or a session out. That is what lets
# every terminal quirk of this format be tested on both platforms without a peer.
#
# Needs ConvertTo-CellText from console.ps1 and Get-SessionStyle from sessions.ps1.
# Dot-source both first, the way tabmap.ps1 needs Get-ProcessAncestorId.
#
# One JSON object per line, UTF-8, no BOM. The first line of a connection is the
# hello and names the machine. Every line after it is a frame:
#
#   {"v":1,"t":"hello","machine":"lab1","token":"...","now":1756...}
#   {"v":1,"t":"frame","seq":12,"now":1756...,"sessions":[ ... ]}
#   {"v":1,"t":"focus","id":"a1b2"}                    the one line the rain sends
#
# A session record carries what the lane header prints and nothing more. The
# reporting side computes its own title and task, so the rain never reads a
# transcript it cannot see and never needs another machine's working directory.

# The version this code speaks. A peer announcing anything else is refused by
# name, because a silent mismatch shows as lanes that never appear.
$script:WireVersion = 1

# Caps. Every one of them exists because a peer on a loopback port is not
# trusted input: it can be a stuck process, an old build, or another user on
# that machine.
$script:WireMaxLine     = 65536   # one line, in characters
$script:WireMaxSessions = 32      # records taken from one frame
$script:WireMaxTask     = 2048    # a task string, before the lane wraps it
$script:WireMaxText     = 256     # a title, a machine name, a waitingFor

function Split-NdjsonBuffer {
    <#
    .SYNOPSIS
        Add a read to a peer's buffer and take out the whole lines.
    .DESCRIPTION
        Returns Line (the complete lines, in order), Rest (the partial line still
        waiting) and Overflow (true when the buffer was dropped for length).

        A read is not a message boundary, so the leftover has to survive to the
        next poll. This strips a trailing CR, because a peer on Windows writes
        CRLF and the JSON must not arrive with one glued to it.
    .PARAMETER MaxLine
        The buffer is dropped whole once it passes this without a newline. A peer
        that never sends one would otherwise grow a host string without bound.
    #>
    param([AllowEmptyString()] [string] $Buffer,
          [AllowEmptyString()] [string] $Text,
          [int] $MaxLine = $script:WireMaxLine)

    # Not "$Buffer$Text": on the common poll nothing was held over, and the
    # interpolation would copy the whole frame to say so.
    $all = if ($Buffer) { $Buffer + $Text } else { $Text }
    if ($all.Length -gt $MaxLine -and -not $all.Contains("`n")) {
        # Drop the buffer, not just the excess: the tail of an oversize line is
        # not parseable on its own, and keeping it would resync inside a value.
        return @{ Line = @(); Rest = ''; Overflow = $true }
    }

    # String.Split, not -split: the operator takes a regex, and this runs against a
    # frame-sized string once per machine per poll.
    $parts = $all.Split([char]10)
    # -split always returns one more part than there are newlines. The last part
    # is the partial line, and it is '' when the text ended on a newline.
    $rest = $parts[$parts.Count - 1]
    $out = [System.Collections.Generic.List[string]]::new()
    for ($i = 0; $i -lt $parts.Count - 1; $i++) {
        $line = $parts[$i].TrimEnd("`r")
        if ($line) { $out.Add($line) }
    }
    @{ Line = $out.ToArray(); Rest = $rest; Overflow = $false }
}

function ConvertFrom-WireLine {
    <#
    .SYNOPSIS
        One line to an object, or nothing.
    .DESCRIPTION
        Nothing, never a throw: this runs on the poll path against text another
        machine wrote, and a malformed line must cost one line, not the rain.
    #>
    param([AllowEmptyString()] [string] $Line)
    if (-not $Line) { return $null }
    try {
        $o = ConvertFrom-Json $Line
    } catch { return $null }
    if ($null -eq $o -or $o -isnot [pscustomobject]) { return $null }
    if (($o.v -as [int]) -ne $script:WireVersion) { return $null }
    $o
}

function Test-RemoteHello {
    <#
    .SYNOPSIS
        Why this hello is not acceptable, or '' when it is.
    .DESCRIPTION
        A reason string, not a boolean: the caller logs it once per peer, and
        "wrong token" and "no machine name" need different fixes.
    .PARAMETER Token
        Empty means no token is configured, so the rain accepts any peer. That is
        the first-run case, and the rain says so once at startup rather than
        refusing every connection with no explanation.
    #>
    param($Hello, [AllowEmptyString()] [string] $Token = '')

    if ($null -eq $Hello)          { return 'not JSON, or a version this build does not speak' }
    if ([string]$Hello.t -ne 'hello') { return 'first line was not a hello' }
    $machine = ConvertTo-WireText $Hello.machine
    if (-not $machine)             { return 'hello carried no machine name' }
    if ($Token -and [string]$Hello.token -ne $Token) { return 'wrong token' }
    ''
}

function ConvertTo-WireText {
    <#
    .SYNOPSIS
        A string from a peer, made safe to draw and bounded in length.
    .DESCRIPTION
        Every string that reaches a lane header goes through here. Read-TaskLine
        filters the local path. This path has no such gate, and a peer that can
        write raw CSI into the alternate screen buffer owns the screen.
    #>
    param($Value, [int] $Max = $script:WireMaxText)
    if ($null -eq $Value) { return '' }
    $s = ConvertTo-CellText ([string]$Value)
    if ($s.Length -gt $Max) { $s = $s.Substring(0, $Max) }
    $s
}

function ConvertTo-RemoteSession {
    <#
    .SYNOPSIS
        One record from a frame, in the shape the lanes and the tab map read.
    .DESCRIPTION
        Nothing for a record with no id: an unidentified lane cannot be updated
        and cannot route a click.

        Name carries the machine, and NameSource says 'user' so Get-SessionTitle
        never looks for a transcript that is on another machine.

        Pid stays 0, so a remote lane can never match a local tab. See the merge
        in matrix.ps1 for why that matters.
    .PARAMETER SkewMs
        Rain clock minus peer clock. The peer sends its own epoch milliseconds,
        and Format-Age subtracts from the rain's UtcNow. Unadjusted, a machine two
        minutes out shows a two minute age on a session that changed a moment ago.
    #>
    param([Parameter(Mandatory)] $Record,
          [Parameter(Mandatory)] [hashtable] $Peer,
          [long] $SkewMs = 0)

    $id = ConvertTo-WireText $Record.id 64
    if (-not $id) { return $null }

    $status = [string]$Record.status
    if ($status -ne 'busy' -and $status -ne 'waiting' -and $status -ne 'idle') { $status = 'idle' }

    $title = ConvertTo-WireText $Record.title
    if (-not $title) { $title = $id }

    [pscustomobject]@{
        Pid          = 0
        SessionId    = "$($Peer.Machine)/$id"
        Name         = "$($Peer.Machine): $title"
        NameSource   = 'user'
        Cwd          = '?'
        Status       = $status
        WaitingFor   = ConvertTo-WireText $Record.waitingFor
        StartedAt    = (ConvertTo-WireEpoch $Record.startedAt $SkewMs)
        UpdatedAt    = (ConvertTo-WireEpoch $Record.updatedAt $SkewMs)
        Style        = Get-SessionStyle $status
        Task         = ConvertTo-WireText $Record.task $script:WireMaxTask
        RemoteHost   = $Peer.Machine
        RemoteId     = $id
    }
}

function ConvertTo-WireEpoch {
    # Zero for anything unreadable, which is what Format-Age already prints as no
    # age at all. A negative result is left alone: Format-Age drops it too.
    param($Value, [long] $SkewMs)
    [long] $ms = 0
    if (-not [long]::TryParse([string]$Value, [ref] $ms)) { return 0 }
    if ($ms -le 0) { return 0 }
    $ms + $SkewMs
}

function ConvertFrom-RemoteFrame {
    <#
    .SYNOPSIS
        A frame's records, capped, in the rain's session shape.
    #>
    param([Parameter(Mandatory)] $Frame,
          [Parameter(Mandatory)] [hashtable] $Peer,
          [long] $SkewMs = 0,
          [int] $MaxSessions = $script:WireMaxSessions)

    $out = [System.Collections.Generic.List[object]]::new()
    foreach ($r in @($Frame.sessions)) {
        if ($out.Count -ge $MaxSessions) { break }
        if ($null -eq $r) { continue }
        $s = ConvertTo-RemoteSession -Record $r -Peer $Peer -SkewMs $SkewMs
        if ($s) { $out.Add($s) }
    }
    # No comma-wrap: the caller collects with @(). See Split-Wrap in lanes.ps1.
    $out.ToArray()
}

function ConvertTo-HelloLine {
    param([Parameter(Mandatory)] [string] $Machine,
          [AllowEmptyString()] [string] $Token = '',
          [Parameter(Mandatory)] [long] $Now)
    ConvertTo-Json -Compress -InputObject ([ordered]@{
        v = $script:WireVersion; t = 'hello'; machine = $Machine; token = $Token; now = $Now
    })
}

function ConvertTo-FrameLine {
    <#
    .SYNOPSIS
        One frame from this machine's live sessions.
    #>
    param([Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
          [Parameter(Mandatory)] [long] $Now,
          [int] $Seq = 0)

    $records = foreach ($s in $Session) {
        [ordered]@{
            id         = $s.SessionId
            status     = $s.Status
            waitingFor = $s.WaitingFor
            title      = (Get-SessionTitle $s)
            task       = $s.Task
            startedAt  = $s.StartedAt
            updatedAt  = $s.UpdatedAt
        }
    }
    # -Depth: the default of 2 flattens the records inside the array to their
    # type names. The @() around $records matters as much: a foreach over one
    # session yields a scalar, and a scalar there would write an object where the
    # reader expects a list.
    ConvertTo-Json -Compress -Depth 4 -InputObject ([ordered]@{
        v = $script:WireVersion; t = 'frame'; seq = $Seq; now = $Now
        sessions = @($records)
    })
}

function ConvertTo-FocusLine {
    <#
    .SYNOPSIS
        The one line the rain sends: switch to the session behind this lane.
    .DESCRIPTION
        The session id is enough. The reporting machine looks it up in the tab map
        it already keeps, which is the same lookup the local click path does, and
        it happens at click time rather than off a frame that may be a second old.
        Sending a window id instead would ship a value that never leaves the
        machine that produced it.
    #>
    param([Parameter(Mandatory)] $Session)
    ConvertTo-Json -Compress -InputObject ([ordered]@{
        v = $script:WireVersion; t = 'focus'; id = [string]$Session.RemoteId
    })
}
