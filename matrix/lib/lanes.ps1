# Lanes: one vertical band each, with its own palette, fall speed, density and header.
#
# This file owns the two numbers for a lane's colours and header. The renderer's
# index contract is written against them. See README.md.

$LV        = 20   # trail levels per palette; palette.ps1 and the renderer share this
$TASK_ROWS = 3    # header rows the wrapped task gets when the lane is wide enough

# Rebuild only when a status changes: nothing else moves the colours.
$script:PaletteKey = $null

function New-Lane {
    # A click on this lane raises Session. It rides on the lane, not in a second
    # array the caller keeps in step by hand, so nothing can desync.
    param([int[]] $Rgb, [double] $Fall, [double] $Dens,
          [string] $Title, [string] $Status, [string] $Task, [object] $Session)
    [pscustomobject]@{ Rgb = $Rgb; Fall = $Fall; Dens = $Dens
                       Title = $Title; Status = $Status; Task = $Task; Session = $Session }
}

function Split-Wrap {
    # Greedy word wrap. When text is left over, the last line ends in a horizontal
    # ellipsis. A truncated task must not read as a finished sentence.
    param([string] $Text, [int] $Width, [int] $MaxLines)
    if (-not $Text -or $Width -lt 4 -or $MaxLines -lt 1) { return @() }

    $out = [System.Collections.Generic.List[string]]::new()
    $line = ''
    $cut  = $false
    foreach ($word in ($Text -split '\s+')) {
        if (-not $word) { continue }
        while ($word.Length -gt $Width) {            # a single word wider than the lane
            if ($line) { $out.Add($line); $line = '' }
            if ($out.Count -ge $MaxLines) { $cut = $true; break }
            $out.Add($word.Substring(0, $Width))
            $word = $word.Substring($Width)
        }
        if ($out.Count -ge $MaxLines) { $cut = $true; break }
        $try = if ($line) { "$line $word" } else { $word }
        if ($try.Length -le $Width) { $line = $try; continue }
        $out.Add($line); $line = $word
        if ($out.Count -ge $MaxLines) { $cut = $true; break }
    }
    if ($line) {
        if ($out.Count -lt $MaxLines) { $out.Add($line) } else { $cut = $true }
    }

    if ($cut -and $out.Count -gt 0) {
        $last = $out[$out.Count - 1]
        if ($last.Length -ge $Width) { $last = $last.Substring(0, $Width - 1) }
        # U+2026 horizontal ellipsis via escape: file encoding never mangles it
        $out[$out.Count - 1] = "$last$([char]0x2026)"
    }
    # No comma-wrap: the caller collects with @(). That would nest a wrapped array
    # into one element and stringify it into a single space-joined line.
    $out
}

function Set-RendererLanes {
    <#
    .SYNOPSIS
        Lay lanes out across the width and push them into the renderer.
    #>
    param([Parameter(Mandatory)] $Renderer, [Parameter(Mandatory)] [object[]] $Lane, [int] $Width)

    $n = $Lane.Count
    # one blank column between lanes, only while each lane keeps a usable width
    $gutter = if ($n -gt 1 -and $Width -ge $n * 6) { 1 } else { 0 }
    $avail  = $Width - $gutter * ($n - 1)
    $base   = [Math]::Max(1, [int][Math]::Floor($avail / $n))
    $extra  = $avail - $base * $n

    $colLane = [int[]]::new($Width)
    for ($x = 0; $x -lt $Width; $x++) { $colLane[$x] = -1 }   # gutters own the rest

    $col0 = [int[]]::new($n); $wid = [int[]]::new($n)
    # indexed, not piped: a pipeline unrolls a one-lane rgb triple into three lanes
    $rgb = [object[]]::new($n)
    $at = 0
    for ($l = 0; $l -lt $n; $l++) {
        $wide = $base + $(if ($l -lt $extra) { 1 } else { 0 })
        if ($at + $wide -gt $Width) { $wide = $Width - $at }
        $col0[$l] = $at; $wid[$l] = [Math]::Max(0, $wide)
        for ($x = $at; $x -lt $at + $wid[$l]; $x++) { $colLane[$x] = $l }
        $at += $wid[$l] + $gutter
        $rgb[$l] = $Lane[$l].Rgb
    }

    # Decide what the narrowest lane can carry. A narrow lane drops the task, then
    # the title, rather than wrap either into unreadable stubs. Title is brightest,
    # status the pure palette colour, task dimmer.
    $narrow = [int]::MaxValue
    $hasHdr = $false
    for ($l = 0; $l -lt $n; $l++) {
        if ($wid[$l] -gt 0 -and $wid[$l] -lt $narrow) { $narrow = $wid[$l] }
        if ($Lane[$l].Title -or $Lane[$l].Status) { $hasHdr = $true }
    }

    # One row spec per header line, widest lane first: the lane property it shows,
    # its brightness, and for a Task row which wrapped task line it is.
    $rows = @()
    if ($hasHdr) {
        if ($narrow -ge 10) { $rows += @{ Field = 'Title';  Level = $LV + 1 } }
        $rows += @{ Field = 'Status'; Level = $LV }
        if ($narrow -ge 18) {
            for ($i = 0; $i -lt $TASK_ROWS; $i++) { $rows += @{ Field = 'Task'; Level = $LV - 6; Line = $i } }
        }
    }

    # Not [int[]]@($rows.Level): on an empty $rows that yields one element, not none.
    # The renderer then reads a header row that was never written.
    $per   = $rows.Count
    $level = [int[]]::new($per)
    for ($r = 0; $r -lt $per; $r++) { $level[$r] = $rows[$r].Level }

    $hdr = [string[]]::new($n * $per)
    for ($l = 0; $l -lt $n; $l++) {
        $task = $null
        for ($r = 0; $r -lt $per; $r++) {
            if ($rows[$r].Field -ne 'Task') { $hdr[$l * $per + $r] = $Lane[$l].($rows[$r].Field); continue }
            if ($null -eq $task) { $task = @(Split-Wrap -Text $Lane[$l].Task -Width $wid[$l] -MaxLines $TASK_ROWS) }
            $hdr[$l * $per + $r] = $task[$rows[$r].Line]
        }
    }


    # Rebuilding 23 SGR strings per lane is most of this function's cost. The colours
    # move only when a status does.
    $key = ($rgb | ForEach-Object { $_ -join ',' }) -join '|'   # cheap: n is the lane count
    if ($key -ne $script:PaletteKey) {
        $script:PaletteKey = $key
        $Renderer.SetPalettes((New-PaletteTable -Rgb $rgb -Levels $LV))
    }
    # one indexed pass instead of two ForEach-Object pipelines, on the poll path
    $fall = [double[]]::new($n); $dens = [double[]]::new($n)
    for ($l = 0; $l -lt $n; $l++) { $fall[$l] = $Lane[$l].Fall; $dens[$l] = $Lane[$l].Dens }
    $Renderer.SetLanes($colLane, $fall, $dens, $col0, $wid, $hdr, $level)

    # Return it, do not park it in a shared variable: the caller routes clicks with it.
    , @($col0, $wid)
}

function Get-LaneAtColumn {
    <#
    .SYNOPSIS
        Which lane owns screen column X. -1 for a gutter, or past the last lane.
    .PARAMETER Bounds
        The col0[]/wid[] pair Set-RendererLanes returns.
    #>
    param([Parameter(Mandatory)] [object[]] $Bounds, [int] $X)
    $col0, $wid = $Bounds
    for ($l = 0; $l -lt $col0.Count; $l++) {
        if ($X -ge $col0[$l] -and $X -lt $col0[$l] + $wid[$l]) { return $l }
    }
    -1
}

function Format-Age {
    param([int64] $EpochMs)
    if ($EpochMs -le 0) { return '' }
    # Floor, not a bare [int] cast: the cast rounds half to even. That showed 90 s
    # as "2m" and 3590 s as the out-of-unit "60m". An age never rounds up.
    $s = [int][Math]::Floor(([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $EpochMs) / 1000)
    if ($s -lt 0)    { return '' }
    if ($s -lt 60)   { return "${s}s" }
    if ($s -lt 3600) { return "$([int][Math]::Floor($s / 60))m" }
    return "$([int][Math]::Floor($s / 3600))h"
}
