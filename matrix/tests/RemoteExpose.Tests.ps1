# The reporting side, entirely through the four seams Update-Expose takes. A
# refused port, a broken pipe and a reconnect are exact here rather than timed
# against a real socket, and both runners run all of it.
#
# -ExposeOnSSH is wired up end to end in Rain.Tests.ps1, where the harness that
# starts the script as a child already lives.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/sessions.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/wire.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/tcp.ps1')
    . (Join-Path $PSScriptRoot '../lib/remote/expose.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    # A rain at the other end that is not really there. Refused counts how often
    # it was dialled, Lines holds everything written to it.
    function New-FakeRain {
        $r = @{ Listening = $true; Dials = 0
                Lines = [System.Collections.Generic.List[string]]::new()
                Incoming = ''; Shut = $false; Closes = 0
                FailWrite = $false }
        $r.Connect = {
            $r.Dials++
            if (-not $r.Listening) { return $null }
            [pscustomobject]@{ Name = 'conn' }
        }.GetNewClosure()
        $r.Read = {
            param($c)
            if ($r.Shut) { return $null }
            $t = $r.Incoming; $r.Incoming = ''; $t
        }.GetNewClosure()
        $r.Write = {
            param($c, $line)
            if ($r.FailWrite) { throw 'broken pipe' }
            $r.Lines.Add($line)
        }.GetNewClosure()
        $r.Close = { param($c) $r.Closes++ }.GetNewClosure()
        $r
    }

    function Step-Expose ($State, $Rain, [long] $Now, [object[]] $Session = @(),
                          [scriptblock] $Focus = $null, [scriptblock] $Title = $null) {
        Update-Expose -State $State -Now $Now -Session $Session `
                      -Connect $Rain.Connect -Read $Rain.Read -Write $Rain.Write `
                      -Close $Rain.Close -Focus $Focus -Title $Title
    }

}

Describe 'expose: naming this machine' {
    It 'cuts the host name at the first dot' {
        # A lane header has no room for a fully qualified name, and the user knows
        # the machine by what they type after ssh.
        Get-ExposeMachineName 'lab1.internal.example' | Should -Be 'lab1'
    }

    It 'takes a name the user gave, filtered like any other drawn string' {
        Get-ExposeMachineName "lab$([char]0x1b)1" | Should -Be 'lab 1'
    }

    It 'answers something for a machine with no name at all' {
        Get-ExposeMachineName | Should -Not -BeNullOrEmpty
    }
}

Describe 'expose: connecting' {
    It 'sends the hello on the same poll as the connect' {
        # A connection that has not said which machine it is shows the rain a peer
        # and no lanes.
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Lines.Count | Should -Be 2
        (ConvertFrom-WireLine $r.Lines[0]).t | Should -Be 'hello'
        (ConvertFrom-WireLine $r.Lines[0]).machine | Should -Be 'lab1'
        (ConvertFrom-WireLine $r.Lines[1]).t | Should -Be 'frame'
    }

    It 'carries the token in the hello' {
        $s = New-ExposeState -Machine 'lab1' -Token 'shared'; $r = New-FakeRain
        Step-Expose $s $r 0
        (ConvertFrom-WireLine $r.Lines[0]).token | Should -Be 'shared'
    }

    It 'waits out the retry before dialling again' {
        # Refused is the normal case: the rain is not up yet. Dialling every frame
        # would be sixty connects a second against a port nobody is listening on.
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        $r.Listening = $false
        Step-Expose $s $r 0
        Step-Expose $s $r 100
        Step-Expose $s $r 500
        $r.Dials | Should -Be 1
        Step-Expose $s $r 1000
        $r.Dials | Should -Be 2
    }

    It 'connects once the rain appears, without being restarted' {
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        $r.Listening = $false
        Step-Expose $s $r 0
        $r.Listening = $true
        Step-Expose $s $r 1000
        $s.Conn | Should -Not -BeNullOrEmpty
        (ConvertFrom-WireLine $r.Lines[0]).t | Should -Be 'hello'
    }
}

Describe 'expose: reporting' {
    It 'sends one frame per poll, numbered' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0 @((New-WireSession 'a1'))
        Step-Expose $s $r 1000 @((New-WireSession 'a1'))
        $frames = @($r.Lines | ForEach-Object { ConvertFrom-WireLine $_ } |
                    Where-Object { $_.t -eq 'frame' })
        $frames.Count | Should -Be 2
        $frames[0].seq | Should -Be 1
        $frames[1].seq | Should -Be 2
    }

    It 'sends the sessions it was handed' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0 @((New-WireSession 'a1' 'api' 'busy'))
        $frame = ConvertFrom-WireLine ($r.Lines | Select-Object -Last 1)
        @($frame.sessions).Count | Should -Be 1
        @($frame.sessions)[0].id | Should -Be 'a1'
        @($frame.sessions)[0].title | Should -Be 'api'
    }

    It 'sends an empty frame when nothing is running here' {
        # Not silence: the rain has to tell "this machine has no sessions" from
        # "this machine has gone", and only a frame does that.
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0 @()
        $frame = ConvertFrom-WireLine ($r.Lines | Select-Object -Last 1)
        @($frame.sessions).Count | Should -Be 0
    }

    It 'names each session by the id a focus line comes back with' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0 @((New-WireSession 'a1'))
        $frame = ConvertFrom-WireLine ($r.Lines | Select-Object -Last 1)
        @($frame.sessions)[0].id | Should -Be 'a1'
    }
}

Describe 'expose: the focus command' {
    It 'hands the session id on to be switched to' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        $script:seen = $null
        $focus = { param($id) $script:seen = $id }
        Step-Expose $s $r 0 @((New-WireSession 'a1')) $focus
        $r.Incoming = '{"v":1,"t":"focus","id":"a1"}' + "`n"
        Step-Expose $s $r 1000 @((New-WireSession 'a1')) $focus
        $script:seen | Should -Be 'a1'
    }

    It 'ignores a line that is not a focus' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        $script:seen = 'untouched'
        $focus = { param($id) $script:seen = $id }
        Step-Expose $s $r 0 @() $focus
        $r.Incoming = "{`"v`":1,`"t`":`"hello`"}`ngarbage`n"
        Step-Expose $s $r 1000 @() $focus
        $script:seen | Should -Be 'untouched'
    }

    It 'survives a switch that fails' {
        # The id may name a session that has just gone, and the lookup on the
        # other side answers nothing. That must not reach the caller's loop.
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        $focus = { param($id) throw 'no such session' }
        Step-Expose $s $r 0 @((New-WireSession 'a1')) $focus
        $r.Incoming = '{"v":1,"t":"focus","id":"a1"}' + "`n"
        { Step-Expose $s $r 1000 @((New-WireSession 'a1')) $focus } | Should -Not -Throw
    }
}

Describe 'expose: losing the rain' {
    It 'hangs up when the far end closes, and waits out the retry' {
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Shut = $true
        Step-Expose $s $r 100
        $s.Conn | Should -BeNullOrEmpty
        $r.Closes | Should -Be 1
        # The retry was armed by the connect at 0, so 500 is still inside it.
        Step-Expose $s $r 500
        $r.Dials | Should -Be 1
    }

    It 'hangs up on a broken pipe rather than throwing at the frame loop' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.FailWrite = $true
        { Step-Expose $s $r 1000 } | Should -Not -Throw
        $s.Conn | Should -BeNullOrEmpty
    }

    It 'reconnects after the rain comes back' {
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Shut = $true
        Step-Expose $s $r 100
        $r.Shut = $false
        Step-Expose $s $r 1100
        $s.Conn | Should -Not -BeNullOrEmpty
        @($r.Lines | ForEach-Object { ConvertFrom-WireLine $_ } |
          Where-Object { $_.t -eq 'hello' }).Count | Should -Be 2
    }
}

Describe 'expose: what the -Stats line reads' {
    # A connect proves nothing: sshd accepts with or without a rain behind it.
    # Only the rain's answer does.
    It 'reads as waiting while nothing takes the connection' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        $r.Listening = $false
        Step-Expose $s $r 0
        Get-ExposeStatus $s | Should -Be 'host waiting'
    }

    It 'reads as connecting once dialled, until the host answers' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        Get-ExposeStatus $s | Should -Be 'host connecting'
    }

    It 'holds at connecting when the host takes the connection and drops it at once' {
        # A host running no rain: sshd accepts, the far end closes within
        # milliseconds, this side redials. The status must not flap in step.
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        $r.Shut = $true
        foreach ($t in 0, 1000, 2000, 3000) {
            Step-Expose $s $r $t
            Get-ExposeStatus $s | Should -Be 'host connecting'
        }
        $r.Dials | Should -BeGreaterThan 1      # it really did redial in there
    }

    It 'reads as connected once the welcome arrives' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        Step-Expose $s $r 100
        Get-ExposeStatus $s | Should -Be 'host connected'
    }

    It 'carries the reason the host refused it' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-RefusedLine -Why 'wrong token') + "`n"
        Step-Expose $s $r 100
        Get-ExposeStatus $s | Should -Be 'host refused: wrong token'
    }

    It 'keeps the refusal through the redials that follow' {
        # The rain hangs up after refusing and this side redials: "connecting"
        # between two refusals would hide the word that names the fix.
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000 -RefusedMs 5000; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-RefusedLine -Why 'wrong token') + "`n"
        Step-Expose $s $r 100
        $r.Shut = $true
        Step-Expose $s $r 200
        $r.Shut = $false
        Step-Expose $s $r 1000
        $s.Conn | Should -Not -BeNullOrEmpty
        Get-ExposeStatus $s | Should -Be 'host refused: wrong token'
    }

    It 'lets a welcome clear the refusal' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-RefusedLine -Why 'wrong token') + "`n"
        Step-Expose $s $r 100
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        Step-Expose $s $r 200
        Get-ExposeStatus $s | Should -Be 'host connected'
    }

    It 'drops the refusal once the rain stops saying it' {
        # The rain was stopped, not fixed. sshd keeps taking the connection, so
        # nothing closes and nothing answers: the truth is connecting.
        $s = New-ExposeState -Machine 'lab1' -RefusedMs 5000; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-RefusedLine -Why 'wrong token') + "`n"
        Step-Expose $s $r 100
        Step-Expose $s $r 5000
        Get-ExposeStatus $s | Should -Be 'host refused: wrong token'
        Step-Expose $s $r 5200
        Get-ExposeStatus $s | Should -Be 'host connecting'
    }

    It 'keeps the refusal when the polls themselves are slow' {
        # A redial only ever happens on a poll, so the refusal is counted in
        # retries rather than seconds. Fixed at five seconds it would expire on
        # the poll that redials a rain polled every ten, and the reason would be
        # gone from the screen on every other one.
        $s = New-ExposeState -Machine 'lab1' -RetryMs 10000; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-RefusedLine -Why 'wrong token') + "`n"
        Step-Expose $s $r 10000
        $r.Shut = $true
        Step-Expose $s $r 20000
        $r.Shut = $false
        Step-Expose $s $r 30000
        Get-ExposeStatus $s | Should -Be 'host refused: wrong token'
    }

    It 'drops the refusal once the port itself stops answering' {
        # No forward any more: what the rain last said is not the news.
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-RefusedLine -Why 'wrong token') + "`n"
        Step-Expose $s $r 100
        $r.Shut = $true; $r.Listening = $false
        Step-Expose $s $r 200
        Step-Expose $s $r 1000
        Get-ExposeStatus $s | Should -Be 'host waiting'
    }

    It 'goes back to connecting when the host goes and the redial is taken' {
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        Step-Expose $s $r 100
        $r.Shut = $true
        Step-Expose $s $r 200
        $r.Shut = $false
        Step-Expose $s $r 1000
        Get-ExposeStatus $s | Should -Be 'host connecting'
    }

    It 'filters the reason like any other drawn string' {
        # The rain is trusted to answer, not to write to this screen.
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = "{`"v`":1,`"t`":`"refused`",`"why`":`"wrong$([char]0x1b)[2J token`"}`n"
        Step-Expose $s $r 100
        Get-ExposeStatus $s | Should -Not -Match "$([char]0x1b)"
        Get-ExposeStatus $s | Should -Match 'wrong'
    }
}

Describe 'expose: what it can do here' {
    It 'says a click cannot switch when there is no tmux' {
        # Not a refusal. Reporting works anywhere, and only the switch needs tmux.
        Test-ExposeSupport -Tmux '' | Should -Match 'cannot switch'
    }

    It 'says nothing when there is' {
        Test-ExposeSupport -Tmux '/tmp/tmux-1000/default,123,0' | Should -Be ''
    }
}

Describe 'expose: titling the tab this session runs in' {
    # The rain on the other machine finds this ssh session by the tab title, and
    # on Windows Terminal it has nothing else to find it by. A welcome is the
    # moment to write one: it is the first proof that a rain is reading, and a
    # SECOND welcome means a second connection, which means the ssh session
    # holding it is a different one.
    BeforeEach {
        $script:titled = 0
        $script:bump = { $script:titled++ }
    }

    It 'titles the tab once, when the welcome arrives' {
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0 -Title $script:bump
        $script:titled | Should -Be 0
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        Step-Expose $s $r 100 -Title $script:bump
        $script:titled | Should -Be 1
        # Not again on the same connection. Under tmux each write costs a fork
        # to find the client tty, and nothing has changed between two polls.
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        Step-Expose $s $r 200 -Title $script:bump
        Step-Expose $s $r 300 -Title $script:bump
        $script:titled | Should -Be 1
    }

    It 'titles again after a redial' {
        # The ssh session went and came back, so the tab did too. tmux keeps the
        # pane across both, and the new login is a new tty and a new tab.
        $s = New-ExposeState -Machine 'lab1' -RetryMs 1000; $r = New-FakeRain
        Step-Expose $s $r 0 -Title $script:bump
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        Step-Expose $s $r 100 -Title $script:bump
        $r.Shut = $true
        Step-Expose $s $r 200 -Title $script:bump
        $r.Shut = $false
        Step-Expose $s $r 1200 -Title $script:bump
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        Step-Expose $s $r 1300 -Title $script:bump
        $script:titled | Should -Be 2
    }

    It 'survives a title write that throws' {
        # Same rule as every other seam here: a frame loop is calling.
        $s = New-ExposeState -Machine 'lab1'; $r = New-FakeRain
        Step-Expose $s $r 0
        $r.Incoming = (ConvertTo-WelcomeLine) + "`n"
        { Step-Expose $s $r 100 -Title { throw 'no tty' } } | Should -Not -Throw
        Get-ExposeStatus $s | Should -Be 'host connected'
    }
}
