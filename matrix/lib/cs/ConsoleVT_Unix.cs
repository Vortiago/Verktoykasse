namespace MatrixVT__TAG__
{
    using System;
    using System.Runtime.InteropServices;
    using System.Text;

    // The Unix ConsoleVT: the surface matrix.ps1 already drives, over the termios
    // calls and escape sequences a Unix terminal offers instead of the Windows
    // console API. The script asks the same questions on every platform. The
    // answers here are what a real terminal gives.
    //
    // One file for Linux and macOS, because none of the reading below differs.
    // The escape grammar is the terminal's, and read, write and isatty are the
    // same call. The termios ABI does differ, and that is the whole of
    // Termios_Linux.cs and Termios_Darwin.cs. This file names Termios and Tty
    // and never asks which platform answered.
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
        // The four verdicts, and what each one fills in:
        //   NONE   nothing happened. x, y and key are all unset.
        //   EXIT   the terminal says stop. Ctrl+C only. Nothing else exits here:
        //          which letter quits is a binding, and bindings live in matrix.ps1.
        //   CLICK  a left press. x and y are the cell, zero based.
        //   KEY    a plain keypress. key is the character. A chord is not a key:
        //          Ctrl and Alt combinations read as NONE, so a future binding can
        //          claim a letter without fighting a terminal shortcut.
        public const int NONE = 0;
        public const int EXIT = 1;
        public const int CLICK = 2;
        public const int KEY = 3;

        // Which characters count as a key. Printable ASCII, plus Tab, Enter and
        // Escape. Those three arrive as control bytes, and a user still calls them
        // keys. For anything else, a UTF-8 lead byte included, the reader consumes
        // the byte and reports NONE rather than passing on half a character.
        private static bool IsKeyChar(int c)
        {
            return c == 0x09 || c == 0x0A || c == 0x0D || c == 0x1B
                || (c >= 0x20 && c <= 0x7E);
        }

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

        // read, write and isatty are the same call on every Unix. The termios
        // struct is not: types.ps1 compiles Termios_Linux.cs or
        // Termios_Darwin.cs next to this file.
        [DllImport("libc", SetLastError = true)]
        private static extern int read(int fd, byte[] buf, int count);
        [DllImport("libc", SetLastError = true)]
        private static extern int write(int fd, byte[] buf, int count);
        [DllImport("libc", SetLastError = true)]
        private static extern int isatty(int fd);

        // SGR mouse reporting on and off: mode 1000 reports presses, 1006 the
        // SGR encoding (the coordinates the parser below reads).
        private static readonly byte[] MouseOnSeq  = Encoding.ASCII.GetBytes("\x1b[?1000h\x1b[?1006h");
        private static readonly byte[] MouseOffSeq = Encoding.ASCII.GetBytes("\x1b[?1000l\x1b[?1006l");

        private static Termios savedTermios;
        private static bool rawOn, savedOk, mouseWritten;
        private static byte[] pending = new byte[0];    // a sequence split across reads
        private const int MAX_PENDING = 1024;           // longer than that is not a sequence
        private const byte ESC = 0x1b;
        private const int INCOMPLETE = 0;               // ClassifyAt used no bytes
        // The frame loop runs up to 240 times a second: everything it touches
        // per frame is allocated once, here.
        private static readonly byte[] readBuf = new byte[64];
        private static readonly byte[] noBytes = new byte[0];
        private static readonly Termios probe = Tty.New();
        private static int stdinIsTty = -1;             // cached: fd 0 does not change under us

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
                    // Leaving always restores cooked input, so matrix.ps1's restore
                    // path works even when mouse reporting never ran. The mouse-off
                    // bytes only go out if the mouse-on ones did.
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
            if (Tty.Get(ref t) != 0) return;
            if (!savedOk)
            {
                savedTermios = Tty.Copy(t);               // the state to restore
                savedOk = true;
            }

            // Do not trust that raw is still in effect. .NET's [Console] property
            // setters apply their own cached termios behind our back, and what they
            // put back is VMIN=1 - a read that waits for a byte. A frame loop that
            // polls between frames would then only move when something is typed.
            if (rawOn && Tty.IsRaw(ref t)) return;        // still raw: leave it be

            Tty.MakeRaw(ref t);
            if (Tty.Set(ref t) == 0) rawOn = true;
        }

        private static void LeaveRaw()
        {
            if (!rawOn) return;
            if (savedOk) Tty.Set(ref savedTermios);
            rawOn = false;
        }

        private static void WriteOut(byte[] seq)
        {
            if (isatty(1) != 0) write(1, seq, seq.Length);
        }

        public static int PollInput(out int x, out int y, out int key)
        {
            x = -1; y = -1; key = 0;
            if (!StdinIsTty()) return NONE;               // redirected: -Seconds owns the exit
            EnterRaw();

            int n = read(0, readBuf, readBuf.Length);
            if (n < 0) n = 0;                             // EAGAIN and friends: nothing new
            if (n == 0 && pending.Length == 0) return NONE;

            byte[] all;
            int len = TakeWithStash(n, out all);
            int limit = EndsWithSplitEscape(n, all, len) ? len - 1 : len;

            int off = 0;
            while (off < limit)
            {
                int used, cx, cy, ck;
                int what = ClassifyAt(all, off, limit - off, out cx, out cy, out ck, out used);
                if (used == INCOMPLETE) break;
                off += used;
                // Stash before answering. Dropping the bytes after a press resumes
                // the next read inside the release, whose parameter bytes are
                // printable, and a printable byte is a key.
                if (what != NONE) { x = cx; y = cy; key = ck; Stash(all, off, len); return what; }
            }
            Stash(all, off, len);
            return NONE;
        }

        // The bytes to classify this frame: what was read, what was stashed, or both
        // joined in order. An idle read still has the stash to work. Leaving it there
        // strands a second click or a held ESC until a later byte arrives, and none
        // need ever arrive.
        private static int TakeWithStash(int n, out byte[] all)
        {
            if (n == 0)
            {
                all = pending;
                pending = noBytes;
                return all.Length;
            }
            if (pending.Length == 0)
            {
                all = readBuf;                            // read in place
                return n;
            }
            all = new byte[pending.Length + n];
            Array.Copy(pending, all, pending.Length);
            Array.Copy(readBuf, 0, all, pending.Length, n);
            pending = noBytes;
            return all.Length;
        }

        // A full buffer means more was queued than fit, so a trailing ESC is the head
        // of a sequence split across reads. Read as a key it exits the rain on a
        // click, because a click burst is 18 bytes and the split lands inside it. An
        // idle read settles it the other way: nothing followed, so the ESC was the key.
        private static bool EndsWithSplitEscape(int n, byte[] b, int len)
        {
            return n == readBuf.Length && b[len - 1] == ESC;
        }

        // Keep the tail for the next read. Anything longer than the longest escape
        // sequence a terminal sends is not one. Drop it, or a stream that never
        // terminates grows the stash without bound.
        private static void Stash(byte[] all, int off, int len)
        {
            int keep = len - off;
            if (keep <= 0 || keep > MAX_PENDING) return;
            if (IsWholeOwnedArray(all, off, len)) { pending = all; return; }
            pending = new byte[keep];
            Array.Copy(all, off, pending, 0, keep);
        }

        // The whole array, and ours to keep. readBuf is neither: the next read
        // overwrites it. Saves one allocation a frame while an unfinished sequence
        // sits in the stash.
        private static bool IsWholeOwnedArray(byte[] all, int off, int len)
        {
            return off == 0 && all.Length == len && !ReferenceEquals(all, readBuf);
        }

        // Classifies the event at the start of the buffer. The escape sequence
        // grammar: plain bytes are keys, Ctrl+C is an exit, everything a terminal
        // sends as CSI or SS3 is scrolling or mouse reporting.
        public static int Classify(byte[] buf, int len, out int x, out int y, out int key, out int used)
        {
            return ClassifyAt(buf, 0, len, out x, out y, out key, out used);
        }

        private static int ClassifyAt(byte[] b, int off, int len, out int x, out int y, out int key, out int used)
        {
            x = -1; y = -1; key = 0; used = 0;
            if (len <= 0) return NONE;
            byte c = b[off];
            if (c == ESC) return ClassifyEscape(b, off, len, out x, out y, out key, out used);
            if (c == 0x03) { used = 1; return EXIT; }     // Ctrl+C, with ISIG off
            used = 1;
            // Every other control byte is a Ctrl chord, and every byte at or above
            // 0x7F is part of a character this reader does not assemble.
            if (!IsKeyChar(c)) return NONE;
            key = c; return KEY;
        }

        private static int ClassifyEscape(byte[] b, int off, int len, out int x, out int y, out int key, out int used)
        {
            x = -1; y = -1; key = 0; used = 0;
            if (len < 2) { used = 1; key = ESC; return KEY; }   // a lone ESC is the key itself
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

            // ESC and a printable: Alt+key. Konsole sends Alt+q as ESC q. A chord
            // belongs to the terminal, so it is consumed and reported as nothing.
            // Alt+q must not quit a rain that quits on q.
            used = 2; return NONE;
        }
    }
}
