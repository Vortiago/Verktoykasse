# The tab title the reporting side writes onto its own ssh session, so a click on
# the rain can find that tab again. Needs ConvertTo-WireText from wire.ps1 and
# $script:ESC from console.ps1.
#
# Windows Terminal hosts every window in one process and hands UI Automation
# nothing but a tab's name: no pid, and no text buffer for any tab but the one in
# front. The title is the only per-tab signal there, and matching on it only
# works while something writes one.
#
# ssh does not. The REMOTE shell does, and only some of them: Debian and Ubuntu
# from the stock ~/.bashrc, macOS not at all, because /etc/zshrc gates its title
# hook on TERM_PROGRAM being Apple_Terminal and sshd sets no such thing. tmux
# does not forward one either with set-titles off, which is the default.
#
# So this machine writes its own. A lane for this machine exists only because
# -ExposeOnSSH is running here, inside the very ssh session the rain wants to
# raise, which makes this the one process that can always name that tab.

function Get-TabTitleSequence {
    <#
    .SYNOPSIS
        The escape sequence that titles a tab user@machine.
    .DESCRIPTION
        OSC 0 sets the icon name and the window title at once, and a terminal
        that shows only one of them shows this. BEL ends it rather than ST:
        every terminal takes BEL, and older ones take nothing else.

        The @ form is the point. Get-MachineTitleScore scores user@machine 2 and
        a bare mention of the machine 1, so a tab titled this way outranks a tab
        that merely has the name in it.
    .PARAMETER User
        Empty becomes 'matrix', which keeps the @ form on a machine that exports
        no user name at all, and says what put the title there. An @ of its own
        is replaced, so the one this builds is the only one in the title.
    #>
    param([Parameter(Mandatory)] [string] $Machine,
          [AllowEmptyString()] [string] $User = '')

    # ConvertTo-WireText, like every other string that reaches a screen. It is
    # here for one character in particular: an ESC inside a user name would end
    # this sequence and leave the rest of the name to be read as commands. The
    # caps are the ones a tab has room for, not the wire's.
    #
    # The @ goes for the reader on the other side. Get-MachineTitleScore cuts a
    # word at its FIRST @ and reads the machine off what follows, so a login
    # that carries one of its own (a@b) would offer it 'b@lab1' and score 0.
    $name = ((ConvertTo-WireText $User 32) -replace '@', '-').Trim()
    if (-not $name) { $name = 'matrix' }

    "$script:ESC]0;$name@$((ConvertTo-WireText $Machine 64).Trim())$([char]7)"
}

function Get-TmuxClientTty {
    <#
    .SYNOPSIS
        The tty of the tmux client attached to this server, or ''.
    .DESCRIPTION
        Under tmux a title written to stdout goes no further than the pane: tmux
        takes it as the pane title, and forwards nothing to the terminal unless
        set-titles is on, which it is not by default. Rather than turn on an
        option in the user's configuration, this end writes one layer down, to
        the pty sshd allocated for the login the tmux client is attached to.

        Asked fresh every time. $SSH_TTY would be cheaper and is wrong: tmux
        outlives the login that started it, so a re-attached session leaves that
        variable naming a pty that is gone, or one another login now holds.
    .PARAMETER Call
        Test seam: tmux args -> its output. Defaults to Invoke-Tmux, which only
        exists where tmux.ps1 is the backend. $null everywhere else, and that is
        an answer, not a fault: the caller writes to stdout instead.
    #>
    param([scriptblock] $Call = ${function:Invoke-Tmux})
    if (-not $Call) { return '' }

    $tty = ''
    try { $tty = ([string](& $Call -TmuxArgs @('display-message', '-p', '#{client_tty}'))).Trim() }
    catch { return '' }

    # Whatever this names is opened for writing. tmux is our own process, but the
    # cost of a wrong answer is a file overwritten with an escape sequence, so
    # only a device path is taken. A detached server answers with nothing, and
    # that lands here too.
    if ($tty -notmatch '^/dev/[A-Za-z0-9/]+$') { return '' }
    $tty
}

function Write-TtyText {
    <#
    .SYNOPSIS
        Put text on a terminal device, or give up on it.
    .DESCRIPTION
        Opened, never created and never truncated: the device is already there,
        and a path that is not is a bug this must not paper over. Not appended
        to either, because append asks for a seek a character device cannot do.
        Shared for read and write, because the tmux client attached to this tty
        is holding it.

        A buffer of 1 is FileStream's way of saying no buffer, so the bytes go
        to the device on the write rather than on a flush this may never reach.
    .PARAMETER TimeoutMs
        The bound. A pty blocks a writer once its output queue fills, and that
        queue fills exactly when the far end of the ssh link has stopped
        reading. This runs on the poll path of a frame loop, so a title that
        cannot be delivered is dropped rather than waited on.
    #>
    param([Parameter(Mandatory)] [string] $Path, [Parameter(Mandatory)] [string] $Text,
          [int] $TimeoutMs = 200)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $fs = [System.IO.FileStream]::new($Path, [System.IO.FileMode]::Open,
                                      [System.IO.FileAccess]::Write,
                                      [System.IO.FileShare]::ReadWrite, 1, $false)
    $done = $false
    try {
        $done = $fs.WriteAsync($bytes, 0, $bytes.Length).Wait($TimeoutMs)
    } catch {
        # A write that failed is a write nothing is waiting on any more, so the
        # handle goes back at once and the caller still hears about it. The tty
        # that went away between the lookup and the open lands here, and it is
        # the common failure: leaving the stream would leak one per redial.
        $fs.Dispose()
        throw
    } finally {
        # Dispose waits for a write that has not landed, which is the wait the
        # bound above exists to avoid. A stream left behind is closed when the
        # process exits, and only a stalled link can leave one.
        if ($done) { $fs.Dispose() }
    }
}

function Write-TmuxClientTitle {
    <#
    .SYNOPSIS
        Write a sequence to the tmux client's tty. True when it went out.
    .DESCRIPTION
        The two halves of the tmux route in one name, so the caller holds one
        seam rather than two and never has to know that finding the tty and
        writing to it are separate steps. False means no client is attached.
    #>
    param([Parameter(Mandatory)] [string] $Text,
          [scriptblock] $Tty = { Get-TmuxClientTty },
          [scriptblock] $Write = ${function:Write-TtyText})
    $path = [string](& $Tty)
    if (-not $path) { return $false }
    & $Write $path $Text
    $true
}

function Set-RemoteTabTitle {
    <#
    .SYNOPSIS
        Title the tab holding this machine's ssh session. True when it wrote.
    .DESCRIPTION
        Two destinations, and the pane decides which. Inside tmux the sequence
        goes to the attached client's tty, under tmux and out through ssh.
        Outside tmux stdout already is that stream. Where neither answers,
        nothing is written and the rain falls back to the guess it makes today.

        Never throws. It is called from the poll path of a frame loop.
    .PARAMETER Tmux
        $TMUX, which tmux sets in every pane. A parameter so the choice can be
        tested from either side without a server.
    .PARAMETER Write
        text -> stdout. matrix.ps1 owns the console handle, so the writer is
        injected rather than reached for here.
    #>
    param([Parameter(Mandatory)] [string] $Machine,
          [AllowEmptyString()] [string] $User = $(if ($env:USER) { $env:USER } else { $env:USERNAME }),
          [AllowEmptyString()] [string] $Tmux = $env:TMUX,
          [scriptblock] $WriteTmux = ${function:Write-TmuxClientTitle},
          [scriptblock] $Write = $null)

    $seq = Get-TabTitleSequence -Machine $Machine -User $User

    if ($Tmux) {
        # A tmux server with no client attached falls through to stdout. That
        # reaches the pane and no further, which titles the wrong thing but
        # costs one write and never misleads: the rain only ever reads a title
        # it finds on a local tab.
        try { if (& $WriteTmux $seq) { return $true } } catch { return $false }
    }

    if (-not $Write) { return $false }
    try { $null = & $Write $seq } catch { return $false }
    $true
}
