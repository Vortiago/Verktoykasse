<#
.SYNOPSIS
    A live Matrix-rain view of every open Claude Code session.

.DESCRIPTION
    Runs in the alternate screen buffer: scrollback survives. Press q to exit.

    The screen splits into one vertical lane per open Claude Code session. Each
    lane is coloured and paced by that session's status. The header names the
    session, its status and its opening prompt.

    Per-status colour, speed and density are in styles.psd1.
    See README.md for how it works.

.PARAMETER ThisWindow
    Show only sessions in the same terminal window as this rain (Windows Terminal,
    Konsole), or the same tmux session (inside tmux).

.PARAMETER Click
    Left-click a lane to switch to that session's terminal tab. On Windows, tabs
    match on title, so the match can be wrong: the lane header names the tab it
    would open, and it needs "Show status in terminal tab" on in Claude Code. On
    Konsole and in tmux the match is exact - the tab is that session's process
    ancestor. Inside tmux a tab is a window: the click is select-window, and a
    pane is never focused.

.PARAMETER PollSeconds
    How often the session registry is re-read. Default 1.

.PARAMETER Fps
    Target frames per second (5-240). Default 30. Smoothness only: the rain falls
    at the same rate at any frame rate.

.PARAMETER Seconds
    Stop automatically after N seconds. 0 (default) = run until a key is pressed.

.PARAMETER Stats
    Put a performance line on the bottom row, split by step so a slow rain says
    which step is slow:

        80x25 28/30fps late 3%  build 5.22 write 0.12 ms poll 12.0 ms  7.1KB 296runs  start 0.4s

    With -ExposeOnSSH, one field of words leads the timings:

        80x25 28/30fps late 3%  host connected  build 5.22 write 0.12 ms ...

    host    where the report stands: waiting (nothing takes the connection, so
            no ssh session carries the forward), connecting (something takes it
            and no rain has answered - a host running no rain holds here),
            connected (the rain answered), or refused: <why>
    build   our own work: simulate the fall, stamp the labels, encode the diff
    write   blocked in the terminal. Build near zero with a large write means the
            terminal cannot drain what it is handed, not that the rain is slow
    poll    the last session read, the registry scan and the tab map with it
    late    frames that missed their deadline, whatever the reason
    runs    colour changes handed to the terminal. A terminal lays text out per
            attribute run, so this predicts its cost better than KB does
    start   startup, up to the first frame. A first run pays a C# compile

    Fields are dropped from the right on a narrow terminal, never half-printed.

.PARAMETER Remote
    Also show the sessions of machines that are reporting to this one. Each
    machine runs the same script with -ExposeOnSSH over an ssh session that
    carries a reverse forward:

        ~/.ssh/config     Host lab1 lab2
                              RemoteForward 127.0.0.1:9999 127.0.0.1:9999

        or per login    ssh -R 127.0.0.1:9999:127.0.0.1:9999 lab1

    One port serves every machine. A remote lane is named "<machine>: <session>".
    It never enters the tab map, because its process is not on this machine.

.PARAMETER ExposeOnSSH
    Report this machine's sessions to the rain on the machine you sit at. The
    rain draws here as well. Add -Stats to see whether the host has answered:
    its line leads with host waiting, connecting, connected or refused.

.PARAMETER RemotePort
    The loopback port both sides use. Default 9999. It must match the one in the
    RemoteForward line.

.PARAMETER RemoteAddress
    Where -ExposeOnSSH dials. Default 127.0.0.1, which is where sshd puts the
    forward. -Remote always listens on loopback and ignores this.

.PARAMETER RemoteToken
    A shared secret both ends must agree on. Read from
    ~/.claude/matrix-remote.token when the file exists. Without one, the rain
    accepts any process that reaches the port, and says so once at startup.

.PARAMETER RemoteName
    The name -ExposeOnSSH reports this machine as. Default: the host name, cut at
    the first dot.

.EXAMPLE
    .\matrix.ps1

.EXAMPLE
    .\matrix.ps1 -ThisWindow -Click    # this window's sessions, click to switch

.EXAMPLE
    .\matrix.ps1 -Remote -Click        # this machine's sessions, and every reporting machine's

.EXAMPLE
    .\matrix.ps1 -ExposeOnSSH          # on the remote machine, in a tmux window

.NOTES
    Press q (or Ctrl+C) to exit. The rain reads every other key and ignores it,
    which leaves the keyboard free for later bindings. Mouse activity and terminal
    shortcuts do not stop it either: clicks, Ctrl+wheel zoom, scrolling, Alt+Enter,
    Alt+q and Ctrl+Shift+C are all ignored.
#>
#requires -Version 7
[CmdletBinding()]
param(
    [switch] $ThisWindow,
    [switch] $Click,
    [ValidateRange(0.2, 30)]  [double] $PollSeconds = 1.0,
    [ValidateRange(5, 240)]   [int]    $Fps         = 30,
    [ValidateRange(0, 86400)] [int]    $Seconds     = 0,
    [switch] $Stats,
    [switch] $Remote,
    [switch] $ExposeOnSSH,
    [ValidateRange(1, 65535)] [int]    $RemotePort  = 9999,
    [string] $RemoteAddress = '127.0.0.1',
    [string] $RemoteToken,
    [string] $RemoteName
)

$ErrorActionPreference = 'Stop'

# Started before anything is loaded or compiled, and read once at the first
# frame: -Stats reports it as "start". A first run pays a C# compile that a
# cached one does not, and that is the difference this number makes visible.
$bootClock = [System.Diagnostics.Stopwatch]::StartNew()

if ($Host.Name -like '*ISE*') {
    throw 'Run this in Windows Terminal, PowerShell or conhost - the ISE has no real console.'
}

# terminal/ splits in two: tabmap.ps1 is the map itself and knows no platform,
# and exactly one backend under it answers the six terminal functions the map
# calls - Windows Terminal over UI Automation, Konsole over D-Bus, or tmux over
# its own client.
$lib  = Join-Path $PSScriptRoot 'lib'
$term = Join-Path $lib 'terminal'
# Decided once, and read again below for the words -ThisWindow says back: a second
# spelling of this condition would drift from the backend that actually answers.
#
# tmux owns every terminal it nests in, so it answers before Konsole: a rain inside
# tmux talks tmux, whether the outer terminal is Konsole, a plain xterm, or another
# tmux - $TMUX names the innermost server. Windows never gets here with TMUX set: a
# WSL tmux pane is a separate environment.
#
# On macOS outside tmux there is no nameable tab, so none.ps1 serves no map.

# Who wants the tab map, spelled once: $hostHwnd and $needTabs both read it and
# must not drift. -ExposeOnSSH is in it because a click on the other machine is
# answered out of this machine's map.
$wantTabs = [bool]($ThisWindow -or $Click -or $ExposeOnSSH)
$backend = if ($IsWindows)    { 'windows-terminal.ps1' }
           elseif ($env:TMUX) { 'tmux.ps1' }
           elseif ($IsMacOS)  { 'none.ps1' }
           else               { 'konsole.ps1' }
$load = @(
    foreach ($part in 'proc', 'console', 'stats', 'types', 'palette', 'lanes', 'sessions') {
        Join-Path $lib "$part.ps1"
    }
    Join-Path $term 'tabmap.ps1'
    Join-Path $term $backend
    if ($Remote -or $ExposeOnSSH) {
        # After sessions.ps1 and the backend: wire.ps1 wants Get-SessionStyle, and
        # the click path walks with Get-ProcessAncestorId.
        foreach ($part in 'wire', 'tcp', 'hub', 'expose') { Join-Path $lib "remote/$part.ps1" }
    }
)
foreach ($file in $load) {
    if (-not (Test-Path -LiteralPath $file)) { throw "matrix: cannot load $file" }
    . $file
}

# --- The machines, when there are any ----------------------------------------------

# One epoch clock for everything remote. The tab map runs on a monotonic
# stopwatch, and the two are never mixed: this one is compared against timestamps
# another machine wrote, which is what forces the choice.
function Get-EpochMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

if ($Remote -or $ExposeOnSSH) {
    # A file, not a parameter, by default: a token on the command line is in the
    # shell history and in every ps listing on the machine.
    if (-not $PSBoundParameters.ContainsKey('RemoteToken')) {
        $RemoteToken = ''
        # sessions.ps1's own home, not a second copy of the rule: a copy would put
        # the token and the session registry in different directories the moment
        # either changed.
        $tokenFile = Join-Path $script:ClaudeHome 'matrix-remote.token'
        if (Test-Path -LiteralPath $tokenFile) {
            try { $RemoteToken = ([System.IO.File]::ReadAllText($tokenFile)).Trim() } catch { }
        }
    }

    $tcpSeam = @{
        Connect = { Connect-RemoteEndpoint -Address $script:RemoteAddress -Port $script:RemotePort }
        Read    = { param($c) Read-RemoteText $c }
        Write   = { param($c, $line) Write-RemoteLine -Conn $c -Line $line }
        Close   = { param($c) Close-RemoteConnection $c }
    }

    if (-not $RemoteToken) {
        Write-Host 'matrix: no token file, so the rain accepts any process that reaches the port.' `
                   -ForegroundColor DarkGray
    }
}

# The tab map, owned here so both loops below share one. Update-SessionTabMap
# keeps it current. Map is sessionId -> tab, and each tab carries its window.
$tabState = New-TabState
$tabClock = [System.Diagnostics.Stopwatch]::StartNew()

# This machine reporting outward. It shares whichever loop runs, so a lane the
# user sees here is the same lane the other machine sees.
$expose = $null
if ($ExposeOnSSH) {
    $why = Test-ExposeSupport
    if ($why) { Write-Host $why -ForegroundColor DarkGray }
    # A dial only happens on a poll, so a shorter retry is one that never fires -
    # and RefusedMs, counted in retries, would expire between two refusals.
    $expose = New-ExposeState -Machine (Get-ExposeMachineName $RemoteName) -Token $RemoteToken `
                              -RetryMs ([int][Math]::Max(1000.0, $PollSeconds * 1000.0))
}

# What -ThisWindow scopes on: a terminal window, or the tmux session a pane runs
# in. Named off $backend, because both the empty-lane header and the -ThisWindow
# failure below say it back to the user, and the words must match the backend
# that actually answers.
$scopeName = if ($backend -eq 'tmux.ps1') { 'tmux session' } else { 'terminal window' }
# Only Windows guesses: it takes the window that was in front at startup. Konsole
# and tmux each export their scope into the environment, so "keep it in front" is
# advice only the Windows backend's user can act on - and it reads as a wrong
# diagnosis anywhere else.
$scopeHint = if ($backend -eq 'windows-terminal.ps1') { " and leave that $scopeName in front" } else { '' }
# What the user can do about it. Every backend but none.ps1 has a scope to start
# from, so naming one is advice. none.ps1 has none, so its only route is the one
# $why already gives.
$scopeFix = if ($backend -eq 'none.ps1') { 'Drop -ThisWindow to show every session.' }
            else { "Start it from the $scopeName you want scoped$scopeHint, " +
                   'or drop -ThisWindow to show every session.' }

# Read before anything slow runs, because the Windows backend has to guess: it
# takes the foreground terminal, which is only reliably ours right after the user
# typed the command. Konsole and tmux both read an exported variable and are exact
# whenever this runs.
$hostHwnd = if ($wantTabs) { Get-OwnTerminalWindow } else { 0 }

# Enable ANSI escape processing (a no-op where it is already on).
try {
    $mode = [uint32]0
    $handle = $VT::GetStdHandle(-11)
    if ($VT::GetConsoleMode($handle, [ref]$mode)) {
        [void]$VT::SetConsoleMode($handle, $mode -bor 0x0004)   # VIRTUAL_TERMINAL_PROCESSING
    }
} catch { }

# --- UTF-8 output: a legacy codepage turns the katakana into "?" -------------------
$prevEncoding = $null
try {
    $prevEncoding = [Console]::OutputEncoding
    if ($prevEncoding.CodePage -ne 65001) {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    }
    $useAscii = $false
} catch {
    $useAscii = $true   # cannot emit katakana: use the ASCII glyph set
}

$glyphs = Get-RainGlyph -Ascii:$useAscii

# -ThisWindow and -Click both need the tab map. Windows Terminal keeps every window
# in one process: a window is identified by its handle, a session by the tab whose
# title matches it. Konsole is the same, one process for every window, but the
# session-to-tab match there is a pid walk, not a title match. tmux scopes on its
# own session and matches on pane_pid, so its tab objects carry that session id.
#
# -ExposeOnSSH needs it too, for a different answer out of the same map: the
# window id each session sits in, which travels in the frame so a click on the
# other machine has somewhere to send.
$needTabs = $wantTabs
if ($needTabs) {
    $why = Test-TabSupport -Hwnd $hostHwnd
    if ($why) {
        # -ThisWindow asked for a smaller set. Quietly showing every session looks
        # like a broken filter: say so and stop.
        if ($ThisWindow) {
            throw "matrix: -ThisWindow needs to know which $scopeName this is, and $why. $scopeFix"
        }
        $needTabs = $false
        # Each flag loses a different thing, so each is told what it lost. A
        # remote lane is switched down its own connection and never through the
        # tab map, so -Click keeps that half.
        if ($ExposeOnSSH) {
            Write-Host ("matrix: sessions are reported, but a click from the other machine " +
                        "cannot switch to one - $why.") -ForegroundColor Yellow
        }
        if ($Click -and $Remote) {
            Write-Host "matrix: -Click reaches remote sessions only - $why." -ForegroundColor Yellow
        } elseif ($Click) {
            Write-Host "matrix: -Click does nothing - $why." -ForegroundColor Yellow
            $Click = $false
        }
    }
}

# The machines reporting in, and the socket they arrive on. A port already in use
# is said and survived: the local lanes are still worth drawing.
$hub = $null
$listener = $null
if ($Remote) {
    $hub = New-RemoteHub -Token $RemoteToken
    $listener = Start-RemoteListener -Port $RemotePort
    if ($listener.Reason) {
        Write-Host "matrix: -Remote cannot listen on 127.0.0.1:$RemotePort - $($listener.Reason)." `
                   -ForegroundColor Yellow
    }
}

function Get-LiveSession {
    # The only registry read. The priming pass and the poll must agree, or the
    # first frame differs from every frame after it.
    $live = @(Get-ClaudeSession)

    # Read the task once and carry it on the session. The tab matcher scores on it
    # and the lane header prints it: the shape must not depend on which flags are set.
    foreach ($s in $live) {
        $s | Add-Member -NotePropertyName Task -NotePropertyValue (Get-SessionFact $s).Task -Force
    }

    if ($needTabs) {
        Update-SessionTabMap -Session $live -State $script:tabState `
                             -Now $script:tabClock.ElapsedMilliseconds -ReadTab { Get-AllTerminalTab }

        # A session with no matched tab has no known window. -ThisWindow drops it
        # rather than guess that it is ours.
        if ($ThisWindow) {
            $live = @($live | Where-Object { $script:tabState.Map[$_.SessionId].Hwnd -eq $hostHwnd })
        }
    }

    # Local sessions only, and before the machines are folded in: a rain that both
    # reports and listens must not send back what it was sent.
    if ($script:expose) {
        Update-Expose -State $script:expose -Now (Get-EpochMs) -Session $live `
                      -Connect $script:tcpSeam.Connect -Read $script:tcpSeam.Read `
                      -Write $script:tcpSeam.Write -Close $script:tcpSeam.Close `
                      -Focus {
                          param($id)
                          # The same lookup the local click does. An id this
                          # machine does not run finds no tab, and nothing happens.
                          $tab = $script:tabState.Map[$id]
                          if ($tab) { [void](Select-TerminalTab $tab) }
                      }
    }

    # After the tab map and after -ThisWindow. A remote session has no local pid,
    # so it must not reach Resolve-SessionTabByPid: a remote pid that happens to
    # exist here would claim a local tab and block the session that owns it.
    # -ThisWindow does not drop these either. Asking for another machine's
    # sessions and then filtering them by window would read as a broken flag.
    if ($script:hub) {
        $now = Get-EpochMs
        Update-RemoteHub -Hub $script:hub -Now $now `
                         -Accept { Receive-RemoteConnection -Listener $script:listener.Listener } `
                         -Read $script:tcpSeam.Read -Write $script:tcpSeam.Write -Close $script:tcpSeam.Close
        $live = @($live) + @(Get-RemoteSession -Hub $script:hub -Now $now)
    }

    # No comma-wrap: the caller's @() would nest the whole array into one element.
    $live
}

function Get-SessionLanes {
    # AllowEmptyCollection: no sessions is the normal first case. A Mandatory
    # collection parameter rejects an empty array before the body runs.
    param([Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Live)
    if ($Live.Count -eq 0) {
        $where = if ($ThisWindow) { "none in this $scopeName" } else { 'waiting for one to start' }
        # A note from the hub outranks both. "no machine reported the right token"
        # is the answer to the question an empty screen raises, and the rain owns
        # the whole terminal, so this is the only place it can be said.
        if ($script:hub) {
            if ($script:hub.Note)                { $where = $script:hub.Note }
            elseif (-not $script:hub.Peer.Count) { $where = 'waiting for a machine to report' }
        }
        $st = Get-SessionStyle 'none'
        return , @(New-Lane $st.Rgb $st.Speed $st.Density $st.Label $where $null)
    }
    $out = foreach ($s in $Live) {
        $st     = $s.Style
        $age    = Format-Age $s.UpdatedAt
        $status = $st.Label
        if ($s.WaitingFor) { $status = "$status : $($s.WaitingFor)" }
        if ($age)          { $status = "$status $age" }
        # Name the tab a click would open: a wrong match is visible, not silent.
        $tab = $script:tabState.Map[$s.SessionId]
        if ($tab) { $status = "$status [tab $($tab.Index + 1)]" }
        New-Lane $st.Rgb $st.Speed $st.Density `
                 (Get-SessionTitle $s) (ConvertTo-CellText $status) $s.Task $s
    }
    , @($out)
}

function Select-ClickedSession {
    <#
    .SYNOPSIS
        Bring the session behind a clicked lane to the front.
    .DESCRIPTION
        Both routes end in the same Select-TerminalTab. Only the lookup that
        answers "which tab" differs, which is why this is one function and not two
        arms in the frame loop.

        A remote lane takes two moves, in this order. The far machine switches its
        own window, and then the ssh session holding it is raised here. Switching
        a window nobody is looking at is a click that visibly does nothing.
    #>
    param($Session)
    if (-not $Session) { return }

    if ($Session.RemoteHost) {
        $peer = Get-RemotePeer -Hub $script:hub -Session $Session
        if (-not $peer) { return }
        [void](Send-RemoteCommand -Peer $peer -Line (ConvertTo-FocusLine $Session) `
                                  -Write $script:tcpSeam.Write)
        $tab = Resolve-RemoteTab -Peer $peer
    } else {
        $tab = $script:tabState.Map[$Session.SessionId]
    }
    if ($tab) { [void](Select-TerminalTab $tab) }
}

# --- Renderer and console setup -----------------------------------------------------
$renderer = $RendererType::new($LV, $glyphs, [System.Random]::new().Next())

# Console.Out is a StreamWriter: 256-byte buffer, AutoFlush on, ~120 console
# syscalls per frame. Write the raw handle instead. The renderer encodes UTF-8
# itself, one write per frame.
$rawOut    = [Console]::OpenStandardOutput()
$needFlush = [Console]::IsOutputRedirected      # a file needs flushing, a console does not

function Write-Raw {
    param([string] $Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $rawOut.Write($bytes, 0, $bytes.Length)
    $rawOut.Flush()
}

# The stdin mode word has one owner: this snapshot. Take it before anything rewrites
# it (the -Click mouse/QuickEdit bits here, TreatControlCAsInput's
# ENABLE_PROCESSED_INPUT below). Restore it last in the finally: no mutation escapes.
$prevStdin = $null
try { $prevStdin = $VT::GetStdinMode() } catch { }
if ($Click -and $null -ne $prevStdin) {
    # Clicks need mouse reporting on and QuickEdit off. Restore QuickEdit at exit,
    # or the window cannot select text.
    try { [void]$VT::SetStdinMode((($prevStdin -bor $VT::MOUSE_ON) -band (-bnot $VT::QUICK_EDIT))) } catch { }
}

# Set before the slow priming pass below. A Ctrl+C in that gap must queue as a key:
# the first PollInput then exits cleanly through the finally. A hard kill skips
# every restore there and leaves the console encoding switched.
try { [Console]::TreatControlCAsInput = $true } catch { }

# The first poll is the expensive one: it walks the transcript folder once and reads
# each session's head and tail. Pay it here, before the screen is handed over, not as
# a frozen first frame. The loop still polls on its first iteration: the transcript
# index and per-session facts are cached by then, so that poll is a few small JSON
# reads, and it makes the opening frame current.
Write-Host 'Reading Claude sessions...' -ForegroundColor DarkGray
foreach ($s in (Get-LiveSession)) { [void](Get-SessionTitle $s) }

try { [Console]::CursorVisible = $false } catch { }

Write-Raw $ENTER_SCREEN

# Sleep() rounds to the ~15.6 ms system timer tick: a 33 ms frame budget becomes
# 47 ms and a 30 fps target becomes 25 fps. Ask for 1 ms resolution.
$timerRaised = $false
try { $timerRaised = ($VT::timeBeginPeriod(1) -eq 0) } catch { }

$clock   = [System.Diagnostics.Stopwatch]::StartNew()
$frameStats   = New-FrameStats -Show ([bool]$Stats) -TargetFps $Fps -StartMs $bootClock.Elapsed.TotalMilliseconds
$renderer.Measure = $frameStats.Show
$frameStats.PollMs = 0.0        # this loop does poll: report it even before the first
$frameMs = 1000.0 / $Fps
$pollMs  = $PollSeconds * 1000.0
$nextDue = $frameMs
$pollDue = 0.0
$sizeEvery = [Math]::Max(1, [int]($Fps / 4))   # check the window size ~4x a second
$sizeTick  = 0
$prevSec   = 0.0
$W = 0; $H = 0
$lanes      = $null
$laneBounds = $null         # col0[] and wid[], for routing a click back to a lane

try {
    while ($true) {
        if ($frameStats.Show) { $frameStats.Frame.Restart() }

        $cx = 0; $cy = 0; $ck = 0
        $what = $VT::PollInput([ref]$cx, [ref]$cy, [ref]$ck)
        if ($what -eq $VT::EXIT) { break }                  # Ctrl+C
        # The bindings live here, not in the reader. The reader says which key was
        # pressed and this block says what it does, so a second binding is a line
        # in one place. Every unbound key falls through and the rain keeps running.
        if ($what -eq $VT::KEY) {
            $key = [string][char]$ck
            if ($key -eq 'q') { break }        # -eq ignores case, so Q quits too
        }
        if ($what -eq $VT::CLICK -and $Click -and $laneBounds) {
            $l = Get-LaneAtColumn -Bounds $laneBounds -X $cx
            if ($l -ge 0) { Select-ClickedSession $lanes[$l].Session }
        }
        if ($Seconds -gt 0 -and $clock.Elapsed.TotalSeconds -ge $Seconds) { break }

        $nowMs = $clock.Elapsed.TotalMilliseconds
        $relay = $false

        # Re-read the registry a few times a second. SetLanes only disturbs a column
        # whose lane or colour changed: relaying every poll is cheap and keeps each
        # header's age current.
        if ($nowMs -ge $pollDue) {
            $pollDue = $nowMs + $pollMs
            # The registry scan, and Update-SessionTabMap behind it. It does not run
            # every frame, but the loop waits for it when it does, so a slow one
            # shows up as a stutter and nowhere else.
            $pollAt = if ($frameStats.Show) { $clock.Elapsed.TotalMilliseconds } else { 0 }
            $lanes = Get-SessionLanes @(Get-LiveSession)
            # Reported on its own, and taken back out of build: it ran inside the
            # stretch the frame clock is timing.
            if ($frameStats.Show) {
                $frameStats.PollMs      = $clock.Elapsed.TotalMilliseconds - $pollAt
                $frameStats.PollFrameMs = $frameStats.PollMs
                # After the poll, not per frame: it only changes on a poll.
                if ($expose) { $frameStats.Note = Get-ExposeStatus $expose }
            }
            $relay = $true
        }

        # (Re)initialise on the first frame and on resize. Each size read is a console
        # syscall: check a few times a second, not every frame. The read fails when
        # stdout is redirected: fall back to 80x25.
        if ($sizeTick -le 0) {
            $sizeTick = $sizeEvery
            # Windows THROWS when there is no console to measure; Linux answers 0.
            # Both mean the same thing, so both take the same fallback - without
            # the second test, a redirected run on Linux falls into the
            # too-small branch below and draws nothing for its whole life.
            try   { $nw = [Console]::WindowWidth; $nh = [Console]::WindowHeight }
            catch { $nw = 0; $nh = 0 }
            if ($nw -le 0 -or $nh -le 0) { $nw = 80; $nh = 25 }
            # Too small to rain in: draw nothing, recheck every 100 ms, and force a
            # resize on the way back. Committing the size here would leave the
            # renderer on old geometry while every later check saw no change.
            if ($nw -lt 2 -or $nh -lt 2) {
                $W = -1; $sizeTick = 0
                [System.Threading.Thread]::Sleep(100)
                continue
            }
            if ($W -ne $nw -or $H -ne $nh) {
                $W = $nw; $H = $nh
                $renderer.Resize($W, $H)
                Write-Raw $CLS
                $relay = $true          # colLane is sized to the width: redo it
            }
        }
        $sizeTick--

        if ($relay -and $lanes) { $laneBounds = Set-RendererLanes -Renderer $renderer -Lane $lanes -Width $W }

        # Advance by real elapsed time. Clamp it: a stall must not teleport the rain.
        $nowSec = $clock.Elapsed.TotalSeconds
        $dt = $nowSec - $prevSec
        $prevSec = $nowSec
        if ($dt -le 0) { $dt = 1.0 / $Fps } elseif ($dt -gt 0.25) { $dt = 0.25 }
        $renderer.WriteFrame($rawOut, $needFlush, $dt)
        if ($frameStats.Show) {
            Update-FrameStats $frameStats -Renderer $renderer -Width $W -Height $H
        }

        # Pace against a running deadline: jitter does not accumulate into drift.
        $now  = $clock.Elapsed.TotalMilliseconds
        $wait = $nextDue - $now
        # No time left to wait means the frame overran its slot. Counted, not
        # corrected: it is the symptom the build/write split explains.
        if ($wait -lt 0 -and $frameStats.Show) { $frameStats.Late++ }
        if ($wait -ge 1) { [System.Threading.Thread]::Sleep([int]$wait) }
        $nextDue += $frameMs
        if ($nextDue -lt $now) { $nextDue = $now + $frameMs }   # fell behind, resync
    }
} finally {
    Write-Raw $LEAVE_SCREEN
    Restore-ConsoleState -VT $VT -StdinMode $prevStdin
    if ($timerRaised) { try { [void]$VT::timeEndPeriod(1) } catch { } }
    if ($prevEncoding) { try { [Console]::OutputEncoding = $prevEncoding } catch { } }
    # The screen first, the sockets after: a hang here must not leave the terminal
    # in the alternate buffer with the cursor hidden.
    if ($expose)   { Reset-Expose -State $expose -Close $tcpSeam.Close }
    if ($hub)      { Stop-RemoteHub -Hub $hub -Close $tcpSeam.Close }
    if ($listener) { Stop-RemoteListener $listener.Listener }
}
