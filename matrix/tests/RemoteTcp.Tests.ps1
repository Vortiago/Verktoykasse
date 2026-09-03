# The socket layer, against real loopback sockets. Loopback behaves the same on
# both runners, so nothing here is skipped by platform except the `ss` lookup,
# whose parse is split out and tested everywhere.
#
# Port 0 throughout: the operating system hands out a free one and the test reads
# it back. A fixed port would fight a real rain running on the same machine.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/remote/tcp.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')   # Wait-Until

    # A listener and one connected pair, which is what most cases below need.
    function New-TestPair {
        $l = Start-RemoteListener -Port 0
        $client = [System.Net.Sockets.TcpClient]::new()
        $client.Connect('127.0.0.1', $l.Port)
        # @() around the call: a function returning one element unrolls it, and a
        # lone hashtable answers .Count with its key count and [0] with nothing.
        [void](Wait-Until { $script:got = @(Receive-RemoteConnection -Listener $l.Listener)
                            $script:got.Count -gt 0 })
        @{ L = $l; Client = $client; Stream = $client.GetStream(); Conn = $script:got[0] }
    }

    function Send-TestText ($Pair, [string] $Text) {
        $b = [System.Text.Encoding]::UTF8.GetBytes($Text)
        $Pair.Stream.Write($b, 0, $b.Length); $Pair.Stream.Flush()
    }

    function Close-TestPair ($Pair) {
        if ($Pair.Conn) { Close-RemoteConnection $Pair.Conn }
        if ($Pair.Stream) { try { $Pair.Stream.Dispose() } catch { } }
        if ($Pair.Client) { try { $Pair.Client.Dispose() } catch { } }
        if ($Pair.L) { Stop-RemoteListener $Pair.L.Listener }
    }
}

Describe 'tcp: the listener' {
    It 'binds loopback and reports the port it got' {
        $l = Start-RemoteListener -Port 0
        try {
            $l.Reason | Should -Be ''
            $l.Port | Should -BeGreaterThan 0
        } finally { Stop-RemoteListener $l.Listener }
    }

    It 'gives a reason instead of throwing when the port is already bound' {
        # A second rain on one machine must say what is wrong and keep showing
        # local lanes, not die at startup.
        $first = Start-RemoteListener -Port 0
        try {
            $second = Start-RemoteListener -Port $first.Port
            try {
                $second.Listener | Should -BeNullOrEmpty
                $second.Reason | Should -Not -Be ''
            } finally { Stop-RemoteListener $second.Listener }
        } finally { Stop-RemoteListener $first.Listener }
    }

    It 'answers at once when nothing is waiting' {
        # The no-stall assertion. This runs inside the frame loop, where a frame
        # is 33 ms at the default rate.
        $l = Start-RemoteListener -Port 0
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            foreach ($i in 1..20) { [void](Receive-RemoteConnection -Listener $l.Listener) }
            $sw.ElapsedMilliseconds | Should -BeLessThan 100
        } finally { Stop-RemoteListener $l.Listener }
    }

    It 'answers empty for a listener that never started' {
        @(Receive-RemoteConnection -Listener $null).Count | Should -Be 0
    }
}

Describe 'tcp: reading' {
    BeforeEach { $script:pair = New-TestPair }
    AfterEach  { Close-TestPair $pair }

    It 'takes text that is waiting' {
        Send-TestText $pair "hello`n"
        [void](Wait-Until { $script:seen = Read-RemoteText $pair.Conn; $script:seen })
        $seen | Should -Be "hello`n"
    }

    It 'answers empty, not closed, when the peer is merely quiet' {
        # The hub reads the two differently: one is a machine thinking and the
        # other is a machine gone.
        Read-RemoteText $pair.Conn | Should -Be ''
    }

    It 'answers closed once the peer hangs up' {
        # A socket the far end shut reports readable with nothing available. A
        # read on it returns 0 forever and never raises, so the check has to come
        # before the read.
        $pair.Stream.Dispose(); $pair.Client.Dispose()
        $pair.Stream = $null; $pair.Client = $null
        (Wait-Until { $null -eq (Read-RemoteText $pair.Conn) }) | Should -BeTrue
    }

    It 'reassembles a line written in two pieces' {
        Send-TestText $pair '{"a":'
        [void](Wait-Until { $script:one = Read-RemoteText $pair.Conn; $script:one })
        Send-TestText $pair "1}`n"
        [void](Wait-Until { $script:two = Read-RemoteText $pair.Conn; $script:two })
        "$one$two" | Should -Be "{`"a`":1}`n"
    }

    It 'keeps a character whose bytes land in different reads' {
        # The reason the connection carries a Decoder and not a fresh GetString
        # per read: a two-byte character split down the middle would come back as
        # two replacement characters, and the title would be wrong for good.
        $bytes = [System.Text.Encoding]::UTF8.GetBytes([string][char]0x00E5)   # a-ring
        $bytes.Length | Should -Be 2
        $pair.Stream.Write($bytes, 0, 1); $pair.Stream.Flush()
        # Wait for the byte itself, not for the read: a read answers '' whether
        # the half character arrived or nothing did, and only one of those is the
        # case under test.
        (Wait-Until { $pair.Conn.Client.Available -gt 0 }) | Should -BeTrue
        Read-RemoteText $pair.Conn | Should -Be ''    # half a character is no character
        $pair.Stream.Write($bytes, 1, 1); $pair.Stream.Flush()
        [void](Wait-Until { $script:rest = Read-RemoteText $pair.Conn; $rest })
        $rest | Should -Be ([string][char]0x00E5)
    }

    It 'reads a payload larger than one buffer' {
        $long = ('x' * 20000) + "`n"
        Send-TestText $pair $long
        $script:seen = ''
        [void](Wait-Until { $script:seen += (Read-RemoteText $pair.Conn)
                            $script:seen.Length -ge $long.Length })
        $script:seen | Should -Be $long
    }
}

Describe 'tcp: writing' {
    BeforeEach { $script:pair = New-TestPair }
    AfterEach  { Close-TestPair $pair }

    It 'writes one line, with the newline the reader splits on' {
        Write-RemoteLine -Conn $pair.Conn -Line '{"t":"focus"}'
        $buf = [byte[]]::new(256)
        [void](Wait-Until { $pair.Client.Available -gt 0 })
        $n = $pair.Stream.Read($buf, 0, $buf.Length)
        [System.Text.Encoding]::UTF8.GetString($buf, 0, $n) | Should -Be "{`"t`":`"focus`"}`n"
    }
}

Describe 'tcp: dialling out' {
    It 'connects to a listener that is there' {
        $l = Start-RemoteListener -Port 0
        try {
            $conn = Connect-RemoteEndpoint -Port $l.Port
            try {
                $conn | Should -Not -BeNullOrEmpty
                $conn.PeerPort | Should -BeGreaterThan 0
            } finally { Close-RemoteConnection $conn }
        } finally { Stop-RemoteListener $l.Listener }
    }

    It 'answers nothing when the port is refused, rather than throwing' {
        # The normal case on the reporting side: the ssh session is not up yet,
        # or its forward went with it. The caller retries.
        $l = Start-RemoteListener -Port 0
        $port = $l.Port
        Stop-RemoteListener $l.Listener
        Connect-RemoteEndpoint -Port $port -TimeoutMs 500 | Should -BeNullOrEmpty
    }

    It 'carries a line end to end' {
        $l = Start-RemoteListener -Port 0
        $conn = $null; $accepted = $null
        try {
            $conn = Connect-RemoteEndpoint -Port $l.Port
            [void](Wait-Until { $script:acc = @(Receive-RemoteConnection -Listener $l.Listener)
                                $script:acc.Count -gt 0 })
            $accepted = $acc[0]
            Write-RemoteLine -Conn $conn -Line 'up'
            [void](Wait-Until { $script:got = Read-RemoteText $accepted; $script:got })
            $got | Should -Be "up`n"
        } finally {
            Close-RemoteConnection $conn
            Close-RemoteConnection $accepted
            Stop-RemoteListener $l.Listener
        }
    }
}

Describe 'tcp: naming the local ssh process' {
    It 'takes the pid out of an ss row' {
        # Verified against a live socket on Linux: the row ends in the process
        # list, and the first entry is the process that opened it.
        ConvertTo-SocketOwnerId '0 0 127.0.0.1:34234 127.0.0.1:9999 users:(("ssh",pid=169854,fd=3))' |
            Should -Be 169854
    }

    It 'answers zero for a row with no process, and for no row' {
        ConvertTo-SocketOwnerId '0 0 127.0.0.1:34234 127.0.0.1:9999' | Should -Be 0
        ConvertTo-SocketOwnerId '' | Should -Be 0
    }

    It 'takes the first process when several share the socket' {
        ConvertTo-SocketOwnerId 'users:(("ssh",pid=11,fd=3),("ssh",pid=22,fd=4))' | Should -Be 11
    }

    It 'asks for the port it was given' -Skip:($IsWindows) {
        $script:seen = $null
        $call = { param($p) $script:seen = $p; 'users:(("ssh",pid=4242,fd=3))' }
        Resolve-PeerProcessId -Port 34234 -Call $call | Should -Be 4242
        $script:seen | Should -Be 34234
    }

    It 'answers zero when ss knows nothing' -Skip:($IsWindows) {
        Resolve-PeerProcessId -Port 34234 -Call { param($p) '' } | Should -Be 0
    }

    It 'answers zero for a port that cannot be one' {
        Resolve-PeerProcessId -Port 0 -Call { param($p) throw 'never called' } | Should -Be 0
    }

    It 'answers zero on Windows without running anything' -Skip:(-not $IsWindows) {
        # No ss there, and the Windows backend matches tabs on title rather than
        # on a pid, so there is nothing to feed.
        Resolve-PeerProcessId -Port 34234 -Call { param($p) throw 'never called' } | Should -Be 0
    }
}
