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
# library worth pulling in. macOS: the same termios input, and no D-Bus at all,
# because there is no Konsole to ask. Each platform names only the types it has,
# and binds only the variables it uses.
#
# A suffix in cs/ means the platform picks one of them; a file without a suffix is
# shared. _Windows and _Unix split the console reader, and _Linux and _Darwin split
# the termios ABI under it - Unix is one reader over two ABIs, because the escape
# grammar is the terminal's and only the struct differs.

if ($IsWindows) {
    $csFiles   = 'ConsoleVT_Windows.cs', 'Renderer.cs', 'Windows.cs'
    $typeNames = 'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixWin{0}.Windows'
} elseif ($IsMacOS) {
    $csFiles   = 'ConsoleVT_Unix.cs', 'Termios_Darwin.cs', 'Renderer.cs'
    $typeNames = 'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer'
} else {
    $csFiles   = 'ConsoleVT_Unix.cs', 'Termios_Linux.cs', 'Renderer.cs',
                 'DBus.cs', 'DBusEncode.cs', 'DBusDecode.cs'
    $typeNames = 'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixDBus{0}.Bus'
}

$typesSource = foreach ($f in $csFiles) {
    $p = Join-Path (Join-Path $PSScriptRoot 'cs') $f
    if (-not [System.IO.File]::Exists($p)) { throw "matrix: cannot load $p" }
    [System.IO.File]::ReadAllText($p)
}

$types = Add-TaggedTypes ($typesSource -join "`n") $typeNames
if ($IsWindows)     { $VT, $RendererType, $WinFinder = $types }
elseif ($IsMacOS)   { $VT, $RendererType            = $types }
else                { $VT, $RendererType, $DBusType = $types }
