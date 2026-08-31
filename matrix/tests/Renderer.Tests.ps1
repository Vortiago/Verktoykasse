BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot '../lib/types.ps1')
    . (Join-Path $PSScriptRoot '../lib/palette.ps1')
    . (Join-Path $PSScriptRoot '../lib/lanes.ps1')
    $script:RendererType = $RendererType
    $script:E     = [char]27
    $script:GREEN = "$([char]27)[0;38;2;40;255;90m"
    $script:RED   = "$([char]27)[0;38;2;255;60;60m"

    # 'Z' alone: anything in a frame that is not header text is rain. A new renderer
    # also clears the cached palette key. Set-RendererLanes pushes a palette table
    # only when the colours move, and a fresh renderer has none to move from.
    function New-TestRenderer ($w, $h) {
        $script:PaletteKey = $null
        $r = $RendererType::new(20, [char[]]'Z', 4242)
        $r.Resize($w, $h)
        $r
    }

    function Get-Frame ($r, $dt = 0.0) {
        $ms = [System.IO.MemoryStream]::new()
        $r.WriteFrame($ms, $false, $dt)
        [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
    }

    # Still rain: no fall, no density, so only the header is ever drawn.
    function Set-StillLane ($r, $rgb, $title, $status, $width = 40) {
        Set-RendererLanes -Renderer $r -Lane @((New-Lane $rgb 0 0 $title $status $null)) -Width $width
    }
    function Set-FallingLane ($r, $rgb, $width = 40) {
        Set-RendererLanes -Renderer $r -Lane @((New-Lane $rgb 8 1.0 $null $null $null)) -Width $width
    }
}

Describe 'WriteFrame' {
    It 'writes nothing before it has been told what to draw' {
        # Resize alone leaves it without palettes or lanes.
        $r = New-TestRenderer 20 6
        Get-Frame $r | Should -Be ''
    }

    It 'draws the header of a still lane, and nothing else' {
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        $frame = Get-Frame $r
        $frame | Should -Match 'HEADER'
        $frame | Should -Match 'working'
        $frame | Should -Not -Match 'Z'      # the whole glyph pool; none of it fell
    }

    It 'rains once a lane has density' {
        $r = New-TestRenderer 40 8
        [void](Set-FallingLane $r @(40, 255, 90))
        $seen = ''
        1..20 | ForEach-Object { $seen += Get-Frame $r 0.1 }
        $seen | Should -Match 'Z'
    }

    It 'reports what it wrote' {
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        [void](Get-Frame $r)
        $r.LastBytes  | Should -BeGreaterThan 0
        $r.LastWrites | Should -Be 1          # one stream write per frame
    }

    It 'draws the same thing twice from the same seed' {
        $runs = foreach ($pass in 1, 2) {
            $r = New-TestRenderer 40 8
            [void](Set-RendererLanes -Renderer $r -Width 40 `
                    -Lane @((New-Lane @(40, 255, 90) 8 0.5 'T' 's' $null)))
            $acc = ''
            1..5 | ForEach-Object { $acc += Get-Frame $r 0.1 }
            $acc
        }
        $runs[0] | Should -Be $runs[1]
    }

    It 'only sends what changed' {
        # The frame diff is the whole point of the encoder: a still lane redrawn is
        # nearly empty.
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        $first = Get-Frame $r
        $again = Get-Frame $r
        $again.Length | Should -BeLessThan $first.Length
    }
}

Describe 'A palette that changes under drawn cells' {
    It 'repaints the header in the new colour' {
        # The bug this covers: a cell keeps its colour INDEX when a status changes.
        # Only what the index resolves to moves. The diff compares packed cells, so
        # it never re-emitted the header glyphs (the same text every frame). The
        # header kept the colour of whatever status the lane started in.
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        (Get-Frame $r) | Should -Match ([regex]::Escape($GREEN))

        # The SAME header text in a new colour. The ordinary diff re-emits changed
        # text, so changed text would not test the repaint at all.
        [void](Set-StillLane $r @(255, 60, 60) 'HEADER' 'working')
        $after = Get-Frame $r
        $after | Should -Match ([regex]::Escape($RED))
        $after | Should -Not -Match ([regex]::Escape($GREEN))
    }

    It 'leaves the header alone when nothing about it moved' {
        # A new palette table forces the repaint, not every call. Otherwise a still
        # lane re-sends its whole header every frame.
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        [void](Get-Frame $r)
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        (Get-Frame $r) | Should -Not -Match ([regex]::Escape($GREEN))
    }
}

Describe 'SetLanes' {
    It 'survives the lane geometry flipping under it' {
        # 5 lanes x 1 header row and 1 lane x 5 rows are the same array length. The
        # old layout's row lengths would otherwise be read against the new one.
        $r = New-TestRenderer 60 10
        $five = 1..5 | ForEach-Object { New-Lane @(40, 255, 90) 0 0 $null "s$_" $null }
        [void](Set-RendererLanes -Renderer $r -Lane $five -Width 60)
        [void](Get-Frame $r)

        $one = New-Lane @(40, 255, 90) 0 0 'title' 'status' 'a task that wraps over three rows here'
        [void](Set-RendererLanes -Renderer $r -Lane @($one) -Width 60)
        { Get-Frame $r } | Should -Not -Throw
        (Get-Frame $r 0.1) | Should -Not -Match 's1'      # the old headers are gone
    }

    It 'recolours a falling column in place rather than restarting it' {
        # Same one-lane geometry, new colour. A slow lane would otherwise hold its
        # old colour until its head had moved the length of the screen.
        $r = New-TestRenderer 40 8
        [void](Set-FallingLane $r @(40, 255, 90))
        1..10 | ForEach-Object { [void](Get-Frame $r 0.1) }
        [void](Set-FallingLane $r @(255, 60, 60))
        (Get-Frame $r 0.1) | Should -Match ([regex]::Escape("$E[0;38;2;"))
    }
}

Describe 'Resize' {
    It 'takes a new size without losing the lane' {
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        [void](Get-Frame $r)
        $r.Resize(20, 5)
        $script:PaletteKey = $null                        # a resized renderer needs its palette back
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working' 20)
        (Get-Frame $r) | Should -Match 'HEADER'
    }

    It 'copes with a window too small to hold the header' {
        $r = New-TestRenderer 6 2
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working' 6)
        { Get-Frame $r } | Should -Not -Throw
    }
}

Describe 'Frame cost counters' {
    # What -Stats reports about the terminal's side of the work. Runs are colour
    # changes: a terminal lays text out per attribute run, so a frame's cost to it
    # tracks these far better than it tracks bytes.
    It 'counts the cells it repainted and the colour changes it emitted' {
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        [void](Get-Frame $r)
        $r.LastCells | Should -BeGreaterThan 0
        $r.LastRuns  | Should -BeGreaterThan 0
        $r.LastRuns  | Should -BeLessOrEqual $r.LastCells   # never more than one per cell
    }

    It 'repaints nothing on a frame where nothing moved' {
        # The diff is the whole reason the rain is cheap: a still frame must cost
        # the terminal nothing at all.
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        [void](Get-Frame $r)
        [void](Get-Frame $r)
        $r.LastCells | Should -Be 0
        $r.LastRuns  | Should -Be 0
        $r.LastBytes | Should -Be 0
    }

    It 'leaves the write clock at zero unless it was asked to measure' {
        # Two timestamps a frame is not free, and -Stats is off by default.
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        [void](Get-Frame $r)
        $r.LastWriteTicks | Should -Be 0
        $r.Measure = $true
        [void](Set-StillLane $r @(255, 60, 60) 'OTHER' 'idle')
        [void](Get-Frame $r)
        $r.LastWriteTicks | Should -BeGreaterOrEqual 0
    }
}

Describe 'Synchronized output' {
    # DECSET 2026: hold the frame until the end marker, so the terminal paints
    # once instead of at every write that lands mid-frame. Konsole repaints on a
    # bulk timer as bytes trickle in, which is where most of its write cost on a
    # full rain frame goes; every terminal that does not know the mode ignores
    # the pair, Windows Terminal included.
    It 'opens the frame with the begin marker and closes it with the end marker' {
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        $frame = Get-Frame $r
        $frame.StartsWith("$E[?2026h") | Should -BeTrue -Because 'the frame begins with BSU'
        $frame.EndsWith("$E[?2026l")   | Should -BeTrue -Because 'the frame ends with ESU'
    }

    It 'says nothing at all on a frame that drew nothing' {
        # An empty frame must not carry an open-then-close pair: that is two
        # escapes telling the terminal to paint nothing.
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        [void](Get-Frame $r)
        Get-Frame $r | Should -Be ''
    }
}

Describe 'SetOverlay' {
    It 'puts the stats line on the frame' {
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        $r.SetOverlay(' 40x8  30.0 fps ')
        (Get-Frame $r) | Should -Match '30\.0 fps'
    }
}
