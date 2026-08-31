# The Linux input classifier: which bytes mean "leave" and which mean "click".
# Classify is pure - a byte array in, a verdict out - so every terminal quirk is
# tested without a terminal. This file compiles ConsoleVT_Linux.cs standalone, so
# Windows CI covers the parser too, even though matrix never runs it there.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    $script:VT = @(Import-TestCsType @((Join-Path $PSScriptRoot '../lib/cs/ConsoleVT_Linux.cs')) `
                                        @('MatrixVT{0}.ConsoleVT'))[0]

    # Defined in BeforeAll, like every helper in the other suites: file-level
    # functions are not visible inside It blocks under Pester 5.
    function Test-Classify ([byte[]] $Bytes) {
        $x = -1; $y = -1; $used = -1
        $what = $VT::Classify($Bytes, $Bytes.Length, [ref]$x, [ref]$y, [ref]$used)
        [pscustomobject]@{ What = $what; X = $x; Y = $y; Used = $used }
    }
}

Describe 'ConsoleVT (Linux): plain keys' {
    It 'eats an empty buffer' {
        (Test-Classify @()).What | Should -Be 0          # NONE
    }

    It 'takes a printable key as an exit' {
        (Test-Classify ([byte[]]@(0x71))).What | Should -Be 1     # 'q'
    }

    It 'takes Ctrl+C as an exit, with signal generation off' {
        (Test-Classify ([byte[]]@(0x03))).What | Should -Be 1
    }

    It 'takes a bare Escape as an exit' {
        (Test-Classify ([byte[]]@(0x1b))).What | Should -Be 1
    }

    It 'ignores the other control bytes' {
        (Test-Classify ([byte[]]@(0x01))).What | Should -Be 0     # Ctrl+A
    }
}

Describe 'ConsoleVT (Linux): SGR mouse' {
    # Konsole with 1006-mode on reports ESC [ < button ; column ; row M, where
    # columns and rows are 1-based, M is a press and m is a release.
    BeforeAll {
        # Click on column 5, row 3 (1-based): cell (4, 2) zero-based.
        $script:click   = [byte[]]@(0x1b, 0x5b, 0x3c, 0x30, 0x3b, 0x35, 0x3b, 0x33, 0x4d)
        $script:release = [byte[]]@(0x1b, 0x5b, 0x3c, 0x30, 0x3b, 0x35, 0x3b, 0x33, 0x6d)
        # Wheel events are button 64 and 65.
        $script:wheelUp = [byte[]]@(0x1b, 0x5b, 0x3c, 0x36, 0x34, 0x3b, 0x35, 0x3b, 0x33, 0x4d)
    }

    It 'reports a left press, zero based' {
        $r = Test-Classify $click
        $r.What | Should -Be 2                          # CLICK
        $r.X | Should -Be 4
        $r.Y | Should -Be 2
        $r.Used | Should -Be 9
    }

    It 'consumes a release without reporting it' {
        $r = Test-Classify $release
        $r.What | Should -Be 0
        $r.Used | Should -Be 9
    }

    It 'consumes the wheel without reporting it' {
        $r = Test-Classify $wheelUp
        $r.What | Should -Be 0
        $r.Used | Should -Be 10
    }

    It 'consumes a drag, which reports with the motion bit set' {
        # button 32: left held while moving. One click must not become forty.
        $drag = [byte[]]@(0x1b, 0x5b, 0x3c, 0x33, 0x32, 0x3b, 0x35, 0x3b, 0x33, 0x4d)
        $r = Test-Classify $drag
        $r.What | Should -Be 0
        $r.Used | Should -Be 10
    }

    It 'keeps multi-digit coordinates' {
        $click = [byte[]]@(0x1b, 0x5b, 0x3c, 0x30, 0x3b, 0x31, 0x32, 0x3b, 0x33, 0x34, 0x4d)
        $r = Test-Classify $click
        $r.X | Should -Be 11
        $r.Y | Should -Be 33
    }
}

Describe 'ConsoleVT (Linux): keys that must not exit' {
    # Scrolling in Konsole sends cursor keys. A rain that exits on the scroll
    # wheel is a rain that ends the moment anyone looks back at its history.
    It 'consumes a cursor key' {
        $r = Test-Classify ([byte[]]@(0x1b, 0x5b, 0x41))          # ESC [ A
        $r.What | Should -Be 0
        $r.Used | Should -Be 3
    }

    It 'consumes an SS3 cursor key' {
        $r = Test-Classify ([byte[]]@(0x1b, 0x4f, 0x41))          # ESC O A
        $r.What | Should -Be 0
        $r.Used | Should -Be 3
    }

    It 'consumes a modified cursor key' {
        $r = Test-Classify ([byte[]]@(0x1b, 0x5b, 0x31, 0x3b, 0x35, 0x42))   # ESC [ 1;5 B
        $r.What | Should -Be 0
        $r.Used | Should -Be 6
    }

    It 'waits for more bytes when a sequence is incomplete' {
        $r = Test-Classify ([byte[]]@(0x1b, 0x5b, 0x3c, 0x30, 0x3b))     # click, cut short
        $r.What | Should -Be 0
        $r.Used | Should -Be 0                          # nothing consumed yet
    }

    It 'waits for the final byte of a cursor key too' {
        $r = Test-Classify ([byte[]]@(0x1b, 0x5b))
        $r.What | Should -Be 0
        $r.Used | Should -Be 0
    }

    It 'takes a second byte after ESC that is not a sequence start as an exit' {
        # ESC followed by a printable: Alt+key. Konsole sends Alt+q as 1b 71.
        $r = Test-Classify ([byte[]]@(0x1b, 0x71))
        $r.What | Should -Be 1
        $r.Used | Should -Be 2
    }
}

Describe 'ConsoleVT (Linux): mode surface' {
    # matrix.ps1 drives the same call sequence on both platforms. The stub answers
    # what the script needs, whatever the underlying OS actually offers.
    It 'reports the VT bit already on, because a terminal that runs this has one' {
        $mode = 0
        $VT::GetConsoleMode([IntPtr]::Zero, [ref]$mode) | Should -BeTrue
        $mode | Should -Be 0x0004                       # ENABLE_VIRTUAL_TERMINAL_PROCESSING
    }

    It 'accepts console mode writes as no-ops' {
        $VT::SetConsoleMode([IntPtr]::Zero, 0) | Should -BeTrue
    }

    It 'always answers a stdin mode, never null, so the restore path runs' {
        $VT::GetStdinMode() | Should -Not -BeNullOrEmpty
    }

    It 'round-trips the timer calls as success' {
        $VT::timeBeginPeriod(1) | Should -Be 0
        $VT::timeEndPeriod(1)   | Should -Be 0
    }
}

Describe 'ConsoleVT (Linux): raw mode against a real terminal' `
        -Skip:($IsWindows -or [Console]::IsInputRedirected) {
    # The freeze class the rain hit live, twice: something else rewrites stdin
    # termios after we went raw - .NET's [Console] property setters apply their
    # own cached state, VMIN and all, and a blocking VMIN turns the frame loop
    # into a slideshow that only moves on keypresses. Only a real terminal can
    # show it, so this runs live, and only where stdin is one.
    BeforeAll {
        # A termios reader of our own, to see what is really set: the lflag's
        # ICANON|ECHO bits and VMIN, as "flags|VMIN".
        # Through Add-TaggedTypes, like every other compiled type in the suite: a
        # plain Add-Type binds the name for the session, so a second Invoke-Pester
        # in the same shell fails the whole block on "the type already exists".
        $script:Tty = @(Add-TaggedTypes @'
namespace MatrixTty__TAG__ {
using System;
using System.Runtime.InteropServices;
public static class TtyProbe {
    [StructLayout(LayoutKind.Sequential)]
    public struct Termios {
        public uint c_iflag, c_oflag, c_cflag, c_lflag;
        public byte c_line;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)] public byte[] c_cc;
        public uint c_ispeed, c_ospeed;
    }
    [DllImport("libc")]
    private static extern int tcgetattr(int fd, ref Termios t);
    public static string Look() {
        Termios t = new Termios(); t.c_cc = new byte[32];
        if (tcgetattr(0, ref t) != 0) return "gone";
        return (t.c_lflag & 0xA) + "|" + t.c_cc[6];
    }
}
}
'@ 'MatrixTty{0}.TtyProbe')[0]
    }

    It 'takes raw back after a Console property setter walked over it' {
        try {
            [void]$VT::SetStdinMode(0x0090)          # MOUSE_ON: raw, and the mouse reported
            [Console]::TreatControlCAsInput = $true  # the write that once undid it
            [void]$VT::SetStdinMode(0x0090)          # EnterRaw re-verifies and re-engages
            $Tty::Look() | Should -Be '0|0' -Because 'cooked flags are off and the read returns at once'
        } finally {
            # matrix.ps1's order: the [Console] setters go first, because each
            # one applies .NET's own cached termios - the stdin restore must be
            # the last write to win.
            try { [Console]::TreatControlCAsInput = $false } catch { }
            [void]$VT::SetStdinMode(0)               # give the terminal back
        }
        # The restore puts line editing and echo back, whatever VMIN it lands on.
        ($Tty::Look() -notmatch '^0\|') | Should -BeTrue
    }
}