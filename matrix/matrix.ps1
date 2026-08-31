<#
.SYNOPSIS
    A live Matrix-rain view of every open Claude Code session.

.DESCRIPTION
    Runs in the alternate screen buffer: scrollback survives. Any key exits.

    The screen splits into one vertical lane per open Claude Code session. Each
    lane is coloured and paced by that session's status. The header names the
    session, its status and its opening prompt.

    Per-status colour, speed and density are in styles.psd1.
    See README.md for how it works.

.PARAMETER ThisWindow
    Show only sessions in the same terminal window as this rain (Windows Terminal
    or Konsole).

.PARAMETER Click
    Left-click a lane to switch to that session's terminal tab. On Windows, tabs
    match on title, so the match can be wrong: the lane header names the tab it
    would open, and it needs "Show status in terminal tab" on in Claude Code. On
    Konsole the match is exact - a tab is that session's process ancestor.

.PARAMETER PollSeconds
    How often the session registry is re-read. Default 1.

.PARAMETER Fps
    Target frames per second (5-240). Default 30. Smoothness only: the rain falls
    at the same rate at any frame rate.

.PARAMETER Seconds
    Stop automatically after N seconds. 0 (default) = run until a key is pressed.

.PARAMETER Stats
    Show frames/sec, frame build time and bytes per frame on the bottom line.

.EXAMPLE
    .\matrix.ps1

.EXAMPLE
    .\matrix.ps1 -ThisWindow -Click    # this window's sessions, click to switch

.NOTES
    Press any key (or Ctrl+C) to exit. Mouse activity and terminal shortcuts do not
    stop it: clicks, Ctrl+wheel zoom, scrolling, Alt+Enter and Ctrl+Shift+C are
    ignored. Arrow and page keys count as scrolling, not as "any key".
#>
#requires -Version 7
[CmdletBinding()]
param(
    [switch] $ThisWindow,
    [switch] $Click,
    [ValidateRange(0.2, 30)]  [double] $PollSeconds = 1.0,
    [ValidateRange(5, 240)]   [int]    $Fps         = 30,
    [ValidateRange(0, 86400)] [int]    $Seconds     = 0,
    [switch] $Stats
)

$ErrorActionPreference = 'Stop'

if ($Host.Name -like '*ISE*') {
    throw 'Run this in Windows Terminal, PowerShell or conhost - the ISE has no real console.'
}

foreach ($part in 'console', 'types', 'palette', 'lanes', 'sessions', 'tabs') {
    $file = Join-Path (Join-Path $PSScriptRoot 'lib') "$part.ps1"
    if (-not (Test-Path -LiteralPath $file)) { throw "matrix: cannot load $file" }
    . $file
}

# Konsole on Linux: the same five tab functions tabs.ps1 defines for Windows
# Terminal, answered over D-Bus instead. Sourced after tabs.ps1, so these
# definitions win.
if (-not $IsWindows) {
    . (Join-Path (Join-Path $PSScriptRoot 'lib') 'konsole.ps1')
}

# Read before anything slow runs. -ThisWindow and -Click take the foreground
# terminal. It is only reliably ours right after the user typed the command.
$hostHwnd = if ($ThisWindow -or $Click) { Get-OwnTerminalWindow } else { 0 }

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
# session-to-tab match there is a pid walk, not a title match.
$needTabs = [bool]($ThisWindow -or $Click)
if ($needTabs) {
    $why = Test-TabSupport -Hwnd $hostHwnd
    if ($why) {
        # -ThisWindow asked for a smaller set. Quietly showing every session looks
        # like a broken filter: say so and stop.
        if ($ThisWindow) {
            throw ("matrix: -ThisWindow needs to know which terminal window this is, and $why. " +
                   'Start it from the window you want scoped and leave that window in ' +
                   'front, or drop -ThisWindow to show every session.')
        }
        Write-Host "matrix: -Click does nothing - $why." -ForegroundColor Yellow
        $needTabs = $false; $Click = $false
    }
}

# Owned here; Update-SessionTabMap keeps it current. Map is sessionId -> tab.
# Each tab carries the handle of its window.
$tabState = New-TabState
$tabClock = [System.Diagnostics.Stopwatch]::StartNew()

function Get-LiveSession {
    # The only registry read. The priming pass and the poll must agree, or the
    # first frame differs from every frame after it.
    $live = @(Get-ClaudeSession)

    # Read the task once; carry it on the session. The tab matcher scores against it
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

    # No comma-wrap: the caller's @() would nest the whole array into one element.
    $live
}

function Get-SessionLanes {
    # AllowEmptyCollection: no sessions is the normal first case. A Mandatory
    # collection parameter rejects an empty array before the body runs.
    param([Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Live)
    if ($Live.Count -eq 0) {
        $where = if ($ThisWindow) { 'none in this terminal window' } else { 'waiting for one to start' }
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
$frameStats   = New-FrameStats -Show ([bool]$Stats)
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

        $cx = 0; $cy = 0
        $what = $VT::PollInput([ref]$cx, [ref]$cy)
        if ($what -eq $VT::EXIT) { break }
        if ($what -eq $VT::CLICK -and $Click -and $laneBounds) {
            $l = Get-LaneAtColumn -Bounds $laneBounds -X $cx
            $s = if ($l -ge 0) { $lanes[$l].Session } else { $null }
            if ($s) {
                $tab = $tabState.Map[$s.SessionId]
                if ($tab) { [void](Select-TerminalTab $tab) }
            }
        }
        if ($Seconds -gt 0 -and $clock.Elapsed.TotalSeconds -ge $Seconds) { break }

        $nowMs = $clock.Elapsed.TotalMilliseconds
        $relay = $false

        # Re-read the registry a few times a second. SetLanes only disturbs a column
        # whose lane or colour changed: relaying every poll is cheap and keeps each
        # header's age current.
        if ($nowMs -ge $pollDue) {
            $pollDue = $nowMs + $pollMs
            $lanes = Get-SessionLanes @(Get-LiveSession)
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
        if ($wait -ge 1) { [System.Threading.Thread]::Sleep([int]$wait) }
        $nextDue += $frameMs
        if ($nextDue -lt $now) { $nextDue = $now + $frameMs }   # fell behind, resync
    }
} finally {
    Write-Raw $LEAVE_SCREEN
    Restore-ConsoleState -VT $VT -StdinMode $prevStdin
    if ($timerRaised) { try { [void]$VT::timeEndPeriod(1) } catch { } }
    if ($prevEncoding) { try { [Console]::OutputEncoding = $prevEncoding } catch { } }
}
