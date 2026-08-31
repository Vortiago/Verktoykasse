# Compiled helpers: console input filtering, the frame simulator/encoder, and
# the terminal window lookup. The C# sources live in cs/ next to this file.
#
# A per-cell render loop in interpreted PowerShell is too slow once every column is
# active, so it lives in C#. All sources compile in ONE Add-Type call: each
# call shells out to the compiler and costs about a second. Add-TaggedTypes
# comes from console.ps1.
#
# The platform brings its own ConsoleVT and its own terminal lookup; the renderer
# is shared. Windows: the console API and UIA over Windows Terminal. Linux:
# termios/escape input and a raw D-Bus client for Konsole, which has no client
# library worth pulling in. Each platform names only the types it has, and binds
# only the variables it uses.
#
# A _Windows or _Linux suffix in cs/ means the platform picks one of them; a file
# without a suffix is shared by both. A third platform adds its own pair and one
# more branch here.

if ($IsWindows) {
    $csFiles   = 'ConsoleVT_Windows.cs', 'Renderer.cs', 'Windows.cs'
    $typeNames = 'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixWin{0}.Windows'
} else {
    $csFiles   = 'ConsoleVT_Linux.cs', 'Renderer.cs', 'DBus.cs', 'DBusEncode.cs', 'DBusDecode.cs'
    $typeNames = 'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixDBus{0}.Bus'
}

$typesSource = foreach ($f in $csFiles) {
    $p = Join-Path (Join-Path $PSScriptRoot 'cs') $f
    if (-not [System.IO.File]::Exists($p)) { throw "matrix: cannot load $p" }
    [System.IO.File]::ReadAllText($p)
}

$types = Add-TaggedTypes ($typesSource -join "`n") $typeNames
if ($IsWindows) { $VT, $RendererType, $WinFinder = $types }
else            { $VT, $RendererType, $DBusType  = $types }
