# The reporting side: this machine's sessions, sent to the rain on the machine the
# user is sitting at. Needs wire.ps1, and sessions.ps1 behind it.
#
# The connection is dialled out, not listened for. With
#
#   ~/.ssh/config     RemoteForward 127.0.0.1:9999 127.0.0.1:9999
#
# sshd is already listening on this machine's loopback and forwards to the rain.
# So this end connects to its own 127.0.0.1 and nothing here has to know that ssh
# is in the middle.
#
# Refused is the normal state, not an error. The user starts the report before the
# rain, or the ssh session goes and comes back, and the loop below keeps
# trying. It never throws into the caller, because the caller is a frame loop.
#
# A connect proves only that sshd took it: it does the same with no rain behind
# it. Connected means the rain answered the hello. Get-ExposeStatus says which.

function New-ExposeState {
    <#
    .SYNOPSIS
        What Update-Expose keeps between polls.
    .PARAMETER Machine
        The name the rain shows in front of every lane from here. The host name,
        unless the user names it, because that is what they typed after ssh.

        No address or port here: dialling is entirely the injected Connect
        block's business, and a port on this state would read as if the state
        machine used it.
    .PARAMETER RetryMs
        How long to wait after a refused connect. The caller raises it to its own
        poll interval where that is longer: a dial only happens on a poll.
    .PARAMETER RefusedMs
        How long a refusal stays on the status. Five retries, not five seconds:
        shorter than the redial and the reason blinks out between two refusals.
    #>
    param([Parameter(Mandatory)] [string] $Machine,
          [AllowEmptyString()] [string] $Token = '',
          [int] $RetryMs = 1000,
          [int] $RefusedMs = 0)

    if ($RefusedMs -le 0) { $RefusedMs = 5 * $RetryMs }

    @{
        Machine = $Machine; Token = $Token; RetryMs = $RetryMs; RefusedMs = $RefusedMs
        Conn = $null
        Dialled = $false   # the last dial was taken, whether or not it survived
        Welcomed = $false  # the rain has answered the hello on this connection
        RefusedWhy = ''    # why the rain last refused this machine
        RefusedAt = 0      # when it said so; RefusedMs runs from here
        Buffer = ''        # the partial control line held over from the last read
        Seq = 0
        RetryAt = 0        # the next moment a connect is worth trying
    }
}

function Get-ExposeStatus {
    <#
    .SYNOPSIS
        Where the report stands with the host, in the words -Stats shows.
    .DESCRIPTION
        host waiting       nothing takes the connection: no forward, or wrong port
        host connecting    taken, unanswered. A host with no rain holds here
        host connected     the rain welcomed this machine
        host refused: ...  the rain said no, and why

        Read off the last DIAL, not the live connection: a host with no rain
        accepts and drops every second, and that must not flap the status.
    #>
    param([Parameter(Mandatory)] [hashtable] $State)
    if ($State.RefusedWhy)    { return "host refused: $($State.RefusedWhy)" }
    if (-not $State.Dialled)  { return 'host waiting' }
    if (-not $State.Welcomed) { return 'host connecting' }
    'host connected'
}

function Get-ExposeMachineName {
    # The host name, cut at the first dot: a lane header has no room for a fully
    # qualified name, and the user knows the machine by what they type after ssh.
    # A name the user gave is cut too, for the same reason.
    param([AllowEmptyString()] [string] $Given = '')
    $name = $Given
    if (-not $name) {
        try { $name = [System.Net.Dns]::GetHostName() } catch { }
    }
    if (-not $name) { $name = $env:HOSTNAME }
    if (-not $name) { $name = $env:COMPUTERNAME }
    if (-not $name) { $name = 'remote' }
    ConvertTo-WireText (($name -split '\.')[0]) 64
}

function Update-Expose {
    <#
    .SYNOPSIS
        One poll: connect if needed, send a frame, and act on anything sent back.
    .DESCRIPTION
        Never throws. A frame loop calls this, and a machine that is not listening
        must cost the caller nothing at all.
    .PARAMETER Connect
        -> a connection, or nothing when the port is refused.
    .PARAMETER Read
        conn -> waiting text, '' when none, $null when the far end closed.
    .PARAMETER Write
        conn, line -> writes it. Throwing is how it reports a broken pipe.
    .PARAMETER Focus
        session id -> switches to it. The one thing the rain can ask for.
    .PARAMETER Title
        -> titles the tab this ssh session runs in. Called on the edge into
        welcomed, and only there: a welcome is the first proof a rain is
        reading, and every later welcome starts a connection this end has not
        titled for. A redial after the ssh session came back is a new tab; a
        redial after the rain restarted is the same tab and the same title, so
        writing on every edge costs one sequence and can never miss one.
    #>
    param([Parameter(Mandatory)] [hashtable] $State,
          [Parameter(Mandatory)] [long] $Now,
          [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
          [Parameter(Mandatory)] [scriptblock] $Connect,
          [Parameter(Mandatory)] [scriptblock] $Read,
          [Parameter(Mandatory)] [scriptblock] $Write,
          [Parameter(Mandatory)] [scriptblock] $Close,
          [scriptblock] $Focus = $null,
          [scriptblock] $Title = $null)

    # A refusing rain re-states it on every redial; a stopped one never will, and
    # sshd keeps taking the connection either way.
    if ($State.RefusedWhy -and ($Now - $State.RefusedAt) -gt $State.RefusedMs) {
        $State.RefusedWhy = ''
    }

    if (-not $State.Conn) {
        if ($Now -lt $State.RetryAt) { return }
        $State.RetryAt = $Now + $State.RetryMs
        $conn = $null
        try { $conn = & $Connect } catch { $conn = $null }
        if (-not $conn) {
            # Nothing takes the connection now: what the rain last said is stale.
            $State.Dialled = $false
            $State.RefusedWhy = ''
            return
        }
        $State.Dialled = $true

        # The hello goes out on the same poll as the connect. A connection that
        # has not said which machine it is shows the rain a peer and no lanes.
        try {
            & $Write $conn (ConvertTo-HelloLine -Machine $State.Machine -Token $State.Token -Now $Now)
        } catch {
            try { & $Close $conn } catch { }
            return
        }
        $State.Conn = $conn
        $State.Buffer = ''
    }

    # Read before writing. A rain that has gone should cost one poll, not a frame
    # written into a socket that is already shut.
    $text = $null
    try { $text = & $Read $State.Conn } catch { $text = $null }
    if ($null -eq $text) { Reset-Expose -State $State -Close $Close; return }
    if ($text) {
        $split = Split-NdjsonBuffer -Buffer $State.Buffer -Text $text
        $State.Buffer = $split.Rest
        foreach ($line in $split.Line) {
            $o = ConvertFrom-WireLine $line
            if ($null -eq $o) { continue }
            switch ([string]$o.t) {
                'welcome' {
                    # Before the flag, so the edge IS the flag and no local has
                    # to survive the assignment. Swallowed like the focus below:
                    # a tab that keeps its old name costs a click, and a throw
                    # here costs the frame loop.
                    if ($Title -and -not $State.Welcomed) { try { & $Title } catch { } }
                    $State.Welcomed = $true
                    $State.RefusedWhy = ''
                }
                'refused' {
                    # Filtered like every string from a peer: it reaches a screen.
                    $why = ConvertTo-WireText $o.why 64
                    $State.RefusedWhy = if ($why) { $why } else { 'no reason given' }
                    $State.RefusedAt = $Now
                }
                'focus' {
                    # The id is looked up, never trusted: an id this machine does
                    # not run finds no tab and the switch does not happen. The
                    # rain is trusted to ask, not to invent.
                    $want = [string]$o.id
                    if ($Focus -and $want) { try { & $Focus $want } catch { } }
                }
            }
        }
    }

    $State.Seq++
    try {
        & $Write $State.Conn (ConvertTo-FrameLine -Session $Session -Now $Now -Seq $State.Seq)
    } catch {
        Reset-Expose -State $State -Close $Close
    }
}

function Reset-Expose {
    # Hang up and wait out the retry before dialling again. Reconnecting on the
    # very next poll after a broken pipe breaks it again.
    param([Parameter(Mandatory)] [hashtable] $State, [Parameter(Mandatory)] [scriptblock] $Close)
    if ($State.Conn) { try { & $Close $State.Conn } catch { } }
    $State.Conn = $null
    $State.Welcomed = $false
    $State.Buffer = ''
}

function Test-ExposeSupport {
    <#
    .SYNOPSIS
        What reporting from this machine can do, said in words, or '' when it can
        do everything.
    .DESCRIPTION
        Not a refusal. Reporting works anywhere. Only the switch a click asks for
        needs tmux, because the switch is a tmux command. A click that quietly
        does nothing reads as a bug, so the rain says the limit once instead.
    #>
    param([string] $Tmux = $env:TMUX)
    if (-not $Tmux) {
        return 'matrix: not inside tmux, so sessions are reported but a click cannot switch to one'
    }
    ''
}
