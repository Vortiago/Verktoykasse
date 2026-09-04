namespace MatrixVT__TAG__
{
    using System;
    using System.Runtime.InteropServices;

    // The Darwin termios ABI, the twin of Termios_Linux.cs. Same four questions,
    // different answers, and not one of them is cosmetic:
    //
    //   tcflag_t is unsigned long, so the flag words are 8 bytes here and 4 on
    //     Linux. NCCS is 20, not 32, and there is no c_line. The struct is 72
    //     bytes; the Linux one is 60. Handing a 60-byte buffer to a tcgetattr
    //     that writes 72 corrupts the 12 bytes after it.
    //   ICANON is 0x100 and ISIG is 0x80. The Linux mask, 0x000B, clears ECHO
    //     and two echo bits here and leaves ICANON set, so read would block
    //     until Enter and the frame loop would only move when something was
    //     typed.
    //   VMIN and VTIME are at 16 and 17, not 6 and 5.
    //
    // Verified against sys/termios.h in the macOS SDK, not inferred.
    [StructLayout(LayoutKind.Sequential)]
    internal struct Termios
    {
        public ulong c_iflag, c_oflag, c_cflag, c_lflag;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = Tty.NCCS)] public byte[] c_cc;
        public ulong c_ispeed, c_ospeed;
    }

    internal static class Tty
    {
        internal const int NCCS = 20;

        private const ulong ICANON = 0x00000100;
        private const ulong ECHO   = 0x00000008;
        private const ulong ISIG   = 0x00000080;
        private const int VMIN = 16, VTIME = 17;
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
