# Compiled helpers: console input filtering, the frame simulator/encoder, and
# Windows Terminal window lookup.
#
# A per-cell render loop in interpreted PowerShell is too slow once every column is
# active, so it lives in C#. All three sources compile in ONE Add-Type call: each
# call shells out to csc.exe and costs about a second. Add-TaggedTypes comes from
# console.ps1.

$vtSource = @'
namespace MatrixVT__TAG__
{
    using System;
    using System.Runtime.InteropServices;

    public static class ConsoleVT
    {
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr GetStdHandle(int nStdHandle);
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool GetConsoleMode(IntPtr handle, out uint mode);
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool SetConsoleMode(IntPtr handle, uint mode);
        [DllImport("winmm.dll")]
        public static extern uint timeBeginPeriod(uint period);
        [DllImport("winmm.dll")]
        public static extern uint timeEndPeriod(uint period);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern bool PeekConsoleInput(IntPtr handle, out InputRecord rec, uint count, out uint read);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern bool ReadConsoleInput(IntPtr handle, out InputRecord rec, uint count, out uint read);

        const int KEY_EVENT = 1;
        const uint ALT_HELD = 0x0003;    // left or right Alt
        const uint CTRL_HELD = 0x000C;   // left or right Ctrl
        const uint SHIFT_HELD = 0x0010;
        const int VK_C = 0x43;

        static bool IsModifierKey(int vk)
        {
            return vk == 0x10 || vk == 0x11 || vk == 0x12       // Shift, Ctrl, Alt
                || vk == 0x14 || vk == 0x90 || vk == 0x91       // CapsLock, NumLock, ScrollLock
                || vk == 0x5B || vk == 0x5C || vk == 0x5D;      // Win, Win, Menu
        }

        // In the alternate screen buffer the mouse wheel arrives as arrow or page
        // keys. These must not count as "any key".
        static bool IsScrollKey(int vk)
        {
            return vk == 0x21 || vk == 0x22                     // PageUp, PageDown
                || vk == 0x25 || vk == 0x26 || vk == 0x27 || vk == 0x28;   // arrows
        }

        public const int NONE = 0, EXIT = 1, CLICK = 2;

        const int MOUSE_EVENT = 2;
        const uint LEFT_BUTTON = 0x0001;
        const uint MOUSE_MOVED = 0x0001;
        const uint MOUSE_WHEELED = 0x0004;

        // Enable mouse reporting and disable QuickEdit: QuickEdit eats the click to
        // start a selection instead of reporting it. Set ENABLE_EXTENDED_FLAGS in the
        // same call or QuickEdit is left alone.
        public const uint MOUSE_ON = 0x0010 | 0x0080;      // ENABLE_MOUSE_INPUT | EXTENDED_FLAGS
        public const uint QUICK_EDIT = 0x0040;

        public static uint GetStdinMode()
        {
            uint mode;
            if (!GetConsoleMode(GetStdHandle(-10), out mode)) return 0;
            return mode;
        }

        public static bool SetStdinMode(uint mode)
        {
            return SetConsoleMode(GetStdHandle(-10), mode);
        }

        // Classify one input event. Ignore terminal-owned input: Ctrl+wheel zoom,
        // focus and resize events, bare modifiers, Ctrl/Alt chords. Ctrl+C still
        // quits. A click must NOT exit: the rain must survive the tab switch.
        static int Classify(int type, int keyDown, int vk, uint ctrlKeys,
                            uint buttons, uint flags)
        {
            if (type == MOUSE_EVENT)
            {
                bool press = (flags & (MOUSE_MOVED | MOUSE_WHEELED)) == 0
                             && (buttons & LEFT_BUTTON) != 0;
                return press ? CLICK : NONE;
            }
            if (type != KEY_EVENT || keyDown == 0) return NONE;

            bool ctrl = (ctrlKeys & CTRL_HELD) != 0;
            bool alt = (ctrlKeys & ALT_HELD) != 0;
            bool shift = (ctrlKeys & SHIFT_HELD) != 0;
            if (ctrl && !shift && vk == VK_C) return EXIT;   // Ctrl+C, not Ctrl+Shift+C
            if (ctrl || alt || IsModifierKey(vk) || IsScrollKey(vk)) return NONE;
            return EXIT;
        }

        // Returns EXIT for a genuine "any key" press, CLICK for a left mouse press
        // (x, y are the clicked cell), NONE otherwise.
        public static int PollInput(out int x, out int y)
        {
            x = -1; y = -1;
            IntPtr h = GetStdHandle(-10);
            InputRecord rec;
            uint n;
            while (PeekConsoleInput(h, out rec, 1, out n) && n > 0)
            {
                int what = Classify(rec.EventType, rec.KeyDown, rec.VirtualKeyCode,
                                    rec.ControlKeyState, rec.ButtonState, rec.EventFlags);
                if (what == CLICK) { x = rec.MouseX; y = rec.MouseY; }

                ReadConsoleInput(h, out rec, 1, out n);   // consume it either way
                if (what != NONE) return what;
            }
            return NONE;                                   // also the redirected case
        }
    }

    // INPUT_RECORD, flattened onto its KEY_EVENT arm. The union is fixed-size, so
    // the MOUSE_EVENT arm reads back out of the same 20 bytes:
    //
    //   offset  4  COORD dwMousePosition   X low half, Y high half of KeyDown
    //   offset  8  DWORD dwButtonState     RepeatCount low half, VirtualKeyCode high
    //   offset 16  DWORD dwEventFlags      ControlKeyState
    [StructLayout(LayoutKind.Sequential)]
    public struct InputRecord
    {
        public ushort EventType;
        public ushort Padding;
        public int KeyDown;
        public ushort RepeatCount;
        public ushort VirtualKeyCode;
        public ushort VirtualScanCode;
        public ushort Char;
        public uint ControlKeyState;

        public short MouseX { get { return (short)(KeyDown & 0xFFFF); } }
        public short MouseY { get { return (short)((KeyDown >> 16) & 0xFFFF); } }
        public uint ButtonState { get { return ((uint)VirtualKeyCode << 16) | RepeatCount; } }
        public uint EventFlags { get { return ControlKeyState; } }
    }
}
'@

$rendererSource = @'
namespace MatrixRain__TAG__
{
    using System;
    using System.IO;

    // One frame = Advance() (simulate) + Encode() (write the diff as escape codes).
    //
    // Cell state is one packed int: the diff is one compare per cell. Output is
    // hand-encoded UTF-8 into a reused byte[] sized for a whole frame, handed to
    // the stream in ONE write.
    //
    // The screen splits into LANES, one vertical band per Claude session. A lane owns
    // its palette, fall speed, spawn density and header lines. A working session
    // rains fast and green; one awaiting an answer crawls and is red. A column with
    // lane -1 is a gutter and never rains.
    //
    // Colour index = lane*STRIDE + level. Level 0..lv is the trail ramp, lv+1 the
    // head, lv+2 the stats overlay. STRIDE is lv+3, so palette p starts at p*STRIDE.
    // Rates are per second and scaled by dt: frame rate changes smoothness, never speed.
    public sealed class Renderer
    {
        const byte ESC = 0x1b;
        const int BLANK = 0;                     // level -1, glyph ' '
        const int MIN_TRAIL = 4;

        readonly int lv, stride;
        readonly char[] glyphs;
        readonly Random rnd;

        byte[][] fgb;                            // colour index -> SGR escape, as ASCII
        int w, h, spread;
        int[] cur, prev;                         // packed (index+1)<<16 | glyph
        double[] head, speed;                    // per column: row, rows/sec
        int[] len, colPal;                       // per column: trail length, palette base
        int[][] levelFor;                        // trail length -> level per row
        byte[][] dec;                            // small ints -> decimal digits
        byte[] buf;
        int pos, flushAt;

        int laneCount;
        int[] colLane;
        int[] laneCol0, laneWid, lenHdr;
        double[] laneSpeed, laneDensity;
        string[] header;                         // header[lane*headerLevel.Length + row]
        int[] headerLevel;                       // row -> level within the lane's palette
        int hdrRowsPainted;                      // high-water mark, for the dirty clear
        bool labelsDirty, paletteDirty;

        string overlay;
        int overlayLen;

        public int LastBytes { get; private set; }
        public int LastWrites { get; private set; }

        public Renderer(int levels, char[] glyphPool, int seed)
        {
            lv = levels;
            stride = levels + 3;
            glyphs = glyphPool;
            rnd = new Random(seed);
        }

        // Flat table of paletteCount*stride escapes. Rebuilt when the session set or
        // a status changes.
        //
        // A status change keeps each cell's colour INDEX; only its resolution moves.
        // The diff compares packed cells, so an unchanged glyph would keep the old
        // colour on screen (visible on the header, the same text every frame).
        // Force a repaint of everything currently drawn.
        public void SetPalettes(string[] fgTable)
        {
            byte[][] t = new byte[fgTable.Length][];
            for (int i = 0; i < fgTable.Length; i++)
                t[i] = System.Text.Encoding.ASCII.GetBytes(fgTable[i] == null ? "" : fgTable[i]);
            fgb = t;
            paletteDirty = true;
        }

        public void SetOverlay(string line) { overlay = line; }

        static int Pack(int index, int glyph) { return ((index + 1) << 16) | glyph; }

        public void Resize(int width, int height)
        {
            w = width; h = height;
            cur = new int[w * h];
            prev = new int[w * h];                // all BLANK, which matches the ESC[2J
            head = new double[w]; speed = new double[w];
            len = new int[w]; colPal = new int[w];
            colLane = new int[w];
            for (int x = 0; x < w; x++) { head[x] = double.NaN; colPal[x] = -1; }
            overlayLen = 0;

            // Brightness per trail length: Advance() needs no division per cell.
            // A spawn picks MIN_TRAIL + rnd.Next(0, spread). The table must cover
            // every length that expression can produce.
            spread = (int)(h * 0.6) + 4;
            int maxTrail = MIN_TRAIL + spread - 1;
            levelFor = new int[maxTrail + 1][];
            for (int t = 1; t <= maxTrail; t++)
            {
                levelFor[t] = new int[t];
                for (int k = 0; k < t; k++)
                    levelFor[t][k] = (int)(1 + (lv - 1) * (1 - (double)k / t));
            }

            dec = new byte[Math.Max(w, h) + 3][];
            for (int i = 0; i < dec.Length; i++)
                dec[i] = System.Text.Encoding.ASCII.GetBytes(i.ToString());

            // Worst case: move + colour + glyph per cell. Sizing for a whole frame
            // keeps every frame to a single stream write.
            long want = (long)w * h * 40 + 4096;
            if (want < (1 << 16)) want = 1 << 16;
            if (want > (16 << 20)) want = 16 << 20;
            buf = new byte[(int)want];
            flushAt = buf.Length - 64;
        }

        // Lane definitions. lane[x] is the lane owning column x, or -1 for a gutter.
        // Safe to call every poll: a column is disturbed only when its lane or
        // palette changed.
        // hdr holds hdrLevel.Length lines per lane, in lane order. hdrLevel gives
        // each row its brightness within the lane's own palette. The caller decides
        // how many header rows a lane this wide can carry.
        public void SetLanes(int[] lane, double[] fall, double[] dens,
                             int[] col0, int[] wid, string[] hdr, int[] hdrLevel)
        {
            int n = wid.Length;
            int rows = hdrLevel == null ? 0 : hdrLevel.Length;
            // Check laneCount too: n*rows can hold across a geometry flip (5 lanes x
            // 1 row -> 1 lane x 5 rows), leaving lenHdr with old-layout lengths.
            if (lenHdr == null || lenHdr.Length != n * rows || laneCount != n)
            {
                lenHdr = new int[n * rows];
                labelsDirty = true;                       // header rows must be cleared first
            }
            else if (laneCol0 != null && laneCol0.Length == n)
            {
                for (int L = 0; L < n; L++)
                    if (laneCol0[L] != col0[L] || laneWid[L] != wid[L]) { labelsDirty = true; break; }
            }
            laneCount = n; laneSpeed = fall; laneDensity = dens;
            laneCol0 = col0; laneWid = wid; header = hdr; headerLevel = hdrLevel;

            if (colLane == null || cur == null) return;
            for (int x = 0; x < w && x < lane.Length; x++)
            {
                int L = lane[x];
                bool moved = colLane[x] != L;
                colLane[x] = L;
                int want = L < 0 ? -1 : L * stride;

                // A column that changed lane restarts; an unmoved column keeps falling.
                // SetPalettes recolours unmoved columns. colPal is a pure function of
                // the lane index, so a changed palette base always means `moved`: the
                // old repack-in-place branch here was unreachable.
                if (moved)
                {
                    head[x] = double.NaN;
                    for (int y = 0; y < h; y++) cur[y * w + x] = BLANK;
                }
                colPal[x] = want;
            }
        }

        public void WriteFrame(Stream s, bool flush, double dt)
        {
            if (fgb == null || headerLevel == null || cur == null) return;
            Advance(dt);
            StampLabels();
            StampOverlay();
            Encode(s, flush);
        }

        void Advance(double dt)
        {
            double churnChance = 0.9 * dt;

            for (int x = 0; x < w; x++)
            {
                int L = colLane[x];
                if (L < 0 || L >= laneCount) continue;
                int pal = colPal[x];
                if (pal < 0) continue;                    // Resize() ran, SetLanes() has not

                if (double.IsNaN(head[x]))
                {
                    if (rnd.NextDouble() < laneDensity[L] * 2.5 * dt)
                    {
                        head[x] = -rnd.Next(0, Math.Max(2, h / 2));
                        speed[x] = (0.25 + rnd.NextDouble() * 0.85) * 30.0 * laneSpeed[L];
                        len[x] = MIN_TRAIL + rnd.Next(0, spread);
                    }
                    continue;
                }

                int wasY = (int)Math.Floor(head[x]);
                head[x] += speed[x] * dt;
                int y = (int)Math.Floor(head[x]);
                int trail = len[x];

                // blank whatever the tail has moved past
                for (int ty = wasY - trail; ty <= y - trail; ty++)
                    if (ty >= 0 && ty < h) cur[ty * w + x] = BLANK;

                // paint the trail: bright head fading down to the tail
                int[] ramp = levelFor[trail];
                for (int k = 0; k < trail; k++)
                {
                    int ty = y - k;
                    if (ty < 0) break;                    // the rest is above the screen
                    if (ty >= h) continue;
                    int i = ty * w + x;

                    char c = (char)(cur[i] & 0xFFFF);
                    if (cur[i] == BLANK || rnd.NextDouble() < churnChance)
                        c = glyphs[rnd.Next(glyphs.Length)];

                    cur[i] = Pack(pal + (k == 0 ? lv + 1 : ramp[k]), c);
                }

                if (y - trail >= h) head[x] = double.NaN;  // fell off the bottom
            }
        }

        // Per-lane header the rain cannot overwrite, in that lane's own colour.
        // Restamped every frame, so it always wins the diff.
        void StampLabels()
        {
            if (header == null || headerLevel == null) return;
            int per = headerLevel.Length;
            int rows = Math.Max(0, Math.Min(per, h - 3));   // always leave room to rain

            if (labelsDirty)
            {
                labelsDirty = false;
                // Clear what WAS painted too, not just the new height. A shrunk header
                // (task rows dropped, or fewer rows per lane) otherwise leaves old rows
                // in cells the new layout never repaints: gutter columns, and lanes
                // whose slow rain takes seconds to pass.
                int wipe = Math.Min(h, Math.Max(per, hdrRowsPainted));
                for (int j = 0; j < w * wipe; j++) cur[j] = BLANK;
                for (int j = 0; j < lenHdr.Length; j++) lenHdr[j] = 0;
            }
            hdrRowsPainted = rows;

            for (int L = 0; L < laneCount; L++)
                for (int r = 0; r < rows; r++)
                {
                    int i = L * per + r;
                    lenHdr[i] = StampRow(r, laneCol0[L], laneWid[L], header[i],
                                         L * stride + headerLevel[r], lenHdr[i]);
                }
        }

        int StampRow(int row, int col0, int width, string s, int index, int wasLen)
        {
            int n = s == null ? 0 : Math.Min(s.Length, width);
            int at = row * w + col0;
            for (int j = 0; j < n; j++) cur[at + j] = Pack(index, s[j]);
            for (int j = n; j < wasLen; j++) cur[at + j] = BLANK;   // it shrank
            return n;
        }

        // A status line for -Stats. The window title is no use when the terminal profile
        // sets its own.
        void StampOverlay()
        {
            if (h < 1 || w < 4) return;
            overlayLen = StampRow(h - 1, 0, w - 2, overlay, lv + 2, overlayLen);
        }

        void Emit(byte[] src) { for (int q = 0; q < src.Length; q++) buf[pos++] = src[q]; }

        void Encode(Stream s, bool flush)
        {
            // Repaint only what is drawn. Leaving blanks matched keeps this to the
            // glyphs on screen, not a full-screen rewrite.
            if (paletteDirty)
            {
                paletteDirty = false;
                for (int i = 0; i < cur.Length; i++) if (cur[i] != BLANK) prev[i] = -1;
            }

            pos = 0;
            int written = 0, writes = 0;
            int curIdx = -99, curY = -1, curX = -1;

            for (int y = 0; y < h; y++)
            {
                int row = y * w;
                for (int x = 0; x < w; x++)
                {
                    int i = row + x;
                    int st = cur[i];
                    if (st == prev[i]) continue;
                    if (y == h - 1 && x == w - 1) continue;   // would scroll the buffer

                    if (curY != y || curX != x)
                    {
                        buf[pos++] = ESC; buf[pos++] = (byte)'[';
                        if (curY == y && curX >= 0 && x > curX)
                        {
                            int dx = x - curX;                // cheaper than a full address
                            if (dx > 1) Emit(dec[dx]);
                            buf[pos++] = (byte)'C';
                        }
                        else
                        {
                            Emit(dec[y + 1]);
                            buf[pos++] = (byte)';';
                            Emit(dec[x + 1]);
                            buf[pos++] = (byte)'H';
                        }
                    }

                    int idx = (st >> 16) - 1;
                    if (idx < 0)
                    {
                        buf[pos++] = (byte)' ';
                    }
                    else
                    {
                        if (idx >= fgb.Length) idx = fgb.Length - 1;
                        if (idx != curIdx) { Emit(fgb[idx]); curIdx = idx; }

                        // Inline UTF-8. Every glyph source is BMP: the katakana range,
                        // the ASCII pool, and the header filter. A stray surrogate
                        // would encode invalidly, so it becomes '?'.
                        int c = st & 0xFFFF;
                        if (c < 0x80) buf[pos++] = (byte)c;
                        else if (c >= 0xD800 && c <= 0xDFFF) buf[pos++] = (byte)'?';
                        else if (c < 0x800)
                        {
                            buf[pos++] = (byte)(0xC0 | (c >> 6));
                            buf[pos++] = (byte)(0x80 | (c & 0x3F));
                        }
                        else
                        {
                            buf[pos++] = (byte)(0xE0 | (c >> 12));
                            buf[pos++] = (byte)(0x80 | ((c >> 6) & 0x3F));
                            buf[pos++] = (byte)(0x80 | (c & 0x3F));
                        }
                    }

                    curY = y;
                    curX = (x + 1 >= w) ? -1 : x + 1;
                    prev[i] = st;

                    if (pos >= flushAt) { s.Write(buf, 0, pos); writes++; written += pos; pos = 0; }
                }
            }

            if (pos > 0) { s.Write(buf, 0, pos); writes++; written += pos; }
            if (flush && writes > 0) s.Flush();
            LastBytes = written;
            LastWrites = writes;
        }
    }
}
'@

$winSource = @'
namespace MatrixWin__TAG__
{
    using System;
    using System.Collections.Generic;
    using System.Runtime.InteropServices;
    using System.Text;

    public static class Windows
    {
        delegate bool EnumProc(IntPtr hwnd, IntPtr lp);
        [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lp);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int GetClassName(IntPtr hwnd, StringBuilder s, int max);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);

        static bool IsTerminal(IntPtr h)
        {
            var cn = new StringBuilder(64);
            GetClassName(h, cn, cn.Capacity);
            return cn.ToString() == "CASCADIA_HOSTING_WINDOW_CLASS";
        }

        // The current foreground window, if it is a terminal. The rain launcher typed
        // in that window, so it is a fair guess when the tab rename is refused.
        public static long Foreground()
        {
            IntPtr h = GetAncestor(GetForegroundWindow(), 2);   // GA_ROOT
            return (h != IntPtr.Zero && IsTerminal(h)) ? h.ToInt64() : 0;
        }

        // Raise a window. Tab selection flips only inside its own window; a session
        // in ANOTHER Windows Terminal window would switch invisibly while the rain
        // kept focus. The foreground process may hand focus over; at click time that is us.
        public static bool Activate(long hwnd)
        {
            return SetForegroundWindow(new IntPtr(hwnd));
        }

        // Every visible Windows Terminal window. A hidden one holds no tab anybody
        // is looking at.
        public static long[] Terminals()
        {
            var hits = new List<long>();
            EnumWindows((h, l) =>
            {
                if (IsTerminal(h) && IsWindowVisible(h)) hits.Add(h.ToInt64());
                return true;
            }, IntPtr.Zero);
            return hits.ToArray();
        }
    }
}
'@

$VT, $RendererType, $WinFinder = Add-TaggedTypes ($vtSource + "`n" + $rendererSource + "`n" + $winSource) `
                        'MatrixVT{0}.ConsoleVT', 'MatrixRain{0}.Renderer', 'MatrixWin{0}.Windows'
