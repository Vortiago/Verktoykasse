# Compiled helpers: console input filtering, the frame simulator/encoder, and
# Windows Terminal window lookup. The C# sources live in cs/ next to this file.
#
# A per-cell render loop in interpreted PowerShell is too slow once every column is
# active, so it lives in C#. All three sources compile in ONE Add-Type call: each
# call shells out to csc.exe and costs about a second. Add-TaggedTypes comes from
# console.ps1.

$typesSource = foreach ($f in 'ConsoleVT.cs', 'Renderer.cs', 'Windows.cs') {
    $p = Join-Path (Join-Path $PSScriptRoot 'cs') $f
    if (-not [System.IO.File]::Exists($p)) { throw "matrix: cannot load $p" }
    [System.IO.File]::ReadAllText($p)
}

$VT, $RendererType, $WinFinder = Add-TaggedTypes ($typesSource -join "`n") `
                        'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixWin{0}.Windows'
