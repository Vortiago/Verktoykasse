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
# library worth pulling in. The Windows type keeps a stub on Linux so the
# dot-sourced tabs.ps1 still parses; nothing calls it there.

$csFiles = if ($IsWindows) { 'ConsoleVT.cs', 'Renderer.cs', 'Windows.cs' }
           else            { 'ConsoleVT_Linux.cs', 'Renderer.cs', 'DBus.cs' }

$typesSource = foreach ($f in $csFiles) {
    $p = Join-Path (Join-Path $PSScriptRoot 'cs') $f
    if (-not [System.IO.File]::Exists($p)) { throw "matrix: cannot load $p" }
    [System.IO.File]::ReadAllText($p)
}

if (-not $IsWindows) {
    # tabs.ps1's Windows functions reference $WinFinder at CALL time and are never
    # reached on Linux, but the variable must still exist for the ones matrix.ps1
    # touches directly.
    $typesSource += @'
namespace MatrixWin__TAG__
{
    public static class Windows
    {
        public static long Foreground() { return 0; }
        public static long[] Terminals() { return new long[0]; }
        public static bool Activate(long hwnd) { return false; }
    }
}
'@
}

if ($IsWindows) {
    $VT, $RendererType, $WinFinder = Add-TaggedTypes ($typesSource -join "`n") `
                            'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixWin{0}.Windows'
} else {
    $VT, $RendererType, $WinFinder, $DBusType = Add-TaggedTypes ($typesSource -join "`n") `
                            'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixWin{0}.Windows', 'MatrixDBus{0}.Bus'
}