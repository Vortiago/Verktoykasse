namespace MatrixVT__TAG__
{
    using System;
    using System.Runtime.InteropServices;

    // The Linux termios ABI, and the only file that carries it.
    //
    // ConsoleVT_Unix.cs holds the reader: the same POSIX code on every Unix. This
    // holds the part that is not portable, and its Darwin twin holds the other
    // answer to the same four questions - the struct layout, the local flag
    // values, the c_cc indices, and the two calls that take the struct by
    // reference. Both files name the type Termios and the helper Tty, so the
    // reader names neither platform.
    //
    // struct termios on Linux: four 32-bit flag words, a c_line byte, NCCS of 32
    // control characters, then two speeds. tcgetattr writes 60 bytes.
    [StructLayout(LayoutKind.Sequential)]
    internal struct Termios
    {
        public uint c_iflag, c_oflag, c_cflag, c_lflag;
        public byte c_line;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = Tty.NCCS)] public byte[] c_cc;
        public uint c_ispeed, c_ospeed;
    }

    internal static class Tty
    {
        internal const int NCCS = 32;

        private const uint ICANON = 0x0002;
        private const uint ECHO   = 0x0008;
        private const uint ISIG   = 0x0001;
        private const int VTIME = 5, VMIN = 6;
        private const int TCSANOW = 0;

        [DllImport("libc", SetLastError = true)]
        private static extern int tcgetattr(int fd, ref Termios t);
        [DllImport("libc", SetLastError = true)]
        private static extern int tcsetattr(int fd, int action, ref Termios t);

        internal static Termios New()
        {
            Termios t = new Termios();
            t.c_cc = new byte[NCCS];
            return t;
        }

        // The state to restore. The flags copy with the struct; the array must
        // not, or the raw write would cook the save.
        internal static Termios Copy(Termios t)
        {
            Termios c = t;
            c.c_cc = (byte[])t.c_cc.Clone();
            return c;
        }

        internal static int Get(ref Termios t) { return tcgetattr(0, ref t); }
        internal static int Set(ref Termios t) { return tcsetattr(0, TCSANOW, ref t); }

        // Raw already, byte for byte as MakeRaw leaves it. Read rather than
        // assumed: see the caller.
        internal static bool IsRaw(ref Termios t)
        {
            return (t.c_lflag & (ICANON | ECHO | ISIG)) == 0 && t.c_cc[VMIN] == 0;
        }

        // Byte at a time, unechoed, no signals, and a read that returns at once.
        internal static void MakeRaw(ref Termios t)
        {
            t.c_lflag &= ~(ICANON | ECHO | ISIG);
            t.c_cc[VMIN] = 0;
            t.c_cc[VTIME] = 0;
        }
    }
}
