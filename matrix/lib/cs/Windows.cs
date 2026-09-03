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
