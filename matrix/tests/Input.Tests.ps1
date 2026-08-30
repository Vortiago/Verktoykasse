# The Linux input classifier: which bytes mean "leave" and which mean "click".
# Classify is pure - a byte array in, a verdict out - so every terminal quirk is
# tested without a terminal. This file compiles ConsoleVT_Linux.cs standalone, so
# Windows CI covers the parser too, even though matrix never runs it there.
BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')

    $src = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot '../lib/cs/ConsoleVT_Linux.cs'))
    $script:VT = (Add-TaggedTypes $src 'MatrixVT{0}.ConsoleVT')[0]

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