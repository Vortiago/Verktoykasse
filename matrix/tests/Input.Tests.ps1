# The Unix input classifier: which bytes mean "exit", which carry a key, which
# mean "click", and which the terminal owns.
# Classify is pure - a byte array in, a verdict out - so every terminal quirk is
# tested without a terminal. This file compiles ConsoleVT_Unix.cs standalone, so
# Windows CI covers the parser too, even though matrix never runs it there.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    . (Join-Path $PSScriptRoot 'Fixtures.ps1')

    $script:Cs = Join-Path $PSScriptRoot '../lib/cs'

    # Which ABI this platform runs, decided once, and every reader below takes it
    # from here. The live raw-mode block at the bottom builds its own probe
    # against the same struct, and two evaluations of one condition could
    # disagree. The first It in that block guards against it. $script:, because
    # the repo's Pester 5 note applies here too.
    $script:Abi = if ($IsMacOS) { 'Darwin' } else { 'Linux' }

    # One pair, this platform's. Not both.
    #
    # Two sources under one $TypeNames list share a cache family, and
    # Add-TaggedTypes keeps one live tag per family. Each compile deletes the
    # other's cached DLL, so both recompile on every run, for about a second
    # each. See the same collision in console.ps1.
    #
    # The three CI runners cover both files instead: Windows and Linux build
    # Termios_Linux.cs, macOS builds Termios_Darwin.cs, so neither can rot
    # without a job going red.
    $script:VT = @(Import-TestCsType @((Join-Path $script:Cs 'ConsoleVT_Unix.cs'),
                                       (Join-Path $script:Cs "Termios_$($script:Abi).cs")) `
                                     @('MatrixVT{0}.ConsoleVT'))[0]

    # Defined in BeforeAll, like every helper in the other suites: file-level
    # functions are not visible inside It blocks under Pester 5.
    function Test-Classify ([byte[]] $Bytes) {
        $x = -1; $y = -1; $key = -1; $used = -1
        $what = $VT::Classify($Bytes, $Bytes.Length, [ref]$x, [ref]$y, [ref]$key, [ref]$used)
        [pscustomobject]@{ What = $what; X = $x; Y = $y; Key = $key; Used = $used }
    }
}

Describe 'ConsoleVT (Unix): plain keys' {
    It 'eats an empty buffer' {
        (Test-Classify @()).What | Should -Be 0          # NONE
    }

    It 'reports a printable key, with the character' {
        $r = Test-Classify ([byte[]]@(0x71))                     # 'q'
        $r.What | Should -Be 3                                   # KEY
        $r.Key  | Should -Be 0x71
    }

    It 'reports a printable key it has no binding for, rather than exiting' {
        # The whole point of KEY: an unbound letter must reach the caller, so a
        # later feature can claim it without touching this file.
        $r = Test-Classify ([byte[]]@(0x70))                     # 'p'
        $r.What | Should -Be 3
        $r.Key  | Should -Be 0x70
    }

    It 'takes Ctrl+C as the one exit' {
        # With ISIG off there is no SIGINT, so this reader owns Ctrl+C. It is the
        # only byte that exits: which letter quits is a binding, not a verdict.
        $r = Test-Classify ([byte[]]@(0x03))
        $r.What | Should -Be 1                                   # EXIT
        $r.Key  | Should -Be 0
    }

    It 'reports a bare Escape as a key' {
        $r = Test-Classify ([byte[]]@(0x1b))
        $r.What | Should -Be 3
        $r.Key  | Should -Be 0x1b
    }

    It 'reports Enter and Tab as keys' {
        (Test-Classify ([byte[]]@(0x0d))).Key | Should -Be 0x0d
        (Test-Classify ([byte[]]@(0x09))).Key | Should -Be 0x09
    }

    It 'ignores the other control bytes' {
        $r = Test-Classify ([byte[]]@(0x01))                     # Ctrl+A
        $r.What | Should -Be 0
        $r.Used | Should -Be 1                                   # consumed, not left to re-read
    }

    It 'consumes a UTF-8 lead byte without inventing a key' {
        # This reader does not assemble multi-byte characters. Handing on half of
        # one as a key would let an accented letter fire a binding.
        $r = Test-Classify ([byte[]]@(0xc3, 0xa5))               # U+00E5
        $r.What | Should -Be 0
        $r.Used | Should -Be 1
    }
}

Describe 'ConsoleVT (Unix): SGR mouse' {
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

Describe 'ConsoleVT (Unix): keys that must not exit' {
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

    It 'consumes Alt+key without reporting it' {
        # ESC followed by a printable: Alt+key. Konsole sends Alt+q as 1b 71. A
        # chord belongs to the terminal, and Alt+q must not quit a rain that
        # quits on q.
        $r = Test-Classify ([byte[]]@(0x1b, 0x71))
        $r.What | Should -Be 0
        $r.Key  | Should -Be 0
        $r.Used | Should -Be 2
    }
}

Describe 'ConsoleVT (Unix): mode surface' {
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

Describe 'ConsoleVT (Unix): raw mode against a real terminal' `
        -Skip:($IsWindows -or [Console]::IsInputRedirected) {
    # The freeze class the rain hit live, twice: something else rewrites stdin
    # termios after we went raw - .NET's [Console] property setters apply their
    # own cached state, VMIN and all, and a blocking VMIN turns the frame loop
    # into a slideshow that only moves on keypresses. Only a real terminal can
    # show it, so this runs live, and only where stdin is one.
    BeforeAll {
        # A termios reader of our own, to see what is really set: the lflag's
        # ICANON|ECHO bits and VMIN, as "flags|VMIN".
        #
        # A second copy of the ABI, deliberately. The production one lives in
        # Termios_*.cs and is internal. A probe that asked the code under test
        # what it set would agree with itself on a wrong layout. The four values
        # that differ are spelled out here, next to the assertion that reads them.
        #
        # Keyed off $script:Abi, not a second reading of the platform. The first
        # It below guards against a mismatch.
        $spec = @{
            # tcflag_t is unsigned int, NCCS 32, a c_line byte, VMIN at 6,
            # ICANON 0x2 | ECHO 0x8.
            Linux  = @{ Flag = 'uint';  Line = 'public byte c_line;'
                        Nccs = 32; VMin = 6;  Mask = '0xA' }
            # tcflag_t is unsigned long, NCCS 20, no c_line, VMIN at 16,
            # ICANON 0x100 | ECHO 0x8.
            Darwin = @{ Flag = 'ulong'; Line = ''
                        Nccs = 20; VMin = 16; Mask = '0x108' }
        }
        $abi = $spec[$script:Abi]

        # Through Add-TaggedTypes, like every other compiled type in the suite: a
        # plain Add-Type binds the name for the session, so a second Invoke-Pester
        # in the same shell fails the whole block on "the type already exists".
        # The tag hashes the source, so the two platforms' probes never collide.
        $script:Tty = @(Add-TaggedTypes (@'
namespace MatrixTty__TAG__ {
using System;
using System.Runtime.InteropServices;
public static class TtyProbe {
    [StructLayout(LayoutKind.Sequential)]
    public struct Termios {
        public {FLAG} c_iflag, c_oflag, c_cflag, c_lflag;
        {LINE}
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = {NCCS})] public byte[] c_cc;
        public {FLAG} c_ispeed, c_ospeed;
    }
    [DllImport("libc")]
    private static extern int tcgetattr(int fd, ref Termios t);
    public static string Look() {
        Termios t = new Termios(); t.c_cc = new byte[{NCCS}];
        if (tcgetattr(0, ref t) != 0) return "gone";
        return (t.c_lflag & {MASK}) + "|" + t.c_cc[{VMIN}];
    }
}
}
'@ -replace '\{FLAG\}', $abi.Flag -replace '\{LINE\}', $abi.Line `
   -replace '\{NCCS\}', $abi.Nccs -replace '\{VMIN\}', $abi.VMin `
   -replace '\{MASK\}', $abi.Mask) 'MatrixTty{0}.TtyProbe')[0]
    }

    It 'reads real termios bits rather than zeros off a mismatched struct' {
        # Run first, and the reason the rest can be trusted. A probe built on the
        # wrong struct reads every field at the wrong offset and answers zero for
        # all of them. "0|0" is exactly what raw mode looks like, so a wrong
        # layout passes the raw assertion below by accident and fails only the
        # restore.
        #
        # Do not assume a cooked terminal. Under an interactive PowerShell,
        # PSReadLine has already taken ICANON and ECHO off for its line editing.
        # ICANON reads 0 here, and that is correct. VMIN is 1 until something
        # goes raw, whatever else is set. A reading of "0|0" before any write is
        # the struct failing, not the terminal.
        $look = $Tty::Look()
        $look | Should -Not -Be 'gone' -Because 'tcgetattr must answer for a real tty'
        $look | Should -Not -Be '0|0' -Because (
            "the $($script:Abi) probe must read this platform's termios, not zeros")
    }

    It 'takes raw back after a Console property setter walked over it' {
        # What the terminal is before anything touches it, and what it has to be
        # again afterwards. Not a constant: cooked from a script, and already
        # non-canonical under an interactive PowerShell.
        $before = $Tty::Look()

        # Re-checked here, before the first write, because Pester runs on past a
        # failure. This block mangles a real terminal on purpose. Through a
        # struct that does not match the platform, it leaves the shell that ran
        # the suite with no line editing.
        $before | Should -Not -Be '0|0' -Because (
            'this block only writes termios it can read back')

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
            # Read the restored terminal once, here. The net below writes a sane
            # terminal, and sane is what a script starts from. A second reading
            # taken after it would compare the net's own work against $before and
            # pass.
            $after = $Tty::Look()
            # And if it did not come back, take it back by force. The restore
            # above replays the termios EnterRaw saved. A bug there hands the
            # shell that ran the suite a terminal with no line editing, which a
            # developer then has to know to fix with stty by hand. A test that
            # breaks the terminal it runs from is worse than a failing one. The
            # net belongs here rather than in the advice.
            if ($after -ne $before) {
                & stty sane 2>$null
                Write-Warning 'stdin did not come back from raw: reset with stty sane'
            }
        }
        # Back exactly as found: LeaveRaw replays what EnterRaw saved.
        $after | Should -Be $before
    }
}
