# Colour ramps, precomputed as SGR escape strings. Needs $script:ESC from console.ps1.
#
# Index contract, shared with the renderer: within a palette, 0..LV is the trail ramp
# (0 darkest), LV+1 the head, LV+2 the stats overlay. STRIDE is LV+3, so palette p
# occupies indices p*STRIDE .. p*STRIDE+LV+2.

$script:NamedPalette = @{
    Green   = @( 40, 255,  90)
    Amber   = @(255, 176,  32)
    Cyan    = @( 40, 220, 255)
    Magenta = @(255,  64, 200)
    Mono    = @(215, 215, 215)
}

function Get-NamedPalette {
    param([string] $Name)
    $script:NamedPalette[$Name]
}

function Get-Sgr {
    # Channels inline, no range and no pipeline: this runs 23 times per palette, inside
    # the poll, every time a session changes status.
    param([int[]] $From, [int[]] $To, [double] $T, [int] $Bold)
    $r = [int]($From[0] + ($To[0] - $From[0]) * $T)
    $g = [int]($From[1] + ($To[1] - $From[1]) * $T)
    $b = [int]($From[2] + ($To[2] - $From[2]) * $T)
    # the leading attribute resets the head's bold, which would otherwise stay on for
    # every glyph drawn after the first head
    "$script:ESC[$Bold;38;2;$r;$g;${b}m"
}

# One ramp per colour, not per lane. Four statuses and five named palettes are the whole
# universe of colours, so after the first few rebuilds this is a hashtable hit.
$script:RampCache = @{}

function Get-ColourRamp {
    param([int[]] $Rgb, [int] $Levels)
    $key = ($Rgb -join ',') + "|$Levels"
    $hit = $script:RampCache[$key]
    if ($hit) { return $hit }

    $ramp = [string[]]::new($Levels + 3)
    for ($i = 0; $i -le $Levels; $i++) {
        $ramp[$i] = Get-Sgr (0, 0, 0) $Rgb ([Math]::Pow($i / $Levels, 1.6)) 0
    }
    $ramp[$Levels + 1] = Get-Sgr $Rgb (255, 255, 255) 0.8 1
    $ramp[$Levels + 2] = Get-Sgr (0, 0, 0) (235, 235, 235) 1.0 1   # the -Stats line
    $script:RampCache[$key] = $ramp
    $ramp
}

function New-PaletteTable {
    <#
    .SYNOPSIS
        Flat SGR table for one or more palettes, laid out as the renderer indexes it.
    .PARAMETER Rgb
        One int[3] per palette, in lane order.
    #>
    param(
        [Parameter(Mandatory)] [object[]] $Rgb,
        [Parameter(Mandatory)] [int]      $Levels
    )
    $stride = $Levels + 3
    $fg = [string[]]::new($Rgb.Count * $stride)
    for ($p = 0; $p -lt $Rgb.Count; $p++) {
        [System.Array]::Copy((Get-ColourRamp $Rgb[$p] $Levels), 0, $fg, $p * $stride, $stride)
    }
    ,$fg
}
