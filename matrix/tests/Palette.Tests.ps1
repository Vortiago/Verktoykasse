BeforeAll {
    . (Join-Path $PSScriptRoot '..\lib\console.ps1')
    . (Join-Path $PSScriptRoot '..\lib\palette.ps1')
    $script:E = [char]27
    $script:LV = 20
}

Describe 'Get-NamedPalette' {
    It 'knows the five named palettes' {
        Get-NamedPalette 'Green' | Should -Be @(40, 255, 90)
        Get-NamedPalette 'Mono'  | Should -Be @(215, 215, 215)
    }

    It 'has nothing for a name it does not know' {
        Get-NamedPalette 'Puce' | Should -BeNullOrEmpty
    }
}

Describe 'Get-Sgr' {
    It 'lands on the endpoints it was given' {
        Get-Sgr @(0, 0, 0) @(10, 20, 30) 0.0 0 | Should -Be "$E[0;38;2;0;0;0m"
        Get-Sgr @(0, 0, 0) @(10, 20, 30) 1.0 0 | Should -Be "$E[0;38;2;10;20;30m"
    }

    It 'interpolates each channel on its own' {
        Get-Sgr @(0, 100, 200) @(100, 200, 0) 0.5 0 | Should -Be "$E[0;38;2;50;150;100m"
    }

    It 'leads with the bold attribute, which resets the head bold of the cell before' {
        Get-Sgr @(0, 0, 0) @(1, 1, 1) 1.0 1 | Should -Be "$E[1;38;2;1;1;1m"
    }
}

Describe 'Get-ColourRamp' {
    It 'is as long as the index contract says: levels, head, overlay' {
        (Get-ColourRamp @(40, 255, 90) $LV) | Should -HaveCount ($LV + 3)
    }

    It 'runs dark to bright over the trail' {
        $ramp = Get-ColourRamp @(40, 255, 90) $LV
        $ramp[0]   | Should -Be "$E[0;38;2;0;0;0m"      # level 0 is black
        $ramp[$LV] | Should -Be "$E[0;38;2;40;255;90m"  # level LV is the palette colour
    }

    It 'puts the bold head above the trail, and the stats line above that' {
        $ramp = Get-ColourRamp @(40, 255, 90) $LV
        $ramp[$LV + 1] | Should -Match "^$E\[1;"        # head, bold
        $ramp[$LV + 2] | Should -Be "$E[1;38;2;235;235;235m"
    }

    It 'does not rebuild a ramp it has already built' {
        # 23 SGR strings per palette is most of a lane rebuild's cost. This runs
        # every time a session changes status.
        $first = Get-ColourRamp @(1, 2, 3) $LV
        Mock Get-Sgr { throw 'rebuilt a cached ramp' }
        $again = Get-ColourRamp @(1, 2, 3) $LV
        Should -Invoke Get-Sgr -Times 0
        $again | Should -Be $first
    }

    It 'keys the cache on the level count as well as the colour' {
        # Same colour, different level count. A cache keyed on colour alone hands
        # back a wrong-length ramp, and the renderer indexes past its end.
        Get-ColourRamp @(4, 5, 6) $LV       | Should -HaveCount ($LV + 3)
        Get-ColourRamp @(4, 5, 6) ($LV - 1) | Should -HaveCount ($LV + 2)
    }
}

Describe 'New-PaletteTable' {
    It 'lays palettes out at the stride the renderer indexes on' {
        # Indexed, not a literal list: PowerShell flattens @(@(..), @(..)) into six ints.
        $rgb = [object[]]::new(2)
        $rgb[0] = @(40, 255, 90); $rgb[1] = @(255, 60, 60)
        $t = New-PaletteTable -Rgb $rgb -Levels $LV
        $stride = $LV + 3
        $t | Should -HaveCount (2 * $stride)
        $t[$LV]           | Should -Be "$E[0;38;2;40;255;90m"     # palette 0 at its level LV
        $t[$stride + $LV] | Should -Be "$E[0;38;2;255;60;60m"     # palette 1, one stride on
    }

    It 'returns the table as one array, not as its elements' {
        # A comma-wrapped return. Without it the caller collects a table of strings,
        # and the renderer gets the first escape instead of the table.
        $t = New-PaletteTable -Rgb @(, @(40, 255, 90)) -Levels $LV
        , $t | Should -BeOfType [string[]]
    }
}
