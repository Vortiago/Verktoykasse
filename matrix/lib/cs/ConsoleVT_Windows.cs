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

        // The four verdicts, and what each one fills in:
        //   NONE   nothing happened. x, y and key are all unset.
        //   EXIT   the terminal says stop. Ctrl+C only. Nothing else exits here:
        //          which letter quits is a binding, and bindings live in matrix.ps1.
        //   CLICK  a left press. x and y are the cell, zero based.
        //   KEY    a plain keypress. key is the character. A chord is not a key:
        //          Ctrl and Alt combinations read as NONE, so a future binding can
        //          claim a letter without fighting a terminal shortcut.
        public const int NONE = 0, EXIT = 1, CLICK = 2, KEY = 3;

        // Which characters count as a key. The same set the Linux reader takes, so
        // a binding written once behaves the same on both platforms.
        static bool IsKeyChar(int c)
        {
            return c == 0x09 || c == 0x0A || c == 0x0D || c == 0x1B
                || (c >= 0x20 && c <= 0x7E);
        }

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
        static int Classify(int type, int keyDown, int vk, int ch, uint ctrlKeys,
                            uint buttons, uint flags, out int key)
        {
            key = 0;
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
            if (!IsKeyChar(ch)) return NONE;                 // a dead key, or F1, or a keypad edit
            key = ch; return KEY;
        }

        // Returns EXIT for Ctrl+C, KEY for a plain keypress (key is the character),
        // CLICK for a left mouse press (x, y are the clicked cell), NONE otherwise.
        public static int PollInput(out int x, out int y, out int key)
        {
            x = -1; y = -1; key = 0;
            IntPtr h = GetStdHandle(-10);
            InputRecord rec;
            uint n;
            while (PeekConsoleInput(h, out rec, 1, out n) && n > 0)
            {
                int ck;
                int what = Classify(rec.EventType, rec.KeyDown, rec.VirtualKeyCode, rec.Char,
                                    rec.ControlKeyState, rec.ButtonState, rec.EventFlags, out ck);
                if (what == CLICK) { x = rec.MouseX; y = rec.MouseY; }
                if (what == KEY) { key = ck; }

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
