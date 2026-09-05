# The wire format a remote machine speaks. Every function here is pure, so a
# peer, a socket and a second machine are all out of the picture: a string goes
# in and a session or a verdict comes out. All three CI runners run all of it.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/proc.ps1')
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/sessions.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/wire.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    # Defined in BeforeAll, like every helper in the other suites: file-level
    # functions are not visible inside It blocks under Pester 5.
    function New-TestPeer ([string] $Machine = 'lab1') { @{ Machine = $Machine } }

    function New-TestRecord ([hashtable] $Override = @{}) {
        $r = @{ id = 'a1b2'; status = 'busy'; waitingFor = ''; title = 'api'
                task = 'add the retry path'; startedAt = 1000; updatedAt = 2000 }
        foreach ($k in $Override.Keys) { $r[$k] = $Override[$k] }
        [pscustomobject]$r
    }

    function ConvertTo-TestSession ([hashtable] $Override = @{}, [long] $Skew = 0) {
        ConvertTo-RemoteSession -Record (New-TestRecord $Override) -Peer (New-TestPeer) -SkewMs $Skew
    }

}

Describe 'wire: Split-NdjsonBuffer' {
    It 'takes a whole line and keeps nothing back' {
        $r = Split-NdjsonBuffer -Buffer '' -Text "{`"a`":1}`n"
        $r.Line.Count | Should -Be 1
        $r.Line[0] | Should -Be '{"a":1}'
        $r.Rest | Should -Be ''
        $r.Overflow | Should -BeFalse
    }

    It 'holds a partial line back for the next read' {
        $r = Split-NdjsonBuffer -Buffer '' -Text '{"a":'
        $r.Line.Count | Should -Be 0
        $r.Rest | Should -Be '{"a":'
    }

    It 'joins a line split across two reads' {
        # The case a stream guarantees and a message queue does not.
        $first  = Split-NdjsonBuffer -Buffer '' -Text '{"a":'
        $second = Split-NdjsonBuffer -Buffer $first.Rest -Text "1}`n"
        $second.Line.Count | Should -Be 1
        $second.Line[0] | Should -Be '{"a":1}'
    }

    It 'takes two lines out of one read' {
        $r = Split-NdjsonBuffer -Buffer '' -Text "one`ntwo`n"
        $r.Line | Should -Be @('one', 'two')
        $r.Rest | Should -Be ''
    }

    It 'strips the carriage return a peer on Windows writes' {
        $r = Split-NdjsonBuffer -Buffer '' -Text "one`r`n"
        $r.Line[0] | Should -Be 'one'
    }

    It 'drops an oversize line whole, and says so' {
        # Not just the excess: the tail of an oversize line does not parse on its
        # own, and keeping it would resync inside a value.
        $r = Split-NdjsonBuffer -Buffer '' -Text ('x' * 40) -MaxLine 16
        $r.Overflow | Should -BeTrue
        $r.Rest | Should -Be ''
        $r.Line.Count | Should -Be 0
    }

    It 'does not call a long buffer oversize once it holds a newline' {
        $r = Split-NdjsonBuffer -Buffer '' -Text ("one`n" + ('x' * 40)) -MaxLine 16
        $r.Overflow | Should -BeFalse
        $r.Line[0] | Should -Be 'one'
    }
}

Describe 'wire: ConvertFrom-WireLine' {
    It 'reads a line of this version' {
        (ConvertFrom-WireLine '{"v":1,"t":"hello"}').t | Should -Be 'hello'
    }

    It 'drops a line of another version' {
        # A silent mismatch shows as lanes that never appear, so the drop is here
        # and the reason is reported once, by the caller, off the hello.
        ConvertFrom-WireLine '{"v":2,"t":"hello"}' | Should -BeNullOrEmpty
    }

    It 'drops a malformed line instead of throwing' {
        # This runs on the poll path against text another machine wrote. A bad
        # line must cost one line, not the rain.
        ConvertFrom-WireLine '{"v":1,' | Should -BeNullOrEmpty
        ConvertFrom-WireLine 'not json at all' | Should -BeNullOrEmpty
        ConvertFrom-WireLine '' | Should -BeNullOrEmpty
    }

    It 'drops a line whose version is not a number' {
        # These parse, so they get past the catch and reach the version test. A
        # hard cast there throws on the poll path and stops the rain.
        ConvertFrom-WireLine '{"v":"x","t":"hello"}' | Should -BeNullOrEmpty
        ConvertFrom-WireLine '{"v":[1,2],"t":"hello"}' | Should -BeNullOrEmpty
        ConvertFrom-WireLine '{"t":"hello"}' | Should -BeNullOrEmpty
    }

    It 'drops a bare JSON value that is not an object' {
        ConvertFrom-WireLine '[1,2,3]' | Should -BeNullOrEmpty
        ConvertFrom-WireLine '42' | Should -BeNullOrEmpty
    }
}

Describe 'wire: Test-RemoteHello' {
    It 'takes a hello that names a machine' {
        Test-RemoteHello (ConvertFrom-WireLine (ConvertTo-HelloLine -Machine 'lab1' -Now 1)) | Should -Be ''
    }

    It 'refuses a first line that is not a hello' {
        $frame = ConvertFrom-WireLine (ConvertTo-FrameLine -Session @() -Now 1)
        Test-RemoteHello $frame | Should -Match 'not a hello'
    }

    It 'refuses a hello with no machine name' {
        Test-RemoteHello (ConvertFrom-WireLine '{"v":1,"t":"hello","machine":""}') | Should -Match 'no machine name'
    }

    It 'refuses a wrong token by name' {
        $hello = ConvertFrom-WireLine (ConvertTo-HelloLine -Machine 'lab1' -Token 'right' -Now 1)
        Test-RemoteHello $hello -Token 'wrong' | Should -Be 'wrong token'
    }

    It 'takes any peer when no token is configured' {
        # The first-run case. The host says so once at startup rather than
        # refusing every connection with no explanation.
        $hello = ConvertFrom-WireLine (ConvertTo-HelloLine -Machine 'lab1' -Token 'anything' -Now 1)
        Test-RemoteHello $hello -Token '' | Should -Be ''
    }

    It 'refuses nothing at all' {
        Test-RemoteHello $null | Should -Not -Be ''
    }
}

Describe 'wire: ConvertTo-RemoteSession' {
    It 'leads the name with the machine, so a narrow lane keeps it' {
        (ConvertTo-TestSession).Name | Should -Be 'lab1: api'
    }

    It 'marks the name as user-set, so Get-SessionTitle returns it unchanged' {
        # This pins the claim that sessions.ps1 needs no change: a nameSource of
        # derived or collision would send Get-SessionTitle looking for a cwd and
        # a branch that live on another machine.
        $s = ConvertTo-TestSession
        $s.NameSource | Should -Be 'user'
        Get-SessionTitle $s | Should -Be 'lab1: api'
    }

    It 'namespaces the session id by machine' {
        # Two machines must not collide in the tab map or in the lane list.
        (ConvertTo-TestSession).SessionId | Should -Be 'lab1/a1b2'
        (ConvertTo-RemoteSession -Record (New-TestRecord) -Peer (New-TestPeer 'lab2')).SessionId |
            Should -Be 'lab2/a1b2'
    }

    It 'leaves the pid at zero' {
        # What stops a remote lane matching a local tab. See the merge in matrix.ps1.
        (ConvertTo-TestSession).Pid | Should -Be 0
    }

    It 'takes the style from this machine, not from the peer' {
        # styles.psd1 stays the one place colours are tuned, and an old remote
        # cannot recolour the rain.
        (ConvertTo-TestSession).Style.Label | Should -Be (Get-SessionStyle 'busy').Label
    }

    It 'degrades a status it does not know to idle' {
        (ConvertTo-TestSession @{ status = 'on fire' }).Status | Should -Be 'idle'
    }

    It 'drops a record with no id' {
        # An unidentified lane cannot be updated on the next frame and cannot
        # route a click.
        ConvertTo-TestSession @{ id = '' } | Should -BeNullOrEmpty
    }

    It 'falls back to the id when the peer sent no title' {
        (ConvertTo-TestSession @{ title = '' }).Name | Should -Be 'lab1: a1b2'
    }

    It 'keeps the remote id, which is what the focus line names' {
        # The peer knows nothing about the machine prefix this host added.
        (ConvertTo-TestSession).RemoteId | Should -Be 'a1b2'
    }
}

Describe 'wire: strings from a peer are not trusted' {
    It 'blanks an escape sequence in a task' {
        # The single most important line in the feature. A peer on a loopback
        # port that can write raw CSI into the alternate screen owns the screen.
        $s = ConvertTo-TestSession @{ task = "a$([char]0x1b)[2Jb" }
        $s.Task | Should -Be 'a [2Jb'
    }

    It 'blanks an eight-bit CSI in a title' {
        # U+009B is a one-character CSI. A filter that only looks for ESC misses it.
        $s = ConvertTo-TestSession @{ title = "x$([char]0x9b)y" }
        $s.Name | Should -Be 'lab1: x y'
    }

    It 'blanks a control character in waitingFor' {
        (ConvertTo-TestSession @{ waitingFor = "in`tput" }).WaitingFor | Should -Be 'in put'
    }

    It 'keeps the middle dot a title carries' {
        (ConvertTo-TestSession @{ title = "api $([char]0xb7) main" }).Name | Should -Be "lab1: api $([char]0xb7) main"
    }

    It 'caps a task, so one peer cannot hand the wrapper a novel' {
        (ConvertTo-TestSession @{ task = 'x' * 9000 }).Task.Length | Should -Be 2048
    }

    It 'caps a title' {
        (ConvertTo-TestSession @{ title = 'x' * 9000 }).Name.Length | Should -Be ('lab1: '.Length + 256)
    }
}

Describe 'wire: clocks' {
    It 'rebases a timestamp onto the host clock' {
        # The peer sends its own epoch milliseconds and Format-Age subtracts from
        # this machine's UtcNow. A machine two minutes behind would otherwise show
        # a two minute age on a session that changed a moment ago.
        $s = ConvertTo-TestSession @{ updatedAt = 2000 } 5000
        $s.UpdatedAt | Should -Be 7000
    }

    It 'rebases the start time too' {
        (ConvertTo-TestSession @{ startedAt = 1000 } 5000).StartedAt | Should -Be 6000
    }

    It 'leaves an unreadable timestamp at zero, which Format-Age prints as no age' {
        (ConvertTo-TestSession @{ updatedAt = 'soon' } 5000).UpdatedAt | Should -Be 0
        (ConvertTo-TestSession @{ updatedAt = 0 } 5000).UpdatedAt | Should -Be 0
    }
}

Describe 'wire: ConvertFrom-RemoteFrame' {
    It 'takes every record of a frame' {
        $line = ConvertTo-FrameLine -Now 9 -Session @(
            (New-WireSession 'one' 'api' 'busy'), (New-WireSession 'two' 'web' 'idle'))
        $out = @(ConvertFrom-RemoteFrame -Frame (ConvertFrom-WireLine $line) -Peer (New-TestPeer))
        $out.Count | Should -Be 2
        $out[0].SessionId | Should -Be 'lab1/one'
    }

    It 'takes an empty session list without complaint' {
        $line = ConvertTo-FrameLine -Session @() -Now 9
        @(ConvertFrom-RemoteFrame -Frame (ConvertFrom-WireLine $line) -Peer (New-TestPeer)).Count |
            Should -Be 0
    }

    It 'keeps a single session an array, not a lone object' {
        # ConvertTo-Json flattens a one-element array unless it is told not to.
        $line = ConvertTo-FrameLine -Session @((New-WireSession 'only')) -Now 9
        @(ConvertFrom-RemoteFrame -Frame (ConvertFrom-WireLine $line) -Peer (New-TestPeer)).Count |
            Should -Be 1
    }

    It 'caps how many records one frame can add' {
        $many = 1..80 | ForEach-Object { [pscustomobject]@{ id = "s$_"; status = 'idle' } }
        $frame = [pscustomobject]@{ sessions = $many }
        @(ConvertFrom-RemoteFrame -Frame $frame -Peer (New-TestPeer)).Count | Should -Be 32
    }

    It 'skips a record with no id and keeps the rest' {
        $frame = [pscustomobject]@{ sessions = @(
            [pscustomobject]@{ id = ''; status = 'idle' },
            [pscustomobject]@{ id = 'good'; status = 'idle' }) }
        $out = @(ConvertFrom-RemoteFrame -Frame $frame -Peer (New-TestPeer))
        $out.Count | Should -Be 1
        $out[0].RemoteId | Should -Be 'good'
    }
}

Describe 'wire: round trip' {
    It 'carries a title with a unicode name through JSON unchanged' {
        $s = New-WireSession 'u1' ('gr' + [char]0xF8 + 'nn')   # a name with a Latin-1 letter
        $line = ConvertTo-FrameLine -Session @($s) -Now 9
        $out = @(ConvertFrom-RemoteFrame -Frame (ConvertFrom-WireLine $line) -Peer (New-TestPeer))
        $out[0].Name | Should -Be ('lab1: gr' + [char]0xF8 + 'nn')
    }

    It 'carries a task holding the characters the old frame format reserved' {
        # Tab, pipe and the unit and record separators are user text now, not
        # delimiters. JSON escapes them and nothing has to be stripped.
        $s = New-WireSession 'u2' 'api' 'busy' "a|b`tc$([char]0x1f)d"
        $line = ConvertTo-FrameLine -Session @($s) -Now 9
        $out = @(ConvertFrom-RemoteFrame -Frame (ConvertFrom-WireLine $line) -Peer (New-TestPeer))
        $out[0].Task | Should -Be 'a|b c d'     # the control characters blank, the pipe stays
    }

    It 'writes one line, with no newline of its own' {
        # The caller adds the separator. A frame that carried its own would give
        # the reader an empty line to parse on every poll.
        $line = ConvertTo-FrameLine -Session @((New-WireSession 'u4')) -Now 9
        $line | Should -Not -Match "`n"
    }
}

Describe 'wire: the focus line' {
    It 'names the remote id, not the namespaced one' {
        # The peer knows nothing about the machine prefix this host added.
        $s = ConvertTo-TestSession
        $o = ConvertFrom-WireLine (ConvertTo-FocusLine $s)
        $o.t | Should -Be 'focus'
        $o.id | Should -Be 'a1b2'
    }

    It 'carries no window id' {
        # The reporting machine looks the session up in the tab map it already
        # keeps, and a window id would never leave the machine that produced it.
        (ConvertTo-FocusLine (ConvertTo-TestSession)) | Should -Not -Match 'window'
    }
}
