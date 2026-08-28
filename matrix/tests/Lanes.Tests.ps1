BeforeAll {
    . (Join-Path $PSScriptRoot '..\lib\console.ps1')
    . (Join-Path $PSScriptRoot '..\lib\palette.ps1')
    . (Join-Path $PSScriptRoot '..\lib\lanes.ps1')

    # Stands in for the compiled renderer: Set-RendererLanes is layout, and the layout is
    # what it hands over.
    function New-FakeRenderer {
        $o = [pscustomobject]@{ Palettes = $null; Lanes = $null }
        $o | Add-Member ScriptMethod SetPalettes { param($t) $this.Palettes = $t }
        $o | Add-Member ScriptMethod SetLanes {
            param($lane, $fall, $dens, $col0, $wid, $hdr, $level)
            $this.Lanes = @{ Lane = $lane; Fall = $fall; Dens = $dens
                             Col0 = $col0; Wid = $wid; Hdr = $hdr; Level = $level }
        }
        $o
    }
}

Describe 'Split-Wrap' {
    It 'wraps greedily on words' {
        Split-Wrap -Text 'one two three four' -Width 9 -MaxLines 4 |
            Should -Be @('one two', 'three', 'four')
    }

    It 'returns one line per element, never a single joined string' {
        # A comma-wrapped return nested the array into one element here once, and the
        # header drew it as one space-joined line.
        $out = @(Split-Wrap -Text 'one two three four' -Width 9 -MaxLines 4)
        $out.Count | Should -Be 3
        $out[0] | Should -BeOfType [string]
    }

    It 'ends a truncated wrap in an ellipsis, so it does not read as a finished sentence' {
        $out = @(Split-Wrap -Text 'one two three four five six' -Width 9 -MaxLines 2)
        $out.Count | Should -Be 2
        $out[-1] | Should -Match '…$'
    }

    It 'leaves a wrap that fits alone' {
        @(Split-Wrap -Text 'one two' -Width 9 -MaxLines 3) -join '|' | Should -Be 'one two'
    }

    It 'breaks a single word wider than the lane' {
        Split-Wrap -Text 'abcdefghijkl' -Width 5 -MaxLines 3 |
            Should -Be @('abcde', 'fghij', 'kl')
    }

    It 'keeps every line inside the width' {
        $out = @(Split-Wrap -Text 'alpha bravo charlie delta echo foxtrot' -Width 11 -MaxLines 4)
        ($out | Where-Object { $_.Length -gt 11 }) | Should -HaveCount 0
    }

    It 'gives back nothing when there is no room or nothing to say' {
        @(Split-Wrap -Text 'anything' -Width 3 -MaxLines 3) | Should -HaveCount 0
        @(Split-Wrap -Text 'anything' -Width 20 -MaxLines 0) | Should -HaveCount 0
        @(Split-Wrap -Text '' -Width 20 -MaxLines 3) | Should -HaveCount 0
    }
}

Describe 'Format-Age' {
    It 'says nothing about a timestamp it cannot use' {
        Format-Age 0 | Should -Be ''
        Format-Age ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 60000) | Should -Be ''
    }

    It 'counts seconds, then minutes, then hours' {
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        Format-Age ($now - 5000)      | Should -Be '5s'
        Format-Age ($now - 300000)    | Should -Be '5m'
        Format-Age ($now - 7200000)   | Should -Be '2h'
    }
}

Describe 'New-Lane' {
    It 'carries what a lane is' {
        $lane = New-Lane @(1, 2, 3) 1.5 0.25 'title' 'status' 'task'
        $lane.Rgb   | Should -Be @(1, 2, 3)
        $lane.Fall  | Should -Be 1.5
        $lane.Title | Should -Be 'title'
    }

    It 'carries the session a click on it opens, so no parallel array can desync' {
        $s = [pscustomobject]@{ SessionId = 'sid-1' }
        (New-Lane @(1, 2, 3) 1 0.2 't' 's' $null $s).Session.SessionId | Should -Be 'sid-1'
        (New-Lane @(1, 2, 3) 1 0.2 't' 's' $null).Session | Should -BeNullOrEmpty
    }
}

Describe 'Set-RendererLanes' {
    BeforeEach {
        # The palette table is only rebuilt when the colours move, so the cached key has
        # to go or a later test sees no SetPalettes call.
        $script:PaletteKey = $null
        $script:r = New-FakeRenderer
    }

    It 'hands back exactly two arrays, which is what routes a click to a lane' {
        $lanes = 1..3 | ForEach-Object { New-Lane @(0, 255, 0) 1 0.2 "t$_" 's' $null }
        $bounds = Set-RendererLanes -Renderer $r -Lane $lanes -Width 60
        @($bounds).Count | Should -Be 2
        $col0, $wid = $bounds
        $col0 | Should -HaveCount 3
        $wid  | Should -HaveCount 3
    }

    It 'gives one lane the whole width' {
        $bounds = Set-RendererLanes -Renderer $r -Lane @((New-Lane @(0, 255, 0) 1 0.2 $null $null $null)) -Width 40
        $col0, $wid = $bounds
        $col0 | Should -Be @(0)
        $wid  | Should -Be @(40)
    }

    It 'splits the width and leaves a gutter between lanes' {
        $lanes = 1..2 | ForEach-Object { New-Lane @(0, 255, 0) 1 0.2 "t$_" 's' $null }
        # Two steps, as matrix.ps1 does it: assigning straight from the call does not
        # unroll the pair, it puts the whole thing in the first variable.
        $bounds = Set-RendererLanes -Renderer $r -Lane $lanes -Width 40
        $col0, $wid = $bounds
        $wid[0] + $wid[1] | Should -Be 39      # one column of gutter
        $col0 | Should -Be @(0, 21)
    }

    It 'drops the gutter rather than the width when the lanes are narrow' {
        $lanes = 1..4 | ForEach-Object { New-Lane @(0, 255, 0) 1 0.2 "t$_" 's' $null }
        $bounds = Set-RendererLanes -Renderer $r -Lane $lanes -Width 20
        $col0, $wid = $bounds
        ($wid | Measure-Object -Sum).Sum | Should -Be 20
    }

    It 'marks gutter columns as owned by no lane' {
        $lanes = 1..2 | ForEach-Object { New-Lane @(0, 255, 0) 1 0.2 "t$_" 's' $null }
        [void](Set-RendererLanes -Renderer $r -Lane $lanes -Width 40)
        $r.Lanes.Lane[20] | Should -Be -1
        $r.Lanes.Lane[0]  | Should -Be 0
        $r.Lanes.Lane[39] | Should -Be 1
    }

    It 'gives a wide lane a title, a status and three task rows' {
        $lane = New-Lane @(0, 255, 0) 1 0.2 'name' 'working' 'a task worth wrapping over rows'
        [void](Set-RendererLanes -Renderer $r -Lane @($lane) -Width 40)
        $r.Lanes.Level | Should -HaveCount 5           # title + status + 3 task rows
        $r.Lanes.Hdr[0] | Should -Be 'name'
        $r.Lanes.Hdr[1] | Should -Be 'working'
    }

    It 'drops the task, then the title, as the lane narrows' {
        $lane = New-Lane @(0, 255, 0) 1 0.2 'name' 'working' 'a task'
        [void](Set-RendererLanes -Renderer $r -Lane @($lane) -Width 12)
        $r.Lanes.Level | Should -HaveCount 2           # title + status, no task

        $script:PaletteKey = $null
        $r2 = New-FakeRenderer
        [void](Set-RendererLanes -Renderer $r2 -Lane @($lane) -Width 8)
        $r2.Lanes.Level | Should -HaveCount 1          # status only
    }

    It 'writes no header rows at all when no lane has a header' {
        # Not [int[]]@($rows.Level): on an empty $rows that yields ONE element, and the
        # renderer then reads a header row nobody wrote. -Ascii crashed on it.
        $lane = New-Lane @(0, 255, 0) 1 0.2 $null $null $null
        [void](Set-RendererLanes -Renderer $r -Lane @($lane) -Width 40)
        $r.Lanes.Level | Should -HaveCount 0
        $r.Lanes.Hdr   | Should -HaveCount 0
    }

    It 'keeps a one-lane colour triple as one palette, not three' {
        # A pipeline over the lane list unrolled a single int[3] into three lanes here.
        $lane = New-Lane @(40, 255, 90) 1 0.2 $null $null $null
        [void](Set-RendererLanes -Renderer $r -Lane @($lane) -Width 40)
        $r.Palettes | Should -HaveCount 23             # one palette: LV + 3
    }

    It 'rebuilds the palette table only when the colours move' {
        $green = New-Lane @(40, 255, 90) 1 0.2 $null $null $null
        $red   = New-Lane @(255, 60, 60) 1 0.2 $null $null $null
        [void](Set-RendererLanes -Renderer $r -Lane @($green) -Width 40)
        $r.Palettes = $null
        [void](Set-RendererLanes -Renderer $r -Lane @($green) -Width 40)
        $r.Palettes | Should -BeNullOrEmpty            # same colours, no rebuild
        [void](Set-RendererLanes -Renderer $r -Lane @($red) -Width 40)
        $r.Palettes | Should -Not -BeNullOrEmpty
    }
}

Describe 'Get-LaneAtColumn' {
    # Extracted from the frame loop, where the click routing was three hops of indexing
    # that nothing could reach. Bounds come straight from Set-RendererLanes.
    BeforeAll {
        $script:PaletteKey = $null
        $script:bounds = Set-RendererLanes -Renderer (New-FakeRenderer) -Width 40 `
            -Lane @((New-Lane @(0, 255, 0) 1 0.2 't1' 's' $null),
                    (New-Lane @(0, 255, 0) 1 0.2 't2' 's' $null))
    }

    It 'finds the lane a column belongs to' {
        Get-LaneAtColumn -Bounds $bounds -X 0  | Should -Be 0
        Get-LaneAtColumn -Bounds $bounds -X 19 | Should -Be 0
        Get-LaneAtColumn -Bounds $bounds -X 21 | Should -Be 1
        Get-LaneAtColumn -Bounds $bounds -X 39 | Should -Be 1
    }

    It 'owns no lane in the gutter' {
        Get-LaneAtColumn -Bounds $bounds -X 20 | Should -Be -1
    }

    It 'owns no lane off the end, which is where a click on a resized window lands' {
        Get-LaneAtColumn -Bounds $bounds -X 40   | Should -Be -1
        Get-LaneAtColumn -Bounds $bounds -X 4000 | Should -Be -1
    }
}
