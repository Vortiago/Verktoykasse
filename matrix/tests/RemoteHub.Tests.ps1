# The host's view of connected machines, driven entirely through the three seams
# Update-RemoteHub takes. No socket is opened here and no clock is read: the
# fake connections are strings in a queue and the time is a number the test moves.
# That is what lets the stale, drop and reconnect timings be asserted exactly.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/sessions.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/wire.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/hub.ps1')
    # For the click: Resolve-RemoteTab walks with tabmap.ps1, and the tabs it
    # walks over are Fixtures' New-TestTab.
    . (Join-Path $PSScriptRoot '../lib/terminal/tabmap.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    # A fake peer: text is queued into Pending, and Read hands over whatever is
    # there. Closed makes the next read answer $null, which is how a real socket
    # reports a hang-up.
    function New-FakeConn ([string] $Name = 'c1') {
        [pscustomobject]@{ Name = $Name; Pending = ''; Closed = $false
                           Written = [System.Collections.Generic.List[string]]::new()
                           CloseCount = 0 }
    }

    # The three seams, over a list of fake connections. Arriving holds the ones
    # Accept has not handed over yet.
    function New-FakeWorld {
        $w = @{ Arriving = [System.Collections.Generic.List[object]]::new()
                Reads = 0 }
        $w.Accept = {
            $out = @($w.Arriving.ToArray()); $w.Arriving.Clear(); $out
        }.GetNewClosure()
        $w.Read = {
            param($c)
            $w.Reads++
            if ($c.Closed) { return $null }
            $t = $c.Pending; $c.Pending = ''; $t
        }.GetNewClosure()
        $w.Close = { param($c) $c.CloseCount++; $c.Closed = $true }.GetNewClosure()
        $w.Write = { param($c, $line) $c.Written.Add($line) }.GetNewClosure()
        $w
    }

    function Step-Hub ($Hub, $World, [long] $Now) {
        Update-RemoteHub -Hub $Hub -Now $Now -Accept $World.Accept -Read $World.Read `
                         -Write $World.Write -Close $World.Close
    }

    # The lines the hub wrote to a peer, decoded, by type.
    function Get-Written ($Conn, [string] $Type) {
        @($Conn.Written | ForEach-Object { ConvertFrom-WireLine $_ } | Where-Object { $_.t -eq $Type })
    }

    function New-HelloText ([string] $Machine = 'lab1', [string] $Token = '', [long] $Now = 1000) {
        (ConvertTo-HelloLine -Machine $Machine -Token $Token -Now $Now) + "`n"
    }

    # A frame carrying one session, written as the peer would write it.
    function New-FrameText ([string] $Id = 'a1', [string] $Status = 'busy', [long] $Now = 1000) {
        $line = ConvertTo-Json -Compress -Depth 4 -InputObject ([ordered]@{
            v = 1; t = 'frame'; seq = 1; now = $Now
            sessions = @([ordered]@{ id = $Id; status = $Status; waitingFor = ''
                                     title = 'api'; task = ''; startedAt = $Now
                                     updatedAt = $Now })
        })
        "$line`n"
    }
}

Describe 'hub: connecting' {
    It 'adds a peer when one arrives' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $w.Arriving.Add((New-FakeConn))
        Step-Hub $hub $w 0
        $hub.Peer.Count | Should -Be 1
    }

    It 'shows nothing until the hello names the machine' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $w.Arriving.Add((New-FakeConn))
        Step-Hub $hub $w 0
        @(Get-RemoteSession -Hub $hub -Now 0).Count | Should -Be 0
    }

    It 'shows lanes after a hello and a frame' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText) + (New-FrameText 'a1')
        Step-Hub $hub $w 0
        $out = @(Get-RemoteSession -Hub $hub -Now 0)
        $out.Count | Should -Be 1
        $out[0].SessionId | Should -Be 'lab1/a1'
        $out[0].Name | Should -Be 'lab1: api'
    }

    It 'drops a frame that arrives before the hello' {
        # Otherwise a peer could name a machine by sending sessions for it.
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = New-FrameText 'a1'
        Step-Hub $hub $w 0
        @(Get-RemoteSession -Hub $hub -Now 0).Count | Should -Be 0
    }

    It 'joins a hello split across two polls' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $whole = New-HelloText
        $c.Pending = $whole.Substring(0, 12)
        Step-Hub $hub $w 0
        $hub.Peer[0].Hello | Should -BeFalse
        $c.Pending = $whole.Substring(12)
        Step-Hub $hub $w 100
        $hub.Peer[0].Hello | Should -BeTrue
    }
}

Describe 'hub: the token' {
    It 'refuses a peer with the wrong token, and says so once' {
        $hub = New-RemoteHub -Token 'right'; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText 'lab1' 'wrong') + (New-FrameText 'a1')
        Step-Hub $hub $w 0
        @(Get-RemoteSession -Hub $hub -Now 0).Count | Should -Be 0
        $hub.Note | Should -Match 'wrong token'
    }

    It 'hangs up on a refused peer rather than reading the rest of its lines' {
        # The downlink is why the token is in from the first version: a focus line
        # tells whoever is listening which window a real session is in. A refused
        # peer keeps no connection to send one down.
        $hub = New-RemoteHub -Token 'right'; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText 'lab1' 'wrong') + (New-FrameText 'a1')
        Step-Hub $hub $w 0
        $hub.Peer.Count | Should -Be 0
        $c.CloseCount | Should -Be 1
        (Get-Written $c 'focus').Count | Should -Be 0
        (Get-Written $c 'welcome').Count | Should -Be 0
    }

    It 'tells a refused peer why before hanging up' {
        # The reporting side is otherwise staring at a connection that opened and
        # closed, which is what a missing rain looks like too. The reason is one of
        # this file's own fixed strings, so nothing a peer sent is echoed back.
        $hub = New-RemoteHub -Token 'right'; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = New-HelloText 'lab1' 'wrong'
        Step-Hub $hub $w 0
        $refused = Get-Written $c 'refused'
        $refused.Count | Should -Be 1
        $refused[0].why | Should -Match 'wrong token'
        $c.CloseCount | Should -Be 1
    }

    It 'takes any peer when no token is configured' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText 'lab1' 'anything') + (New-FrameText 'a1')
        Step-Hub $hub $w 0
        @(Get-RemoteSession -Hub $hub -Now 0).Count | Should -Be 1
    }

    It 'keeps saying it, however many times the peer retries' {
        # One string, not a log: the empty lane shows the latest, and nothing
        # reads an earlier one.
        $hub = New-RemoteHub -Token 'right'; $w = New-FakeWorld
        foreach ($i in 1..3) {
            $c = New-FakeConn "c$i"; $w.Arriving.Add($c)
            $c.Pending = New-HelloText 'lab1' 'wrong'
            Step-Hub $hub $w ($i * 100)
        }
        $hub.Note | Should -Match 'wrong token'
    }
}

Describe 'hub: answering the hello' {
    # sshd accepts the reporting side's connection whether or not a rain is
    # behind it. The welcome is the one thing that tells the two apart, so it is
    # sent as soon as the hello is in, not with the first focus line.
    It 'welcomes a peer whose hello was accepted' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = New-HelloText
        Step-Hub $hub $w 0
        (Get-Written $c 'welcome').Count | Should -Be 1
    }

    It 'welcomes once, however many frames follow' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText) + (New-FrameText 'a1')
        Step-Hub $hub $w 0
        $c.Pending = New-FrameText 'a1'
        Step-Hub $hub $w 1000
        $c.Pending = New-FrameText 'a1'
        Step-Hub $hub $w 2000
        (Get-Written $c 'welcome').Count | Should -Be 1
    }

    It 'says nothing to a peer that has not said hello' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        Step-Hub $hub $w 0
        $c.Written.Count | Should -Be 0
    }

    It 'drops a peer the welcome cannot reach' {
        # The write is the first thing sent down this socket, so a failure here is
        # a connection that was never usable. Waiting 60 s to find that out is the
        # half-open case, and this one is known now.
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = New-HelloText
        $failing = { param($conn, $line) throw 'broken pipe' }
        { Update-RemoteHub -Hub $hub -Now 0 -Accept $w.Accept -Read $w.Read `
                           -Write $failing -Close $w.Close } | Should -Not -Throw
        $hub.Peer.Count | Should -Be 0
        $c.CloseCount | Should -Be 1
    }
}

Describe 'hub: two machines' {
    It 'keeps their sessions apart' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $one = New-FakeConn 'one'; $two = New-FakeConn 'two'
        $w.Arriving.Add($one); $w.Arriving.Add($two)
        $one.Pending = (New-HelloText 'lab1') + (New-FrameText 'same')
        $two.Pending = (New-HelloText 'lab2') + (New-FrameText 'same')
        Step-Hub $hub $w 0
        $ids = @(Get-RemoteSession -Hub $hub -Now 0).SessionId
        $ids | Should -Contain 'lab1/same'
        $ids | Should -Contain 'lab2/same'
    }

    It 'shows one lane when the same machine connects twice' {
        # Two ssh sessions to one machine both reach the same forwarded port. The
        # peer that spoke most recently wins.
        $hub = New-RemoteHub; $w = New-FakeWorld
        $old = New-FakeConn 'old'; $w.Arriving.Add($old)
        $old.Pending = (New-HelloText 'lab1') + (New-FrameText 'a1' 'idle')
        Step-Hub $hub $w 0

        $new = New-FakeConn 'new'; $w.Arriving.Add($new)
        $new.Pending = (New-HelloText 'lab1') + (New-FrameText 'a1' 'busy')
        Step-Hub $hub $w 500

        $out = @(Get-RemoteSession -Hub $hub -Now 500)
        $out.Count | Should -Be 1
        $out[0].Status | Should -Be 'busy'
    }
}

Describe 'hub: going quiet' {
    BeforeEach {
        $script:hub = New-RemoteHub -StaleMs 5000 -DropMs 60000
        $script:w = New-FakeWorld
        $script:c = New-FakeConn
        $w.Arriving.Add($c)
        $c.Pending = (New-HelloText) + (New-FrameText 'a1' 'busy')
        Step-Hub $hub $w 0
    }

    It 'keeps the lane live inside the stale window' {
        Step-Hub $hub $w 4000
        (@(Get-RemoteSession -Hub $hub -Now 4000))[0].Status | Should -Be 'busy'
    }

    It 'turns the lane offline past it, keeping the last data' {
        # Not blanked: a lane that disappears reads as a session that ended.
        Step-Hub $hub $w 6000
        $out = @(Get-RemoteSession -Hub $hub -Now 6000)
        $out.Count | Should -Be 1
        $out[0].Status | Should -Be 'offline'
        $out[0].Name | Should -Be 'lab1: api'
        $out[0].Style.Label | Should -Be 'offline'
    }

    It 'leaves the stored status alone, so the lane comes back the colour it was' {
        Step-Hub $hub $w 6000
        [void](Get-RemoteSession -Hub $hub -Now 6000)
        $c.Pending = New-FrameText 'a1' 'busy'
        Step-Hub $hub $w 6100
        (@(Get-RemoteSession -Hub $hub -Now 6100))[0].Status | Should -Be 'busy'
    }

    It 'does not count a line it could not read as life' {
        # A peer sending nothing but noise has to go stale like a silent one.
        $c.Pending = "garbage`n"
        Step-Hub $hub $w 6000
        (@(Get-RemoteSession -Hub $hub -Now 6000))[0].Status | Should -Be 'offline'
    }

    It 'closes a half-open peer past the drop window' {
        # A closed laptop leaves a socket that never reports itself shut.
        Step-Hub $hub $w 61000
        $hub.Peer.Count | Should -Be 0
        $c.CloseCount | Should -Be 1
    }

    It 'keeps a peer that is merely stale' {
        Step-Hub $hub $w 30000
        $hub.Peer.Count | Should -Be 1
        $c.CloseCount | Should -Be 0
    }
}

Describe 'hub: hanging up' {
    It 'drops a peer whose read says it closed, and closes it once' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText) + (New-FrameText 'a1')
        Step-Hub $hub $w 0
        $c.Closed = $true
        Step-Hub $hub $w 100
        $hub.Peer.Count | Should -Be 0
        $c.CloseCount | Should -Be 1
        @(Get-RemoteSession -Hub $hub -Now 100).Count | Should -Be 0
    }

    It 'survives a read that throws' {
        # A socket can fault mid-poll. That must cost the peer, not the rain.
        $hub = New-RemoteHub
        $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        Step-Hub $hub $w 0
        $throwing = { param($x) throw 'socket fault' }
        { Update-RemoteHub -Hub $hub -Now 100 -Accept $w.Accept -Read $throwing `
                           -Write $w.Write -Close $w.Close } |
            Should -Not -Throw
        $hub.Peer.Count | Should -Be 0
    }

    It 'hangs up on everyone when the rain stops' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $one = New-FakeConn 'one'; $two = New-FakeConn 'two'
        $w.Arriving.Add($one); $w.Arriving.Add($two)
        Step-Hub $hub $w 0
        Stop-RemoteHub -Hub $hub -Close $w.Close
        $hub.Peer.Count | Should -Be 0
        $one.CloseCount | Should -Be 1
        $two.CloseCount | Should -Be 1
    }
}

Describe 'hub: cost per poll' {
    It 'reads each peer once, and does no work with no peers' {
        # This runs inside the frame loop. A read per peer per poll is the budget.
        $hub = New-RemoteHub; $w = New-FakeWorld
        Step-Hub $hub $w 0
        $w.Reads | Should -Be 0

        $w.Arriving.Add((New-FakeConn 'one')); $w.Arriving.Add((New-FakeConn 'two'))
        Step-Hub $hub $w 100
        $w.Reads | Should -Be 2
        Step-Hub $hub $w 200
        $w.Reads | Should -Be 4
    }
}

Describe 'hub: the downlink' {
    It 'writes a focus line to the peer that owns the lane' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $one = New-FakeConn 'one'; $two = New-FakeConn 'two'
        $w.Arriving.Add($one); $w.Arriving.Add($two)
        $one.Pending = (New-HelloText 'lab1') + (New-FrameText 'a1')
        $two.Pending = (New-HelloText 'lab2') + (New-FrameText 'b2')
        Step-Hub $hub $w 0

        $lane = @(Get-RemoteSession -Hub $hub -Now 0) | Where-Object { $_.RemoteHost -eq 'lab2' }
        $peer = Get-RemotePeer -Hub $hub -Session $lane
        Send-RemoteCommand -Peer $peer -Line (ConvertTo-FocusLine $lane) -Write $w.Write | Should -BeTrue

        $focus = Get-Written $two 'focus'
        $focus.Count | Should -Be 1
        $focus[0].id | Should -Be 'b2'
        (Get-Written $one 'focus').Count | Should -Be 0
    }

    It 'reports a write that failed instead of throwing' {
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText) + (New-FrameText 'a1')
        Step-Hub $hub $w 0
        $failing = { param($conn, $line) throw 'broken pipe' }
        Send-RemoteCommand -Peer $hub.Peer[0] -Line 'x' -Write $failing | Should -BeFalse
    }
}

Describe 'hub: the local tab behind a remote lane' {
    # The second half of a click on a remote lane: the ssh session that carries
    # the connection is raised here. The pid route is exact and the title route
    # is a guess, so the exact one goes first.
    BeforeEach {
        $script:peer = New-RemotePeer -Conn ([pscustomobject]@{ PeerPort = 5555 }) -Now 0
        $peer.Hello = $true; $peer.Machine = 'lab1'
        $script:owners = 0
    }

    It 'walks from the ssh client to the pane holding it when a pid names one' {
        $script:pane = [pscustomobject]@{ Hwnd = 1; Index = 0; Pid = 200; Text = 'atle@lab1' }
        $tab = Resolve-RemoteTab -Peer $peer -OwnerOf { param($port) 300 } `
                                 -Ancestors { param($p) @(300, 200, 1) } -ReadTab { @($script:pane) }
        $tab.Pid | Should -Be 200
    }

    It 'asks who owns the port once per peer' {
        # The ssh client's pid does not change for the life of the connection,
        # and ss is an external call.
        $script:pane = [pscustomobject]@{ Hwnd = 1; Index = 0; Pid = 200; Text = '' }
        $owner = { param($port) $script:owners++; 300 }
        $anc = { param($p) @(300, 200, 1) }
        [void](Resolve-RemoteTab -Peer $peer -OwnerOf $owner -Ancestors $anc -ReadTab { @($script:pane) })
        [void](Resolve-RemoteTab -Peer $peer -OwnerOf $owner -Ancestors $anc -ReadTab { @($script:pane) })
        $owners | Should -Be 1
    }

    It 'reads the tabs once, however many routes run' {
        # A tab read is the expensive part of a click. The pid route missing must
        # not make the title route pay for a second one.
        $script:reads = 0
        $reader = { $script:reads++
                    @([pscustomobject]@{ Hwnd = 1; Index = 0; Pid = 99; Text = 'atle@lab1' }) }
        [void](Resolve-RemoteTab -Peer $peer -OwnerOf { param($port) 300 } `
                                 -Ancestors { param($p) @(300, 1) } -ReadTab $reader)
        $reads | Should -Be 1
    }

    It 'falls back to the tab whose title names the machine when no pid does' {
        # Windows Terminal: no ss, and its tabs carry no pid to match, so
        # Resolve-PeerProcessId answers 0 there. ssh titles the tab user@machine.
        # $script:, like every other injected reader in this suite: a seam is run
        # inside the function under test, and a plain local can be shadowed there.
        $script:tabs = @((New-TestTab 1 0 'PowerShell' 'none'), (New-TestTab 1 1 'atle@lab1' 'none'))
        (Resolve-RemoteTab -Peer $peer -OwnerOf { 0 } -ReadTab { $script:tabs }).Text |
            Should -Be 'atle@lab1'
    }

    It 'reads the titles again on the next click, because titles change' {
        # A miss is not latched the way the pid answer is: the shell retitles the
        # tab every prompt, and the next click can find what this one did not.
        $script:tabs = @((New-TestTab 1 0 'PowerShell' 'none'))
        Resolve-RemoteTab -Peer $peer -OwnerOf { 0 } -ReadTab { $script:tabs } | Should -BeNullOrEmpty
        $script:tabs = @((New-TestTab 1 0 'atle@lab1' 'none'))
        (Resolve-RemoteTab -Peer $peer -OwnerOf { 0 } -ReadTab { $script:tabs }).Text | Should -Be 'atle@lab1'
    }

    It 'survives a tab read that throws' {
        { Resolve-RemoteTab -Peer $peer -OwnerOf { 0 } -ReadTab { throw 'no desktop' } } | Should -Not -Throw
    }
}

Describe 'hub: clock skew' {
    It 'rebases a peer that is behind this machine' {
        # The peer's own clock reads 1000 while this one reads 900000. An
        # unadjusted timestamp would show a fifteen minute age on a new session.
        $hub = New-RemoteHub; $w = New-FakeWorld
        $c = New-FakeConn; $w.Arriving.Add($c)
        $c.Pending = (New-HelloText 'lab1' '' 1000) + (New-FrameText 'a1' 'busy' 1000)
        Step-Hub $hub $w 900000
        (@(Get-RemoteSession -Hub $hub -Now 900000))[0].UpdatedAt | Should -Be 900000
    }
}
