// The Windows terminal-window lookup, stubbed for the Linux build. tabs.ps1's
// Windows functions reference the type by name and are never reached on Linux;
// nothing here is ever called. The stub exists so the one compile call can
// always hand back the same three variables.
namespace MatrixWin__TAG__
{
    public static class Windows
    {
        public static long Foreground() { return 0; }
        public static long[] Terminals() { return new long[0]; }
        public static bool Activate(long hwnd) { return false; }
    }
}
