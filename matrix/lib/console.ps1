# The terminal-output layer: tagged-type compilation, the escape sequences that own
# the screen, and the filter for every string drawn to it.
#
# Kept apart from types.ps1, which only loads and compiles the C# sources in cs/.

# Keep one cell per character or the header shears. Block control codes (C0, DEL, C1).
# Allow only Latin-1/Latin Extended-A: the renderer's inline UTF-8 encoder handles it.
#
# Build the allowed set once, programmatically, so file encoding never matters:
# ASCII printable \x20-\x7E + printable Latin-1 Supplement \xA0-\xFF (carries the
# middle dot the titles use) + Latin Extended-A U+0100-U+017F. Exclude the C1 range
# \x80-\x9F: those are control codes (U+009B is an 8-bit CSI). A user-set /rename
# name must not put one on the screen.
#
# Use a HashSet for O(1) lookup, not regex: PowerShell's -replace with interpolated
# character classes is fragile (backslash escaping, metacharacters). Script scope, not
# per call: this runs for every header string of every session on every poll.
$script:CellAllowed = [System.Collections.Generic.HashSet[char]]::new()
foreach ($cellCode in @(0x20..0x7E) + @(0xA0..0xFF) + @(0x0100..0x017F)) {
    [void]$script:CellAllowed.Add([char]$cellCode)
}

function ConvertTo-CellText {
    param([string] $Text)
    $sb = [System.Text.StringBuilder]::new($Text.Length)
    $chars = $Text.ToCharArray()
    for ($i = 0; $i -lt $chars.Length; $i++) {
        $c = $chars[$i]
        if ($script:CellAllowed.Contains($c)) {
            [void]$sb.Append($c)
        } else {
            [void]$sb.Append(' ')
        }
    }
    $sb.ToString()
}

function Get-RainGlyph {
    # Glyphs draw uniformly: the counts set the mix. Katakana two thirds, a letter
    # about one glyph in ten. Half-width katakana render one cell wide; the
    # full-width block takes two and shears the grid.
    param([bool] $Ascii)
    if ($Ascii) {
        return [char[]]'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz<>/\|+*=-:;?#$%&@'
    }
    ([char[]](0xFF66..0xFF9D | ForEach-Object { [char]$_ })) +
        [char[]]'ZTAESHLC' +
        [char[]]'0123456789' +
        [char[]]':."=*+-<>|'
}

$script:ESC = [char]27
$script:CLS = "$script:ESC[2J$script:ESC[H"   # clear screen, cursor home

# 1049 = alternate screen buffer, 25 = cursor, 1007 = alternate scroll (the terminal
# sends arrow keys for the mouse wheel). LEAVE must turn back on whatever ENTER turns off.
$script:ENTER_SCREEN = "$script:ESC[?1049h$script:CLS$script:ESC[?1007l$script:ESC[?25l"
$script:LEAVE_SCREEN = "$script:ESC[0m$script:CLS$script:ESC[?1007h$script:ESC[?1049l$script:ESC[?25h"

# A .NET type cannot be unloaded, so the namespaces carry a hash of the source.
# An edit then gives fresh types instead of silently reusing an earlier run's compile.
#
# The hash also names a cached assembly in TEMP: compiling shells out to csc, and the
# cached DLL loads an order of magnitude faster. Any source edit invalidates the tag.
# The name carries the runtime major version: two pwsh installs on different .NET
# majors (a stable and a preview) must not load each other's build. LoadFrom is lazy,
# so a wrong-runtime DLL resolves here and fails only at first use, past every
# fallback.
# On any error, fall back to compiling in memory. See README.md.
function Add-TaggedTypes {
    param([string] $Source, [string[]] $TypeNames)   # names hold {0} where the tag goes
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Source))
        $family = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($TypeNames -join '|'))
    } finally { $sha.Dispose() }
    $tag = ([BitConverter]::ToString($bytes) -replace '-').Substring(0, 8)

    if (-not (($TypeNames[0] -f $tag) -as [type])) {
        # One cache per source family: two compiled sources must not evict each
        # other. The family is the whole name list, not just its first entry - the
        # suite compiles ConsoleVT_Linux.cs on its own under the same first name
        # types.ps1 uses for the whole bundle, and a family read from that name
        # alone had the two deleting each other's cache on every alternating run.
        $stem = ($TypeNames[0] -split '[.{]')[0]
        $fam  = ([BitConverter]::ToString($family) -replace '-').Substring(0, 6)
        $rt   = "net$([System.Environment]::Version.Major)"
        $dll  = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-$stem-$fam-$tag-$rt.dll"
        try {
            if (-not [System.IO.File]::Exists($dll)) {
                # Compile to a private name, then move into place. A loaded assembly is
                # locked. Two rains starting at once must not load a half-written file.
                $tmp = "$dll.$PID.tmp"
                try {
                    Add-Type -TypeDefinition $Source.Replace('__TAG__', $tag) -OutputAssembly $tmp -ErrorAction Stop
                    if (-not [System.IO.File]::Exists($dll)) { [System.IO.File]::Move($tmp, $dll) }
                } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }

                # Only this tag is reachable now. Drop what earlier edits left behind.
                # Keep the runtime in the filter: runtimes cache side by side, and a
                # wider glob evicts them on every alternation.
                # Skip a copy another process still has loaded; it is locked.
                Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Filter "matrix-$stem-$fam-*-$rt.dll" -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -ne $dll } |
                    Remove-Item -Force -ErrorAction SilentlyContinue
            }
            # LoadFrom, not Add-Type -Path: the cmdlet pays the Utility module load
            # for one call. Its only extra is registering the assembly for a later
            # -ReferencedAssemblies resolve. Nothing here does that.
            if (-not (($TypeNames[0] -f $tag) -as [type])) {
                [void][System.Reflection.Assembly]::LoadFrom($dll)
            }
        } catch {
            if (-not (($TypeNames[0] -f $tag) -as [type])) {
                Add-Type -TypeDefinition $Source.Replace('__TAG__', $tag)
            }
        }
    }
    foreach ($name in $TypeNames) { ($name -f $tag) -as [type] }
}

# Handing stdin back, in the one order that works. CursorVisible and
# TreatControlCAsInput each apply .NET's own cached console state, so a stdin
# mode restored before them is overwritten by the setter after it: the mode has
# to go last of the three. Both frame loops call this from their finally, and
# both restore the output encoding after - that one does not touch stdin.
function Restore-ConsoleState {
    param($VT, $StdinMode)
    try { [Console]::CursorVisible = $true } catch { }
    try { [Console]::TreatControlCAsInput = $false } catch { }
    if ($null -ne $StdinMode) { try { [void]$VT::SetStdinMode($StdinMode) } catch { } }
}

# The -Stats scaffolding both frame loops share. It answers one question: when
# the rain is not keeping up, which step is holding it? So the frame's time is
# split rather than totalled.
#
#   build   our own work: simulate the fall, stamp the labels, encode the diff
#   write   blocked in the terminal's stream. Build near zero and write large
#           means the terminal cannot drain what it is handed, not that the
#           renderer is slow - the two are answered on different machines.
#   poll    the last session read: the registry scan, and the tab map with it.
#           It runs on -PollSeconds, not per frame, but the loop waits for it.
#   late    frames that missed their deadline. The one number that says the
#           target fps is not being met, whatever the reason.
#   runs    colour changes handed to the terminal. A terminal lays text out per
#           attribute run, so this predicts its cost far better than KB does.
#   cells   cells repainted, out of the grid. Shows how much of the screen the
#           diff actually saved.
#   start   startup, once: from the first line of the script to the first frame.
#
# The loops restart .Frame themselves at the top of a frame and call
# Update-FrameStats once the frame is written, both behind `if ($stats.Show)`: a
# call that only reaches a guard is still two parameter bindings, up to 240
# times a second, for a switch that is off by default.
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
       PollMs    = -1.0 }        # -1: nothing polls here (the preview)
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
    $Stats.BuildMs += [Math]::Max(0.0, $Stats.Frame.Elapsed.TotalMilliseconds - $writeMs)

    if ($Stats.Window.ElapsedMilliseconds -lt 1000) { return }

    $n      = [Math]::Max(1, $Stats.Frames)
    $fpsNow = $Stats.Frames * 1000.0 / $Stats.Window.ElapsedMilliseconds

    # Invariant, not the machine's culture: a decimal comma in a field this dense
    # reads as a thousands separator, and these numbers get pasted into issues.
    $inv = [System.Globalization.CultureInfo]::InvariantCulture

    # Least useful last, and dropped rather than clipped. The row is stamped into
    # the bottom line, so a narrow terminal would otherwise cut a field mid-number
    # and show half of it - worse than not showing it, because "start 0.4" and
    # "start 0.45s" are different claims.
    $head = [string]::Format($inv, ' {0}x{1} {2:N0}{3}fps late {4:N0}%',
        $Width, $Height, $fpsNow, $(if ($Stats.Target) { "/$($Stats.Target)" } else { ' ' }),
        ($Stats.Late * 100.0 / $n))
    $rest = @([string]::Format($inv, '  build {0:N2} write {1:N2} ms', ($Stats.BuildMs / $n), ($Stats.WriteMs / $n)))
    if ($Stats.PollMs -ge 0) { $rest += [string]::Format($inv, ' poll {0:N1} ms', $Stats.PollMs) }
    $rest += [string]::Format($inv, '  {0:N1}KB {1}runs{2}',
        ($Renderer.LastBytes / 1024.0), $Renderer.LastRuns,
        $(if ($Renderer.LastWrites -gt 1) { " $($Renderer.LastWrites)w" } else { '' }))
    if ($Stats.StartMs -gt 0) { $rest += [string]::Format($inv, '  start {0:N1}s', ($Stats.StartMs / 1000.0)) }

    $line = $head
    foreach ($part in $rest) {
        if ($line.Length + $part.Length + 1 -gt $Width - 2) { break }
        $line += $part
    }
    $Renderer.SetOverlay($line + ' ')

    $Stats.Frames  = 0
    $Stats.BuildMs = 0.0
    $Stats.WriteMs = 0.0
    $Stats.Late    = 0
    $Stats.Window.Restart()
}
