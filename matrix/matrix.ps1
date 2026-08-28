<#
.SYNOPSIS
    Matrix-style falling code rain for the PowerShell console, optionally a live view of
    every open Claude Code session.

.DESCRIPTION
    Runs in the alternate screen buffer, so scrollback survives, and exits on any key.

    With -Sessions the screen splits into one vertical lane per open Claude Code
    session, coloured and paced by that session's status, under a header naming the
    session, its status and its opening prompt.

    How any of it works is in README.md.

.PARAMETER Palette
    Green (default), Amber, Cyan, Magenta or Mono. Ignored by -Sessions, which colours
    each lane by status.

.PARAMETER Ascii
    Use ASCII glyphs instead of half-width katakana.

.PARAMETER Sessions
    Rain the open Claude Code sessions, one lane each, coloured and paced by status.

.PARAMETER PollSeconds
    How often -Sessions re-reads the session registry. Default 1.

.PARAMETER IncludeBackground
    Also show background and daemon sessions, not just interactive ones.

.PARAMETER ThisWindow
    Only sessions running in the same Windows Terminal window as this rain.

.PARAMETER Click
    Left-click a lane to switch to that session's Windows Terminal tab. The lane
    header names the tab it would open, because the tab is matched on its title and
    the match can be wrong. Needs "Show status in terminal tab" on in Claude Code.

.PARAMETER Fps
    Target frames per second (5-240). Default 30. Affects smoothness only - the rain
    falls at the same rate at any frame rate.

.PARAMETER Speed
    Fall-rate multiplier (0.1-5.0). Default 1.0. Scales the per-status rates too.

.PARAMETER Density
    How busy the rain is (0.02-1.0). Default 0.25. Scales the per-status rates too.

.PARAMETER Seconds
    Stop automatically after N seconds. 0 (default) = run until a key is pressed.

.PARAMETER Stats
    Show frames/sec, frame build time and bytes per frame on the bottom line.

.EXAMPLE
    .\matrix.ps1

.EXAMPLE
    .\matrix.ps1 -Sessions

.EXAMPLE
    .\matrix.ps1 -Sessions -ThisWindow -Click    # this window's sessions, click to switch

.EXAMPLE
    .\matrix.ps1 -Palette Amber -Density 0.6 -Stats

.NOTES
    Press any key (or Ctrl+C) to exit. Mouse activity and terminal shortcuts are
    ignored, so clicks, Ctrl+wheel zoom, scrolling, Alt+Enter and Ctrl+Shift+C do not
    stop it. Arrow and page keys are treated as scrolling, not as "any key".
#>
[CmdletBinding(DefaultParameterSetName = 'Rain')]
param(
    [Parameter(ParameterSetName = 'Rain')]
    [ValidateSet('Green', 'Amber', 'Cyan', 'Magenta', 'Mono')]
                                                         [string]   $Palette = 'Green',

    [Parameter(Mandatory, ParameterSetName = 'Sessions')] [switch]  $Sessions,
    [Parameter(ParameterSetName = 'Sessions')]
    [ValidateRange(0.2, 30)]                             [double]   $PollSeconds = 1.0,
    [Parameter(ParameterSetName = 'Sessions')]           [switch]   $IncludeBackground,
    [Parameter(ParameterSetName = 'Sessions')]           [switch]   $ThisWindow,
    [Parameter(ParameterSetName = 'Sessions')]           [switch]   $Click,

                               [switch] $Ascii,
    [ValidateRange(5, 240)]    [int]    $Fps     = 30,
    [ValidateRange(0.02, 1.0)] [double] $Density = 0.25,
    [ValidateRange(0.1, 5.0)]  [double] $Speed   = 1.0,
    [ValidateRange(0, 86400)]  [int]    $Seconds = 0,
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

# Read before anything slow runs: -ThisWindow and -Click take the terminal that was in
# front, and that is only reliably ours while the user is still looking at what they
# just typed into.
$hostHwnd = if ($ThisWindow -or $Click) { Get-OwnTerminalWindow } else { 0 }

# make sure ANSI escape sequences are interpreted (a no-op where they already are)
try {
    $mode = [uint32]0
    $handle = $VT::GetStdHandle(-11)
    if ($VT::GetConsoleMode($handle, [ref]$mode)) {
        [void]$VT::SetConsoleMode($handle, $mode -bor 0x0004)   # VIRTUAL_TERMINAL_PROCESSING
    }
} catch { }

# --- UTF-8 output, or the katakana turn into "?" on Windows PowerShell 5.1 ----------
$prevEncoding = $null
try {
    $prevEncoding = [Console]::OutputEncoding
    if ($prevEncoding.CodePage -ne 65001) {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    }
} catch {
    $Ascii = $true   # can't emit katakana, so use the ASCII glyph set instead
}

if ($Ascii) {
    $glyphs = [char[]]'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz<>/\|+*=-:;?#$%&@'
} else {
    # Drawn uniformly, so the counts are the mix: katakana two thirds, a letter about
    # one glyph in ten. Half-width katakana render one cell wide; the full-width block
    # takes two and shears the grid.
    $glyphs = ([char[]](0xFF66..0xFF9D | ForEach-Object { [char]$_ })) +
              [char[]]'ZTAESHLC' +
              [char[]]'0123456789' +
              [char[]]':."=*+-<>|'
}

# Both -ThisWindow and -Click hang off the tab map: Windows Terminal keeps every window
# in one process, so a window is identified by its handle and a session by the tab whose
# title matches it. Resolved once - this rain cannot move window.
$needTabs = [bool]($ThisWindow -or $Click)
if ($needTabs) {
    $why = ''
    if (-not $hostHwnd) { $why = 'this is not a Windows Terminal window, or it was not in front at startup' }
    elseif (-not (Initialize-Uia)) { $why = 'UI Automation is unavailable' }
    if ($why) {
        # -ThisWindow asked for a smaller set. Quietly showing every session instead
        # looks like the filter is broken, so say so and stop.
        if ($ThisWindow) {
            throw ("matrix: -ThisWindow needs to know which terminal window this is, and $why. " +
                   'Start it from the window you want scoped and leave that window in ' +
                   'front, or drop -ThisWindow to show every session.')
        }
        Write-Host "matrix: -Click does nothing - $why." -ForegroundColor Yellow
        $needTabs = $false; $Click = $false
    }
}

# Owned here, kept current by Update-SessionTabMap. Map is sessionId -> tab, and the
# tab carries the handle of the window holding it.
$tabState = @{ Sig = ''; Map = @{}; RetryAt = 0; RetryWait = 0 }
$tabClock = [System.Diagnostics.Stopwatch]::StartNew()

# -Density and -Speed are absolute in the other modes and multipliers here, so the
# per-status rates are scaled relative to the defaults rather than replaced.
$densScale = $Density / 0.25

function Get-LiveSession {
    # The only place that reads the registry: the priming pass and the poll must agree,
    # or the first frame differs from every frame after it.
    $live = @(Get-ClaudeSession -IncludeBackground:$IncludeBackground)

    # The task, read once and carried on the session. The tab matcher scores against it
    # and the lane header prints it, so the shape must not depend on which flags are set.
    foreach ($s in $live) {
        $s | Add-Member -NotePropertyName Task -NotePropertyValue (Get-SessionFact $s).Task -Force
    }

    if ($needTabs) {
        Update-SessionTabMap -Session $live -State $script:tabState `
                             -Now $script:tabClock.ElapsedMilliseconds -ReadTab { Get-AllTerminalTab }

        # A session with no matched tab cannot be placed in a window, so -ThisWindow
        # drops it rather than guessing that it is ours.
        if ($ThisWindow) {
            $live = @($live | Where-Object { $script:tabState.Map[$_.SessionId].Hwnd -eq $hostHwnd })
        }
    }

    # no comma-wrap: the caller collects with @(), which would nest the whole array into
    # one element
    $live
}

function Get-SessionLanes {
    # AllowEmptyCollection: no sessions is the normal first case, and a Mandatory
    # collection parameter rejects an empty array before the body ever runs.
    param([Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Live)
    if ($Live.Count -eq 0) {
        $where = if ($ThisWindow) { 'none in this terminal window' } else { 'waiting for one to start' }
        return , @(New-Lane (Get-SessionStyle 'gone').Rgb (0.3 * $Speed) (0.12 * $densScale) `
                            'no claude sessions' $where $null)
    }
    $out = foreach ($s in $Live) {
        $st     = $s.Style
        $age    = Format-Age $s.UpdatedAt
        $status = $st.Label
        if ($s.WaitingFor) { $status = "$status : $($s.WaitingFor)" }
        if ($age)          { $status = "$status $age" }
        # name the tab a click would open, so a wrong match is visible not silent
        $tab = $script:tabState.Map[$s.SessionId]
        if ($tab) { $status = "$status [tab $($tab.Index + 1)]" }
        New-Lane $st.Rgb ($st.Speed * $Speed) ($st.Density * $densScale) `
                 (Get-SessionTitle $s) (ConvertTo-CellText $status) $s.Task $s
    }
    , @($out)
}

# --- Renderer and console setup -----------------------------------------------------
$renderer = $RendererType::new($LV, $glyphs, [System.Random]::new().Next())

# Console.Out is a StreamWriter with a 256-byte buffer and AutoFlush on, which splits
# one frame into ~120 console syscalls. Write the raw handle instead and let the
# renderer encode UTF-8 itself, one write per frame.
$rawOut    = [Console]::OpenStandardOutput()
$needFlush = [Console]::IsOutputRedirected      # a file needs flushing, a console does not

function Write-Raw {
    param([string] $Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $rawOut.Write($bytes, 0, $bytes.Length)
    $rawOut.Flush()
}

# The first poll is the expensive one: it walks the transcript folder once and reads the
# head and tail of each session's own. That would show as a frozen first frame, so it is
# paid out here, before the screen is handed over. What it read seeds the first frame,
# so the walk is not repeated the moment the loop starts.
$primed = $null
if ($Sessions) {
    Write-Host 'Reading Claude sessions...' -ForegroundColor DarkGray
    $primed = @(Get-LiveSession)
    foreach ($s in $primed) { [void](Get-SessionTitle $s) }
}

try { [Console]::TreatControlCAsInput = $true } catch { }
try { [Console]::CursorVisible = $false } catch { }

# Clicks only arrive once mouse reporting is on and QuickEdit is off. QuickEdit goes
# back on at exit, or the window is left unable to select text.
$prevStdin = $null
if ($Click) {
    try {
        $prevStdin = $VT::GetStdinMode()
        [void]$VT::SetStdinMode((($prevStdin -bor $VT::MOUSE_ON) -band (-bnot $VT::QUICK_EDIT)))
    } catch { $prevStdin = $null }
}

Write-Raw $ENTER_SCREEN

# Sleep() rounds to the system timer tick (~15.6 ms), which turns a 33 ms frame budget
# into 47 ms and a 30 fps target into 25 fps. Ask for 1 ms resolution.
$timerRaised = $false
try { $timerRaised = ($VT::timeBeginPeriod(1) -eq 0) } catch { }

$frame   = [System.Diagnostics.Stopwatch]::StartNew()
$clock   = [System.Diagnostics.Stopwatch]::StartNew()
$statSw  = [System.Diagnostics.Stopwatch]::StartNew()
$frameMs = 1000.0 / $Fps
$pollMs  = $PollSeconds * 1000.0
$nextDue = $frameMs
$pollDue = if ($null -ne $primed) { $pollMs } else { 0.0 }   # primed: do not walk it twice
$frames  = 0
$buildMs = 0.0
$sizeEvery = [Math]::Max(1, [int]($Fps / 4))   # check the window size ~4x a second
$sizeTick  = 0
$prevSec   = 0.0
$W = 0; $H = 0
$lanes      = if ($null -ne $primed) { Get-SessionLanes $primed } else { $null }
$laneBounds = $null         # col0[] and wid[], for routing a click back to a lane

try {
    while ($true) {
        $frame.Restart()

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

        # Re-read the registry a few times a second. SetLanes only disturbs a column whose
        # lane or colour actually changed, so relaying every poll is cheap and keeps the
        # age in each header current.
        if ($Sessions -and $nowMs -ge $pollDue) {
            $pollDue = $nowMs + $pollMs
            $lanes = Get-SessionLanes @(Get-LiveSession)
            $relay = $true
        }

        # (Re)initialise on the first frame and whenever the window is resized. Each size
        # read is a console syscall, so check a few times a second, not every frame. The
        # read fails when stdout is redirected: fall back to 80x25.
        if ($sizeTick -le 0) {
            $sizeTick = $sizeEvery
            try   { $nw = [Console]::WindowWidth; $nh = [Console]::WindowHeight }
            catch { $nw = 80; $nh = 25 }
            # Too small to rain in: draw nothing, keep looking every 100 ms, and force a
            # resize on the way back. Committing the size here instead would leave the
            # renderer on the old geometry while every later check saw no change.
            if ($nw -lt 2 -or $nh -lt 2) {
                $W = -1; $sizeTick = 0
                [System.Threading.Thread]::Sleep(100)
                continue
            }
            if ($W -ne $nw -or $H -ne $nh) {
                $W = $nw; $H = $nh
                $renderer.Resize($W, $H)
                Write-Raw $CLS
                if (-not $lanes) {
                    $lanes = @(New-Lane (Get-NamedPalette $Palette) $Speed $Density $null $null $null)
                }
                $relay = $true          # colLane is sized to the width, so it must be redone
            }
        }
        $sizeTick--

        if ($relay -and $lanes) { $laneBounds = Set-RendererLanes -Renderer $renderer -Lane $lanes -Width $W }

        # advance by real elapsed time, clamped so a stall cannot teleport the rain
        $nowSec = $clock.Elapsed.TotalSeconds
        $dt = $nowSec - $prevSec
        $prevSec = $nowSec
        if ($dt -le 0) { $dt = 1.0 / $Fps } elseif ($dt -gt 0.25) { $dt = 0.25 }
        $renderer.WriteFrame($rawOut, $needFlush, $dt)

        $frames++
        $buildMs += $frame.Elapsed.TotalMilliseconds
        if ($Stats -and $statSw.ElapsedMilliseconds -ge 1000) {
            $fpsNow = $frames * 1000.0 / $statSw.ElapsedMilliseconds
            $renderer.SetOverlay((' {0}x{1}  {2:N1} fps  {3:N2} ms/frame  {4:N1} KB/frame  {5} write(s) ' -f
                $W, $H, $fpsNow, ($buildMs / [Math]::Max(1, $frames)), ($renderer.LastBytes / 1024.0), $renderer.LastWrites))
            $frames = 0; $buildMs = 0.0; $statSw.Restart()
        }

        # pace against a running deadline so jitter doesn't accumulate into drift
        $now  = $clock.Elapsed.TotalMilliseconds
        $wait = $nextDue - $now
        if ($wait -ge 1) { [System.Threading.Thread]::Sleep([int]$wait) }
        $nextDue += $frameMs
        if ($nextDue -lt $now) { $nextDue = $now + $frameMs }   # fell behind, resync
    }
} finally {
    Write-Raw $LEAVE_SCREEN
    try { [Console]::CursorVisible = $true } catch { }
    try { [Console]::TreatControlCAsInput = $false } catch { }
    if ($null -ne $prevStdin) { try { [void]$VT::SetStdinMode($prevStdin) } catch { } }
    if ($timerRaised) { try { [void]$VT::timeEndPeriod(1) } catch { } }
    if ($prevEncoding) { try { [Console]::OutputEncoding = $prevEncoding } catch { } }
}
