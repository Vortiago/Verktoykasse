<#
.SYNOPSIS
    One lane per session state, straight from styles.psd1, for tuning the look.

.PARAMETER Fps
    Target frames per second (5-240). Default 30.

.PARAMETER Seconds
    Stop automatically after N seconds. 0 (default) = run until a key is pressed.

.PARAMETER Shuffle
    Every few seconds, flip one of the three session lanes to another state, to
    see how transitions flow.

.PARAMETER Stats
    Show frames/sec, frame build time and bytes per frame on the bottom line.
    The same numbers matrix.ps1 shows, but with nothing behind them but the
    render: no session reads, no tab map.

.EXAMPLE
    .\preview-matrix.ps1
#>
#requires -Version 7
[CmdletBinding()]
param(
    [ValidateRange(5, 240)]   [int] $Fps     = 30,
    [ValidateRange(0, 86400)] [int] $Seconds = 0,
    [switch] $Shuffle,
    [switch] $Stats
)

$ErrorActionPreference = 'Stop'

foreach ($part in 'console', 'types', 'palette', 'lanes') {
    $file = Join-Path (Join-Path $PSScriptRoot 'lib') "$part.ps1"
    if (-not (Test-Path -LiteralPath $file)) { throw "matrix: cannot load $file" }
    . $file
}

$styles = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'styles.psd1')
$task   = 'The opening prompt of the session, wrapped over up to three header rows.'

function New-PreviewLane {
    param([string[]] $State)
    @(foreach ($s in $State) {
        $st = $styles[$s]
        New-Lane $st.Rgb $st.Speed $st.Density $s $st.Label $task
    })
}

$laneState = @('busy', 'idle', 'waiting', 'none')
$lanes     = New-PreviewLane $laneState
$rand      = [System.Random]::new()

# Enable ANSI escape processing (a no-op where it is already on).
try {
    $mode = [uint32]0
    $handle = $VT::GetStdHandle(-11)
    if ($VT::GetConsoleMode($handle, [ref]$mode)) {
        [void]$VT::SetConsoleMode($handle, $mode -bor 0x0004)   # VIRTUAL_TERMINAL_PROCESSING
    }
} catch { }

$prevEncoding = $null
try {
    $prevEncoding = [Console]::OutputEncoding
    if ($prevEncoding.CodePage -ne 65001) {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    }
    $useAscii = $false
} catch {
    $useAscii = $true
}

$renderer  = $RendererType::new($LV, (Get-RainGlyph -Ascii:$useAscii), [System.Random]::new().Next())
$rawOut    = [Console]::OpenStandardOutput()
$needFlush = [Console]::IsOutputRedirected

function Write-Raw {
    param([string] $Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $rawOut.Write($bytes, 0, $bytes.Length)
    $rawOut.Flush()
}

try { [Console]::TreatControlCAsInput = $true } catch { }
try { [Console]::CursorVisible = $false } catch { }
Write-Raw $ENTER_SCREEN

$clock     = [System.Diagnostics.Stopwatch]::StartNew()
$frameMs   = 1000.0 / $Fps
$nextDue   = $frameMs
$prevSec   = 0.0
$sizeEvery = [Math]::Max(1, [int]($Fps / 4))
$sizeTick  = 0
$W = 0; $H = 0
$shuffleDue = 2.0
$frameStats      = New-FrameStats -Show ([bool]$Stats)

try {
    while ($true) {
        Update-FrameStats $frameStats -Begin

        $cx = 0; $cy = 0
        if ($VT::PollInput([ref]$cx, [ref]$cy) -eq $VT::EXIT) { break }
        if ($Seconds -gt 0 -and $clock.Elapsed.TotalSeconds -ge $Seconds) { break }

        if ($sizeTick -le 0) {
            $sizeTick = $sizeEvery
            try   { $nw = [Console]::WindowWidth; $nh = [Console]::WindowHeight }
            catch { $nw = 80; $nh = 25 }
            if ($nw -lt 2 -or $nh -lt 2) {
                $sizeTick = 0
                [System.Threading.Thread]::Sleep(100)
                continue
            }
            if ($W -ne $nw -or $H -ne $nh) {
                $W = $nw; $H = $nh
                $renderer.Resize($W, $H)
                Write-Raw $CLS
                [void](Set-RendererLanes -Renderer $renderer -Lane $lanes -Width $W)
            }
        }
        $sizeTick--

        # Like a real status change: same lanes, new colour and pace.
        if ($Shuffle -and $clock.Elapsed.TotalSeconds -ge $shuffleDue) {
            $shuffleDue = $clock.Elapsed.TotalSeconds + 2 + 3 * $rand.NextDouble()
            $i = $rand.Next(0, 3)
            $pick = @('busy', 'idle', 'waiting') | Where-Object { $_ -ne $laneState[$i] }
            $laneState[$i] = $pick[$rand.Next(0, $pick.Count)]
            $lanes = New-PreviewLane $laneState
            if ($W -gt 0) { [void](Set-RendererLanes -Renderer $renderer -Lane $lanes -Width $W) }
        }

        $nowSec = $clock.Elapsed.TotalSeconds
        $dt = $nowSec - $prevSec
        $prevSec = $nowSec
        if ($dt -le 0) { $dt = 1.0 / $Fps } elseif ($dt -gt 0.25) { $dt = 0.25 }
        $renderer.WriteFrame($rawOut, $needFlush, $dt)
        Update-FrameStats $frameStats -Renderer $renderer -Width $W -Height $H

        $now  = $clock.Elapsed.TotalMilliseconds
        $wait = $nextDue - $now
        if ($wait -ge 1) { [System.Threading.Thread]::Sleep([int]$wait) }
        $nextDue += $frameMs
        if ($nextDue -lt $now) { $nextDue = $now + $frameMs }
    }
} finally {
    Write-Raw $LEAVE_SCREEN
    try { [Console]::CursorVisible = $true } catch { }
    try { [Console]::TreatControlCAsInput = $false } catch { }
    if ($prevEncoding) { try { [Console]::OutputEncoding = $prevEncoding } catch { } }
}
