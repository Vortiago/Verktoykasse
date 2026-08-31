namespace MatrixVT__TAG__
{
    using System;
    using System.Runtime.InteropServices;
    using System.Text;

    // The Linux ConsoleVT: the surface matrix.ps1 already drives, over the ioctls
    // and escape sequences a Unix terminal offers instead of the Windows console
    // API. The script asks the same questions on both platforms; the answers here
    // are what a real terminal gives.
    //
    //   GetConsoleMode / SetConsoleMode - escape processing is a Windows console
    //     flag. A terminal that runs pwsh has already enabled it, so mode reads
    //     report the bit on and mode writes succeed as no-ops.
    //   timeBeginPeriod / timeEndPeriod - Windows timer resolution. Linux sleeps
    //     take the nanosecond clock, so these return the success the script expects.
    //   GetStdinMode / SetStdinMode - raw termios on file descriptor 0. The only
    //     bit the script sets is MOUSE_ON, for -Click, which turns on SGR mouse
    //     reporting as well.
    public static class ConsoleVT
    {
        public const int NONE = 0;
        public const int EXIT = 1;
        public const int CLICK = 2;

        // The stdin mode word, Windows-shaped. QUICK_EDIT has no Linux work, so
        // the script's attempt to clear it changes nothing here.
        public const uint MOUSE_ON = 0x0010 | 0x0080;
        public const uint QUICK_EDIT = 0x0040;

        private const uint ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004;

        public static IntPtr GetStdHandle(int nStdHandle) { return new IntPtr(-1); }

        public static bool GetConsoleMode(IntPtr handle, out uint mode)
        {
            mode = ENABLE_VIRTUAL_TERMINAL_PROCESSING;
            return true;
        }

        public static bool SetConsoleMode(IntPtr handle, uint mode) { return true; }

        public static uint timeBeginPeriod(uint period) { return 0; }   // TIMERR_NOERROR
        public static uint timeEndPeriod(uint period) { return 0; }

        // --- stdin: termios and mouse reporting -----------------------------------

        [DllImport("libc", SetLastError = true)]
        private static extern int tcgetattr(int fd, ref Termios t);
        [DllImport("libc", SetLastError = true)]
        private static extern int tcsetattr(int fd, int action, ref Termios t);
        [DllImport("libc", SetLastError = true)]
        private static extern int read(int fd, byte[] buf, int count);
        [DllImport("libc", SetLastError = true)]
        private static extern int write(int fd, byte[] buf, int count);
        [DllImport("libc", SetLastError = true)]
        private static extern int isatty(int fd);

        [StructLayout(LayoutKind.Sequential)]
        private struct Termios
        {
            public uint c_iflag, c_oflag, c_cflag, c_lflag;
            public byte c_line;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)] public byte[] c_cc;
            public uint c_ispeed, c_ospeed;
        }

        private const uint ICANON = 0x0002;
        private const uint ECHO = 0x0008;
        private const uint ISIG = 0x0001;
        private const int VTIME = 5, VMIN = 6;

        // SGR mouse reporting on and off: mode 1000 reports presses, 1006 the
        // SGR encoding (the coordinates the parser below reads).
        private static readonly byte[] MouseOnSeq  = Encoding.ASCII.GetBytes("\x1b[?1000h\x1b[?1006h");
        private static readonly byte[] MouseOffSeq = Encoding.ASCII.GetBytes("\x1b[?1000l\x1b[?1006l");

        private static Termios savedTermios;
        private static bool rawOn, savedOk, mouseWritten;
        private static byte[] pending = new byte[0];    // a sequence split across reads
        private const int MAX_PENDING = 1024;           // longer than that is not a sequence
        // The frame loop runs up to 240 times a second: everything it touches
        // per frame is allocated once, here.
        private static readonly byte[] readBuf = new byte[64];
        private static readonly byte[] noBytes = new byte[0];
        private static readonly Termios probe = NewTermios();
        private static int stdinIsTty = -1;             // cached: fd 0 does not change under us

        static Termios NewTermios()
        {
            Termios t = new Termios();
            t.c_cc = new byte[32];
            return t;
        }

        static bool StdinIsTty()
        {
            if (stdinIsTty < 0) stdinIsTty = isatty(0);
            return stdinIsTty != 0;
        }

        public static uint GetStdinMode()
        {
            // The script snapshots this before turning on mouse reporting and
            // restores it on the way out. Zero is "cooked, nothing extra on".
            return 0;
        }

        public static bool SetStdinMode(uint mode)
        {
            try
            {
                if ((mode & MOUSE_ON) != 0)
                {
                    EnterRaw();
                    WriteOut(MouseOnSeq);
                    mouseWritten = true;
                }
                else
                {
                    // Leaving the mode always restores cooked input, so the restore
                    // path in matrix.ps1 works even when mouse reporting never ran.
                    // The mouse-off bytes only go out if the mouse-on ones did: a
                    // run without -Click never switched reporting on.
                    if (mouseWritten) { WriteOut(MouseOffSeq); mouseWritten = false; }
                    LeaveRaw();
                }
                return true;
            }
            catch { return false; }
        }

        private static void EnterRaw()
        {
            if (!StdinIsTty()) return;
            Termios t = probe;                            // the one scratch, reused per frame
            if (tcgetattr(0, ref t) != 0) return;
            if (!savedOk)
            {
                savedTermios = t;                         // the state to restore: flags copy,
                savedTermios.c_cc = (byte[])t.c_cc.Clone();   // the array must not, or the
                savedOk = true;                            // raw write below would cook the save
            }

            // Do not trust that raw is still in effect from last time. Others with
            // an interest in stdin rewrite it behind our back: .NET's [Console]
            // property setters apply their own cached termios, and what they put
            // back is VMIN=1 - a read that waits for a byte. A frame loop that
            // polls between frames then only moves when something is typed.
            if (rawOn && (t.c_lflag & (ICANON | ECHO | ISIG)) == 0 && t.c_cc[VMIN] == 0)
                return;                                  // still raw: leave it be

            t.c_lflag &= ~(ICANON | ECHO | ISIG);        // byte at a time, unechoed, no signals
            t.c_cc[VMIN] = 0;                             // and a read that returns at once
            t.c_cc[VTIME] = 0;
            if (tcsetattr(0, 0, ref t) == 0) rawOn = true;   // 0: TCSANOW
        }

        private static void LeaveRaw()
        {
            if (!rawOn) return;
            if (savedOk) tcsetattr(0, 0, ref savedTermios);
            rawOn = false;
        }

        private static void WriteOut(byte[] seq)
        {
            if (isatty(1) != 0) write(1, seq, seq.Length);
        }

        public static int PollInput(out int x, out int y)
        {
            x = -1; y = -1;
            if (!StdinIsTty()) return NONE;               // redirected: -Seconds owns the exit
            EnterRaw();

            int n = read(0, readBuf, readBuf.Length);
            if (n <= 0) return NONE;

            byte[] all;
            int len;
            if (pending.Length == 0)
            {
                all = readBuf;                            // nothing stashed: read in place
                len = n;
            }
            else
            {
                len = pending.Length + n;                 // finish a split sequence first
                all = new byte[len];
                Array.Copy(pending, all, pending.Length);
                Array.Copy(readBuf, 0, all, pending.Length, n);
                pending = noBytes;
            }

            // A read that filled the buffer means the terminal had more queued than
            // fit, so an ESC on the very end is the head of a sequence split across
            // reads, not the key itself. A click burst is nine bytes of press and
            // nine of release: enough of them queued behind a slow frame and the
            // split lands there, and a lone trailing ESC would exit the rain on a
            // click. Hold it back for the next read instead.
            int limit = (n == readBuf.Length && all[len - 1] == 0x1b) ? len - 1 : len;

            int off = 0;
            while (off < limit)
            {
                int used, cx, cy;
                int what = ClassifyAt(all, off, limit - off, out cx, out cy, out used);
                // used == 0 is a sequence the terminal has not finished sending.
                if (used == 0) break;
                off += used;
                // Stash before answering, not only on the way out with nothing to
                // report. A click burst is nine bytes of press and nine of release:
                // returning the press and dropping what followed resumes the next
                // read INSIDE the release, whose leftover parameter bytes (";3M")
                // are printable - and a printable byte is an exit. Clicking twice
                // in one frame would end the rain.
                if (what != NONE) { x = cx; y = cy; Stash(all, off, len); return what; }
            }
            Stash(all, off, len);
            return NONE;
        }

        // Keep the tail for the next read; nothing before it can matter more than it
        // does. The bytes are copied out because `all` may be readBuf itself, which
        // the next frame overwrites. Anything longer than the longest escape sequence
        // a terminal sends is not one: drop it rather than let a stream that never
        // terminates grow the stash without bound. `pending` is empty on every path
        // that reaches here, so dropping is simply not filling it.
        private static void Stash(byte[] all, int off, int len)
        {
            int keep = len - off;
            if (keep <= 0 || keep > MAX_PENDING) return;
            pending = new byte[keep];
            Array.Copy(all, off, pending, 0, keep);
        }

        // Classifies the event at the start of the buffer. The escape sequence
        // grammar: plain bytes are keys (an exit), Ctrl+C is an exit, everything a
        // terminal sends as CSI or SS3 is scrolling or mouse reporting.
        public static int Classify(byte[] buf, int len, out int x, out int y, out int used)
        {
            return ClassifyAt(buf, 0, len, out x, out y, out used);
        }

        private static int ClassifyAt(byte[] b, int off, int len, out int x, out int y, out int used)
        {
            x = -1; y = -1; used = 0;
            if (len <= 0) return NONE;
            byte c = b[off];
            if (c == 0x1b) return ClassifyEscape(b, off, len, out x, out y, out used);
            if (c == 0x03) { used = 1; return EXIT; }     // Ctrl+C, with ISIG off
            if (c < 0x20) { used = 1; return NONE; }      // the other control bytes
            used = 1; return EXIT;                         // a printable key
        }

        private static int ClassifyEscape(byte[] b, int off, int len, out int x, out int y, out int used)
        {
            x = -1; y = -1; used = 0;
            if (len < 2) { used = 1; return EXIT; }       // a lone ESC is the key itself
            // A terminal writes a whole escape sequence in one go, so an ESC with
            // nothing after it in the buffer is a keypress, not the start of
            // something longer.

            if (b[off + 1] == (byte)'[')
            {
                // CSI: parameters up to a final byte in 0x40..0x7E.
                int i = off + 2;
                while (i < off + len && (b[i] < 0x40 || b[i] > 0x7E)) i++;
                if (i >= off + len) return NONE;          // no final byte yet: wait
                used = i - off + 1;

                // SGR mouse: ESC [ < button ; column ; row, then M (press) or m
                // (release). Only a plain left press is a click; the wheel and
                // drags are terminal business, and releases pair with presses.
                if (i - off >= 6 && b[off + 2] == (byte)'<' && (b[i] == (byte)'M' || b[i] == (byte)'m'))
                {
                    string[] parts = Encoding.ASCII.GetString(b, off + 3, i - off - 3).Split(';');
                    int btn, col, row;
                    if (parts.Length == 3
                        && int.TryParse(parts[0], out btn) && int.TryParse(parts[1], out col)
                        && int.TryParse(parts[2], out row) && col > 0 && row > 0)
                    {
                        if (b[i] == (byte)'M' && btn == 0)
                        {
                            x = col - 1; y = row - 1;     // the cell, zero based
                            return CLICK;
                        }
                    }
                }
                return NONE;                               // cursor keys, wheel, whatever else
            }

            if (b[off + 1] == (byte)'O')
            {
                if (len < 3) return NONE;                  // SS3, cut short: wait
                used = 3; return NONE;                      // SS3 cursor key
            }

            // ESC and a printable: Alt+key. Konsole sends Alt+q as ESC q.
            used = 2; return EXIT;
        }
    }
}
