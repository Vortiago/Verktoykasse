# The tab title the reporting side writes onto its own ssh session, so a click on
# the rain can find that tab again. Needs ConvertTo-CellText from console.ps1.
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

# Long enough for any real login name, short enough that the machine stays
# readable on a narrow tab. The machine name arrives already cut by
# Get-ExposeMachineName.
$script:TitleMaxUser = 32

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
        no user name at all, and says what put the title there.
    #>
    param([Parameter(Mandatory)] [string] $Machine,
          [AllowEmptyString()] [string] $User = '')

    # The same filter every drawn string takes. It is here for one character in
    # particular: an ESC inside a user name would end this sequence and leave the
    # rest of the name to be read as commands.
    $name = (ConvertTo-CellText $User).Trim()
    if ($name.Length -gt $script:TitleMaxUser) { $name = $name.Substring(0, $script:TitleMaxUser) }
    if (-not $name) { $name = 'matrix' }

    "$([char]0x1b)]0;$name@$((ConvertTo-CellText $Machine).Trim())$([char]0x07)"
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
        Put text on a terminal device.
    .DESCRIPTION
        Opened, never created and never truncated: the device is already there,
        and a path that is not is a bug this must not paper over. Not appended
        to either, because append asks for a seek a character device cannot do.
        Shared for read and write, because the tmux client attached to this tty
        is holding it.
    #>
    param([Parameter(Mandatory)] [string] $Path, [Parameter(Mandatory)] [string] $Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open,
                                 [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
    try {
        $fs.Write($bytes, 0, $bytes.Length)
        $fs.Flush()
    } finally { $fs.Dispose() }
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
          [scriptblock] $Tty = { Get-TmuxClientTty },
          [scriptblock] $WriteTty = ${function:Write-TtyText},
          [scriptblock] $Write = $null)

    $seq = Get-TabTitleSequence -Machine $Machine -User $User

    if ($Tmux) {
        $path = ''
        try { $path = [string](& $Tty) } catch { $path = '' }
        if ($path -and $WriteTty) {
            try { $null = & $WriteTty $path $seq } catch { return $false }
            return $true
        }
        # No client attached. stdout below reaches the pane and no further, which
        # titles the wrong thing but costs one write and never misleads: the rain
        # only ever reads a title it finds on a local tab.
    }

    if (-not $Write) { return $false }
    try { $null = & $Write $seq } catch { return $false }
    $true
}
