# Compiled helpers: console input filtering, the frame simulator/encoder, and
# the terminal window lookup. The C# sources live in cs/ next to this file.
#
# A per-cell render loop in interpreted PowerShell is too slow once every column is
# active, so it lives in C#. All sources compile in ONE Add-Type call: each
# call shells out to the compiler and costs about a second. Add-TaggedTypes
# comes from console.ps1.
#
# The platform brings its own ConsoleVT and its own window lookup; the renderer
# is shared. Windows: the console API and UIA over Windows Terminal. Linux:
# termios/escape input and a raw D-Bus client for Konsole, which has no client
# library worth pulling in. Windows_Stub.cs stands in for the Windows lookup on
# Linux, where nothing calls it.

$csFiles = if ($IsWindows) { 'ConsoleVT.cs', 'Renderer.cs', 'Windows.cs' }
           else            { 'ConsoleVT_Linux.cs', 'Renderer.cs', 'DBus.cs', 'Windows_Stub.cs' }

$typesSource = foreach ($f in $csFiles) {
    $p = Join-Path (Join-Path $PSScriptRoot 'cs') $f
    if (-not [System.IO.File]::Exists($p)) { throw "matrix: cannot load $p" }
    [System.IO.File]::ReadAllText($p)
}

$typeNames = 'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixWin{0}.Windows'
if (-not $IsWindows) { $typeNames += 'MatrixDBus{0}.Bus' }

# $DBusType stays $null on Windows, where nothing calls it.
$VT, $RendererType, $WinFinder, $DBusType = Add-TaggedTypes ($typesSource -join "`n") $typeNames