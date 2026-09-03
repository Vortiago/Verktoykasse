BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/stats.ps1')
    $script:E = [char]27
}

Describe 'ConvertTo-CellText' {
    It 'keeps one cell per character' {
        # A character wider than one cell shears the header. Replace a filtered
        # character, never drop it.
        $in = "a`tb" + [char]0xFF66 + 'c'
        (ConvertTo-CellText $in).Length | Should -Be $in.Length
    }

    It 'leaves plain ASCII alone' {
        $asciiTest = 'matrix-session-status working 6m'
        ConvertTo-CellText $asciiTest | Should -Be $asciiTest
    }

    It 'keeps Latin-1 and Latin Extended-A, which the encoder handles' {
        # $([char]...) subexpressions: file encoding never corrupts the test data.
        # (${[char]...} is a braced VARIABLE lookup. It expands to nothing, and this
        # test then asserted on pure ASCII while claiming to cover Latin-1.)
        $expected = "Verkt$([char]0x00F8)ykasse $([char]0x00C6)rlig $([char]0x0101) $([char]0x00B7)"
        ConvertTo-CellText $expected | Should -Be $expected
    }

    It 'replaces control characters' {
        ConvertTo-CellText "a`tb`nc`r$E" | Should -Be 'a b c  '
    }

    It 'replaces the C1 range, which is control codes, not text' {
        # U+009B is an 8-bit CSI: a /rename name carrying it must not reach the screen.
        ConvertTo-CellText ('a' + [char]0x009B + 'b' + [char]0x0085) | Should -Be 'a b '
    }

    It 'replaces anything that would draw wider than one cell' {
        ConvertTo-CellText ([char]0xFF66 + [char]0x4E2D) | Should -Be '  '
    }

    It 'has nothing to say about empty text' {
        ConvertTo-CellText '' | Should -Be ''
    }
}

Describe 'The screen escapes' {
    It 'turns back on everything it turned off' {
        # LEAVE must re-enable whatever ENTER disables. Otherwise the terminal loses
        # its cursor, its scrollback, or its wheel.
        foreach ($mode in 1049, 1007, 25) {
            ($ENTER_SCREEN + $LEAVE_SCREEN | Select-String -Pattern "\?$mode" -AllMatches).Matches |
                Should -HaveCount 2
        }
    }

    It 'leaves the alternate buffer last, after clearing and resetting' {
        $LEAVE_SCREEN | Should -Match "\?1049l"
        # Ordinal: the default string search is culture-sensitive. It can miss an
        # escape sequence that is plainly there.
        $LEAVE_SCREEN.StartsWith("$E[0m", [StringComparison]::Ordinal) | Should -BeTrue
    }
}

Describe 'Add-TaggedTypes' {
    BeforeAll {
        # Its own type family, so it never touches the renderer's cached assembly.
        $script:src = @'
namespace PesterProbe__TAG__
{
    public static class Probe { public static int Answer() { return 42; } }
}
'@
    }

    It 'compiles the source and hands back the tagged type' {
        $t = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $t | Should -Not -BeNullOrEmpty
        $t::Answer() | Should -Be 42
    }

    It 'gives the same source the same type instead of compiling twice' {
        $a = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $b = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $a.FullName | Should -Be $b.FullName
    }

    It 'gives edited source a different type, because a .NET type cannot be unloaded' {
        $edited = $src.Replace('return 42;', 'return 43;')
        $a = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $b = Add-TaggedTypes $edited 'PesterProbe{0}.Probe'
        $a.FullName | Should -Not -Be $b.FullName
        $b::Answer() | Should -Be 43
    }

    It 'names the cached assembly for the runtime, so no two evict or poison each other' {
        [void](Add-TaggedTypes $src 'PesterProbe{0}.Probe')
        $rt = "net$([System.Environment]::Version.Major)"
        Get-ChildItem ([System.IO.Path]::GetTempPath()) -Filter "matrix-PesterProbe-*-$rt.dll" |
            Should -Not -BeNullOrEmpty
    }
}

Describe 'Frame stats' {
    # The overlay exists to say WHERE a slow frame went, so the split is what is
    # asserted. The clocks are stand-ins: a real Stopwatch cannot be moved to the
    # one-second mark, and Update-FrameStats only asks them for elapsed time.
    BeforeAll {
        function New-FakeClock ($ms) {
            [pscustomobject]@{ ElapsedMilliseconds = $ms
                               Elapsed = [pscustomobject]@{ TotalMilliseconds = [double]$ms } } |
                Add-Member ScriptMethod Restart {} -PassThru |
                Add-Member ScriptMethod Stop {} -PassThru
        }
        function New-FakeRenderer ($writeMs = 0.0, $bytes = 2048, $runs = 110, $writes = 1, $cells = 60) {
            $ticks = [long]($writeMs * [System.Diagnostics.Stopwatch]::Frequency / 1000.0)
            [pscustomobject]@{ LastWriteTicks = $ticks; LastBytes = $bytes; LastRuns = $runs
                               LastWrites = $writes; LastCells = $cells; Overlay = '' } |
                Add-Member ScriptMethod SetOverlay { param($l) $this.Overlay = $l } -PassThru
        }
        # One frame of $frameMs, of which $writeMs was spent in the terminal.
        # Wide by default: which fields are present is one question, and what a
        # narrow terminal drops is another.
        function Get-StatsLine ($frameMs, $writeMs, $stats = $null, $width = 200) {
            if (-not $stats) { $stats = New-FrameStats -Show $true -TargetFps 30 }
            $stats.Frame  = New-FakeClock $frameMs
            $stats.Window = New-FakeClock 1000
            $r = New-FakeRenderer $writeMs
            Update-FrameStats $stats -Renderer $r -Width $width -Height 25
            $r.Overlay
        }
    }

    It 'splits a frame into our build and the time blocked in the terminal' {
        # 10 ms of frame, 8 of it waiting on the terminal: the renderer is not the
        # problem, and the line has to be able to say so.
        Get-StatsLine 10.0 8.0 | Should -Match 'build 2\.00 write 8\.00'
    }

    It 'reports the geometry, the achieved rate against the target, and late frames' {
        $line = Get-StatsLine 10.0 8.0
        $line | Should -Match '200x25'
        $line | Should -Match '1/30fps'          # one frame in the fake second
        $line | Should -Match 'late 0%'
    }

    It 'counts a frame that overran its slot' {
        $stats = New-FrameStats -Show $true -TargetFps 30
        $stats.Late = 1
        Get-StatsLine 10.0 8.0 $stats | Should -Match 'late 100%'
    }

    It 'names what the terminal was handed, in runs and not only in bytes' {
        # A terminal lays text out per attribute run, so this is the number that
        # predicts its cost. Bytes alone do not.
        Get-StatsLine 4.0 1.0 | Should -Match '2\.0KB 110runs'
    }

    It 'leaves the poll out where nothing polls' {
        # The preview has no session read, and "poll 0.0" would read as a
        # measurement rather than an absence.
        Get-StatsLine 4.0 1.0 | Should -Not -Match 'poll'
    }

    It 'reports the poll once a loop that has one has run it' {
        $stats = New-FrameStats -Show $true -TargetFps 30
        $stats.PollMs = 12.5
        Get-StatsLine 4.0 1.0 $stats | Should -Match 'poll 12\.5'
    }

    It 'does not also charge the poll to build, which ran inside the same frame' {
        # A 10 ms frame holding an 8 ms poll and a 1 ms write left 1 ms of our
        # own work. Counted twice, the poll makes the renderer look like the
        # problem on exactly the frames where it is not.
        $stats = New-FrameStats -Show $true -TargetFps 30
        $stats.PollMs = 8.0; $stats.PollFrameMs = 8.0
        Get-StatsLine 10.0 1.0 $stats | Should -Match 'build 1\.00 write 1\.00'
    }

    It 'charges the poll to the one frame that waited for it' {
        # Cleared as it is consumed: the next frame does not still pay for it.
        $stats = New-FrameStats -Show $true -TargetFps 30
        $stats.PollFrameMs = 8.0
        $stats.Frame  = New-FakeClock 10.0
        $stats.Window = New-FakeClock 400          # under the window: keep accumulating
        Update-FrameStats $stats -Renderer (New-FakeRenderer 1.0) -Width 200 -Height 25
        $stats.PollFrameMs | Should -Be 0.0
        [Math]::Round($stats.BuildMs, 2) | Should -Be 1.0
    }

    It 'reports startup once it is known' {
        $stats = New-FrameStats -Show $true -TargetFps 30 -StartMs 940
        Get-StatsLine 4.0 1.0 $stats | Should -Match 'start 0\.9s'
    }

    It 'formats invariantly, whatever the machine decides a decimal point is' {
        # A decimal comma in a field this dense reads as a thousands separator.
        $prev = [System.Threading.Thread]::CurrentThread.CurrentCulture
        try {
            [System.Threading.Thread]::CurrentThread.CurrentCulture = [cultureinfo]'nb-NO'
            Get-StatsLine 10.0 8.0 | Should -Match 'build 2\.00'
        } finally { [System.Threading.Thread]::CurrentThread.CurrentCulture = $prev }
    }

    It 'drops whole fields on a narrow terminal rather than cutting one in half' {
        # The row is stamped into the bottom line and clipped there, so a field cut
        # mid-number would not read as missing - it would read as a smaller number.
        $stats = New-FrameStats -Show $true -TargetFps 30 -StartMs 940
        $stats.PollMs = 12.0
        $narrow = Get-StatsLine 10.0 8.0 $stats 60
        $narrow | Should -Match 'build 2\.00 write 8\.00'
        $narrow | Should -Not -Match 'start'
        $narrow.Length | Should -BeLessOrEqual 58        # what StampOverlay will take
    }

    It 'keeps every field when there is room for it' {
        $stats = New-FrameStats -Show $true -TargetFps 30 -StartMs 940
        $stats.PollMs = 12.0
        $wide = Get-StatsLine 10.0 8.0 $stats 200
        foreach ($f in 'build', 'write', 'poll', 'runs', 'start') { $wide | Should -Match $f }
    }

    It 'puts the note the loop hands it ahead of the timings' {
        # The one field that is not a number: -ExposeOnSSH's standing with the
        # host. It answers "is this even connected", so a narrow terminal drops
        # the timings before it.
        $stats = New-FrameStats -Show $true -TargetFps 30 -StartMs 940
        $stats.Note = 'host connected'
        Get-StatsLine 10.0 8.0 $stats 200 | Should -Match 'late \d+%  host connected  build'
        $narrow = Get-StatsLine 10.0 8.0 $stats 48
        $narrow | Should -Match 'host connected'
        $narrow | Should -Not -Match 'build'
    }

    It 'leaves the note out where the loop has none' {
        Get-StatsLine 10.0 8.0 | Should -Not -Match 'host'
    }

    It 'drops a note too wide for the terminal without taking the timings with it' {
        # The tail is dropped whole from the first field that does not fit. The
        # note leads, so were it in that tail a long refusal would leave nothing
        # but the frame rate - and the timings are what -Stats is for.
        $stats = New-FrameStats -Show $true -TargetFps 30
        $stats.Note = 'host refused: not JSON, or a version this build does not speak'
        $narrow = Get-StatsLine 10.0 8.0 $stats 60
        $narrow | Should -Match 'build 2\.00 write 8\.00'
        $narrow | Should -Not -Match 'host'
    }

    It 'says nothing until its window is up' {
        $stats = New-FrameStats -Show $true -TargetFps 30
        $stats.Frame  = New-FakeClock 10
        $stats.Window = New-FakeClock 400          # not a second yet
        $r = New-FakeRenderer 8.0
        Update-FrameStats $stats -Renderer $r -Width 80 -Height 25
        $r.Overlay | Should -BeNullOrEmpty
        $stats.Frames | Should -Be 1               # still accumulating
    }
}
