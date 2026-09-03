# The -Stats overlay, shared by both frame loops. It answers one question: when
# the rain is not keeping up, which step is holding it? So a frame's time is
# split, not totalled.
#
#   build   our work: simulate the fall, stamp the labels, encode the diff
#   write   blocked in the terminal's stream. Near-zero build with a large write
#           is the terminal failing to drain, not a slow renderer.
#   poll    the last session read: the registry scan and the tab map with it.
#           Runs on -PollSeconds, not per frame, but the loop waits for it.
#   late    frames that missed their deadline, whatever the reason.
#   runs    colour changes handed to the terminal. It lays text out per attribute
#           run, so this predicts its cost better than KB does.
#   start   startup, once: first line of the script to first frame.
#
# One field is words, not a timing: Note, whatever the loop wants said alongside
# the numbers. The rain uses it for -ExposeOnSSH's standing with the host, which
# is the answer to "is this even connected" and so goes ahead of the timings.
#
# build and poll are disjoint. The poll runs inside the frame being timed, so a
# loop that has one hands its duration over as PollFrameMs and this subtracts it.
# Counted twice, the field meant to clear the renderer would accuse it.
#
# The loops restart .Frame themselves and call Update-FrameStats behind
# `if ($stats.Show)`. Two parameter bindings 240 times a second is not free for a
# switch that is off by default.
function New-FrameStats {
    param([bool] $Show, [int] $TargetFps = 0, [double] $StartMs = 0.0)
    @{ Show      = [bool]$Show
       Target    = $TargetFps
       StartMs   = $StartMs
       Frame     = [System.Diagnostics.Stopwatch]::StartNew()
       Window    = [System.Diagnostics.Stopwatch]::StartNew()
       Frames    = 0
       BuildMs   = 0.0
       WriteMs   = 0.0
       Late      = 0
       PollMs    = -1.0          # -1: nothing polls here (the preview)
       PollFrameMs = 0.0         # this frame's poll, taken back out of build
       Note      = '' }          # words from the loop, '' for none
}

function Update-FrameStats {
    param(
        [Parameter(Mandatory)] $Stats,
        [Parameter(Mandatory)] $Renderer,
        [Parameter(Mandatory)] [int] $Width,
        [Parameter(Mandatory)] [int] $Height
    )
    $Stats.Frames++
    # The renderer times its own writes; the rest of the frame is ours.
    $writeMs = $Renderer.LastWriteTicks * 1000.0 / [System.Diagnostics.Stopwatch]::Frequency
    $Stats.WriteMs += $writeMs
    # Cleared as it is consumed, so a poll is charged to the one frame that waited.
    $Stats.BuildMs += [Math]::Max(0.0,
        $Stats.Frame.Elapsed.TotalMilliseconds - $writeMs - $Stats.PollFrameMs)
    $Stats.PollFrameMs = 0.0

    if ($Stats.Window.ElapsedMilliseconds -lt 1000) { return }
    $Renderer.SetOverlay((Format-StatsLine $Stats $Renderer $Width $Height) + ' ')
    Reset-StatsWindow $Stats
}

function Format-StatsLine {
    param($Stats, $Renderer, [int] $Width, [int] $Height)

    $n      = [Math]::Max(1, $Stats.Frames)
    $fpsNow = $Stats.Frames * 1000.0 / $Stats.Window.ElapsedMilliseconds
    # InvariantCulture: a decimal comma in a field this dense reads as a thousands
    # separator, and these numbers get pasted into issues.
    $inv = [System.Globalization.CultureInfo]::InvariantCulture

    $head = [string]::Format($inv, ' {0}x{1} {2:N0}{3}fps late {4:N0}%',
        $Width, $Height, $fpsNow, $(if ($Stats.Target) { "/$($Stats.Target)" } else { ' ' }),
        ($Stats.Late * 100.0 / $n))
    $rest = @()
    $rest += [string]::Format($inv, '  build {0:N2} write {1:N2} ms', ($Stats.BuildMs / $n), ($Stats.WriteMs / $n))
    if ($Stats.PollMs -ge 0) { $rest += [string]::Format($inv, ' poll {0:N1} ms', $Stats.PollMs) }
    $rest += [string]::Format($inv, '  {0:N1}KB {1}runs{2}',
        ($Renderer.LastBytes / 1024.0), $Renderer.LastRuns,
        $(if ($Renderer.LastWrites -gt 1) { " $($Renderer.LastWrites)w" } else { '' }))
    if ($Stats.StartMs -gt 0) { $rest += [string]::Format($inv, '  start {0:N1}s', ($Stats.StartMs / 1000.0)) }

    # The note leads, and is fitted on its own rather than at the head of the list
    # below. That list drops its tail whole, so a note too wide for the terminal
    # would take every timing with it - and the timings are what -Stats is for.
    $line = $head
    if ($Stats.Note) {
        $note = "  $($Stats.Note)"
        if ($line.Length + $note.Length + 1 -le $Width - 2) { $line += $note }
    }

    # Least useful last, and dropped whole rather than clipped. StampOverlay takes
    # $Width - 2, and half of "start 0.45s" is a different number.
    foreach ($part in $rest) {
        if ($line.Length + $part.Length + 1 -gt $Width - 2) { break }
        $line += $part
    }
    $line
}

function Reset-StatsWindow {
    # The averages cover one second each, so the accumulators start over with it.
    param($Stats)
    $Stats.Frames  = 0
    $Stats.BuildMs = 0.0
    $Stats.WriteMs = 0.0
    $Stats.Late    = 0
    $Stats.Window.Restart()
}
