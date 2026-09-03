# The only file here that touches a socket. Everything above it - the wire format
# and the hub - is pure, and this is the seam they are pure against.
#
# The carrier is one TCP connection per machine, riding the ssh session the user
# already opened:
#
#   ~/.ssh/config     RemoteForward 127.0.0.1:47777 127.0.0.1:47777
#
# The remote connects to its own loopback, sshd hands the channel to the local ssh
# client, and the ssh client connects to this listener. Every machine uses the
# same port and is told apart by the hello, so one listener serves all of them.
#
# Loopback only, never 0.0.0.0. A wider bind reaches the network, and on Windows
# it raises a firewall prompt the first time the rain runs.
#
# Nothing here blocks. This runs inside the frame loop, where a stall shows as a
# dropped frame, so every call is gated on Pending or DataAvailable first.

$script:TcpReadBufferSize = 8192
$script:TcpReceiveTimeout = 200    # ms, a backstop only: reads are gated first
$script:TcpSendTimeout    = 500

function Start-RemoteListener {
    <#
    .SYNOPSIS
        Listen on the loopback port every machine forwards to.
    .DESCRIPTION
        Returns Listener and Port, or Reason when the port could not be bound.
        A reason, not a throw: a second rain on the same machine must say what is
        wrong and keep showing local lanes, not die at startup.
    .PARAMETER Port
        0 asks the operating system for a free one, which is what the tests use.
        Read the real number back from the returned Port.
    #>
    param([Parameter(Mandatory)] [int] $Port)

    try {
        # Loopback, hard-coded. An address parameter here would be the one way to
        # break the rule the file header states, and nothing needs it.
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        # Set before Start, and set on purpose. Without it, Windows lets a second
        # process bind a port this one already listens on, and the two rains take
        # alternate connections.
        try { $listener.ExclusiveAddressUse = $true } catch { }
        $listener.Start(8)
        return @{ Listener = $listener; Port = $listener.LocalEndpoint.Port; Reason = '' }
    } catch {
        return @{ Listener = $null; Port = 0; Reason = $_.Exception.Message }
    }
}

function Stop-RemoteListener {
    param($Listener)
    if (-not $Listener) { return }
    try { $Listener.Stop() } catch { }
}

function New-RemoteConnection {
    <#
    .SYNOPSIS
        Wrap a TcpClient in what the reader needs to keep between polls.
    .DESCRIPTION
        A read can split a multi-byte character down the middle, and a fresh
        Encoding.GetString on each half turns one letter into two replacement
        characters. A Decoder holds the tail bytes until the rest arrives.

        PeerPort is the source port of the far end, which under a RemoteForward is
        the local ssh client. That is how a click finds its tab.
    #>
    param([Parameter(Mandatory)] $Client)

    $Client.NoDelay = $true
    $Client.ReceiveTimeout = $script:TcpReceiveTimeout
    $Client.SendTimeout = $script:TcpSendTimeout

    $peerPort = 0
    try { $peerPort = $Client.Client.RemoteEndPoint.Port } catch { }

    # One encoding for both the decoder and the char buffer size. A decoder that
    # holds a partial sequence can emit one more char than the byte count, so the
    # buffer must be GetMaxCharCount wide or GetChars throws on a full read.
    $enc = [System.Text.UTF8Encoding]::new($false)

    @{
        Client = $Client
        Stream = $Client.GetStream()
        Decoder = $enc.GetDecoder()
        Buffer = [byte[]]::new($script:TcpReadBufferSize)
        Chars = [char[]]::new($enc.GetMaxCharCount($script:TcpReadBufferSize))
        PeerPort = $peerPort
    }
}

function Receive-RemoteConnection {
    <#
    .SYNOPSIS
        The connections waiting right now, and no more than Max of them.
    .DESCRIPTION
        Pending is a select with a zero timeout, so this costs microseconds when
        nothing is waiting, which is every poll but a handful. The cap stops a
        burst of connections from owning one frame.
    #>
    param($Listener, [int] $Max = 8)
    if (-not $Listener) { return @() }
    $out = [System.Collections.Generic.List[hashtable]]::new()
    try {
        while ($out.Count -lt $Max -and $Listener.Pending()) {
            $out.Add((New-RemoteConnection -Client $Listener.AcceptTcpClient()))
        }
    } catch { }
    $out.ToArray()
}

function Read-RemoteText {
    <#
    .SYNOPSIS
        The text waiting on a connection. '' when none, $null when it closed.
    .DESCRIPTION
        Closure is checked before the read, not by waiting for one to fail. A
        socket the far end shut reports readable with nothing available, and a
        read on it returns 0 forever without ever raising.
    #>
    param([Parameter(Mandatory)] [hashtable] $Conn, [int] $Max = 65536)

    try {
        $sock = $Conn.Client.Client
        if ($sock.Poll(0, [System.Net.Sockets.SelectMode]::SelectRead) -and $Conn.Client.Available -eq 0) {
            return $null
        }
        $text = ''
        while ($Conn.Stream.DataAvailable -and $text.Length -lt $Max) {
            $n = $Conn.Stream.Read($Conn.Buffer, 0, $Conn.Buffer.Length)
            if ($n -le 0) { return $null }
            $chars = $Conn.Decoder.GetChars($Conn.Buffer, 0, $n, $Conn.Chars, 0)
            if ($chars -gt 0) { $text += [string]::new($Conn.Chars, 0, $chars) }
        }
        return $text
    } catch {
        return $null
    }
}

function Write-RemoteLine {
    # One line, one write, with the newline the reader splits on. Throws on a
    # broken pipe: the caller decides whether that costs the peer or the run.
    param([Parameter(Mandatory)] [hashtable] $Conn, [Parameter(Mandatory)] [string] $Line)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("$Line`n")
    $Conn.Stream.Write($bytes, 0, $bytes.Length)
    $Conn.Stream.Flush()
}

function Close-RemoteConnection {
    param($Conn)
    if (-not $Conn) { return }
    try { $Conn.Stream.Dispose() } catch { }
    try { $Conn.Client.Dispose() } catch { }
}

function Connect-RemoteEndpoint {
    <#
    .SYNOPSIS
        The reporting side: dial the forwarded port. Nothing when it is not there.
    .DESCRIPTION
        Refused is the normal case, not an error. The ssh session may not be up
        yet, or the forward may have gone with it, and the caller retries.
    .PARAMETER TimeoutMs
        Short, because a frame loop calls this. A refused loopback port answers in
        microseconds. Only one case is slower: sshd accepts locally and then finds
        no rain at the far end. A whole second of that reads as a freeze.
    #>
    param([string] $Address = '127.0.0.1', [Parameter(Mandatory)] [int] $Port, [int] $TimeoutMs = 200)
    $client = $null
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        if (-not $client.ConnectAsync($Address, $Port).Wait($TimeoutMs)) {
            $client.Dispose(); return $null
        }
        return New-RemoteConnection -Client $client
    } catch {
        if ($client) { try { $client.Dispose() } catch { } }
        return $null
    }
}

# --- Which local process holds the ssh session -----------------------------------

function ConvertTo-SocketOwnerId {
    <#
    .SYNOPSIS
        The pid out of one `ss -tnp` row, or 0.
    .DESCRIPTION
        Split from the call the way ConvertTo-TmuxTab is split from Invoke-Tmux,
        so Windows CI covers this parse even though only Linux runs it.

        The row ends in the process list, for example:
            users:(("ssh",pid=169854,fd=3))
        Several processes can share a socket, and the first is the one that
        opened it.
    #>
    param([AllowEmptyString()] [string] $Line)
    if (-not $Line) { return 0 }
    $m = [regex]::Match($Line, 'pid=(\d+)')
    if (-not $m.Success) { return 0 }
    [int]$m.Groups[1].Value
}

function Invoke-Ss {
    # The external call, alone in its own function so the parse above can be
    # tested without one. Same shape as Invoke-Tmux.
    param([string[]] $SsArgs)
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = 'ss'
    foreach ($a in $SsArgs) { $psi.ArgumentList.Add($a) }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    # $p exists only once Start answers, and a missing ss throws here. The finally
    # must survive a failed start, the way Invoke-Tmux's does.
    $p = $null
    try {
        $p = [System.Diagnostics.Process]::Start($psi)
        # Both pipes drained at once: reading one to the end first deadlocks when
        # the other fills. The lesson Invoke-Tmux carries.
        $out = $p.StandardOutput.ReadToEndAsync()
        $err = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit(2000)) {
            # Kill it rather than read .Result, which waits with no bound at all.
            # This is reached from a click, and a hung ss would hang the rain.
            try { $p.Kill() } catch { }
            return ''
        }
        [void]$err.Result
        $out.Result
    } catch {
        ''
    } finally {
        if ($p) { $p.Dispose() }
    }
}

function Resolve-PeerProcessId {
    <#
    .SYNOPSIS
        The local process that owns a source port, or 0.
    .DESCRIPTION
        With a RemoteForward, the process connecting to this listener is the local
        ssh client, and its source port names it.

        The caller reads that port off the accepted socket, never off anything the
        peer sent. A peer that could name its own ssh could steal a click.
    .PARAMETER Call
        Test seam: port -> the `ss` output for it.
    #>
    param([Parameter(Mandatory)] [int] $Port,
          [scriptblock] $Call = { param($p) Invoke-Ss @('-Htnp', 'state', 'established', "( sport = :$p )") })

    if ($Port -le 0) { return 0 }
    if ($IsWindows) {
        # No ss here, and the Windows backend matches tabs on title rather than on
        # a pid, so there is nothing to feed. Answered as unknown, not guessed.
        return 0
    }
    try {
        foreach ($line in (& $Call $Port) -split "`n") {
            $found = ConvertTo-SocketOwnerId $line
            if ($found -gt 0) { return $found }
        }
    } catch { }
    0
}
