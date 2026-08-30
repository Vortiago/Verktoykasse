BeforeAll {
    . (Join-Path $PSScriptRoot '..\lib\console.ps1')
    . (Join-Path $PSScriptRoot '..\lib\types.ps1')
    . (Join-Path $PSScriptRoot '..\lib\palette.ps1')
    . (Join-Path $PSScriptRoot '..\lib\lanes.ps1')
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

Describe 'rising rain' {
    It 'enters from the bottom when the fall speed is negative' {
        $r = New-TestRenderer 20 12
        Set-RendererLanes -Renderer $r -Lane @((New-Lane @(255, 60, 60) -1 1.0 $null $null $null)) -Width 20
        $rows = @()
        for ($i = 0; $i -lt 100 -and $rows.Count -eq 0; $i++) {
            $rows = @([regex]::Matches((Get-Frame $r 0.1), "$([char]27)\[(\d+);\d+H") |
                      ForEach-Object { [int]$_.Groups[1].Value })
        }
        $rows.Count | Should -BeGreaterThan 0
        ($rows | Measure-Object -Minimum).Minimum | Should -BeGreaterThan 6
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

Describe 'SetOverlay' {
    It 'puts the stats line on the frame' {
        $r = New-TestRenderer 40 8
        [void](Set-StillLane $r @(40, 255, 90) 'HEADER' 'working')
        $r.SetOverlay(' 40x8  30.0 fps ')
        (Get-Frame $r) | Should -Match '30\.0 fps'
    }
}
