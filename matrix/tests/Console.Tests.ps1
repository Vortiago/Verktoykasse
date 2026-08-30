BeforeAll {
    . (Join-Path $PSScriptRoot '../lib/console.ps1')
    $script:E = [char]27
}

Describe 'ConvertTo-CellText' {
    It 'keeps one cell per character' {
        # A character wider than one cell shears the header. Replace a filtered
        # character, never drop it.
        $in = "a`tb" + [char]0xFF66 + 'c'
        (ConvertTo-CellText $in).Length | Should -Be $in.Length
    }

    It 'leaves plain ASCII alone' {
        $asciiTest = 'matrix-session-status working 6m'
        ConvertTo-CellText $asciiTest | Should -Be $asciiTest
    }

    It 'keeps Latin-1 and Latin Extended-A, which the encoder handles' {
        # $([char]...) subexpressions: file encoding never corrupts the test data.
        # (${[char]...} is a braced VARIABLE lookup. It expands to nothing, and this
        # test then asserted on pure ASCII while claiming to cover Latin-1.)
        $expected = "Verkt$([char]0x00F8)ykasse $([char]0x00C6)rlig $([char]0x0101) $([char]0x00B7)"
        ConvertTo-CellText $expected | Should -Be $expected
    }

    It 'replaces control characters' {
        ConvertTo-CellText "a`tb`nc`r$E" | Should -Be 'a b c  '
    }

    It 'replaces the C1 range, which is control codes, not text' {
        # U+009B is an 8-bit CSI: a /rename name carrying it must not reach the screen.
        ConvertTo-CellText ('a' + [char]0x009B + 'b' + [char]0x0085) | Should -Be 'a b '
    }

    It 'replaces anything that would draw wider than one cell' {
        ConvertTo-CellText ([char]0xFF66 + [char]0x4E2D) | Should -Be '  '
    }

    It 'has nothing to say about empty text' {
        ConvertTo-CellText '' | Should -Be ''
    }
}

Describe 'The screen escapes' {
    It 'turns back on everything it turned off' {
        # LEAVE must re-enable whatever ENTER disables. Otherwise the terminal loses
        # its cursor, its scrollback, or its wheel.
        foreach ($mode in 1049, 1007, 25) {
            ($ENTER_SCREEN + $LEAVE_SCREEN | Select-String -Pattern "\?$mode" -AllMatches).Matches |
                Should -HaveCount 2
        }
    }

    It 'leaves the alternate buffer last, after clearing and resetting' {
        $LEAVE_SCREEN | Should -Match "\?1049l"
        # Ordinal: the default string search is culture-sensitive. It can miss an
        # escape sequence that is plainly there.
        $LEAVE_SCREEN.StartsWith("$E[0m", [StringComparison]::Ordinal) | Should -BeTrue
    }
}

Describe 'Add-TaggedTypes' {
    BeforeAll {
        # Its own type family, so it never touches the renderer's cached assembly.
        $script:src = @'
namespace PesterProbe__TAG__
{
    public static class Probe { public static int Answer() { return 42; } }
}
'@
    }

    It 'compiles the source and hands back the tagged type' {
        $t = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $t | Should -Not -BeNullOrEmpty
        $t::Answer() | Should -Be 42
    }

    It 'gives the same source the same type instead of compiling twice' {
        $a = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $b = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $a.FullName | Should -Be $b.FullName
    }

    It 'gives edited source a different type, because a .NET type cannot be unloaded' {
        $edited = $src.Replace('return 42;', 'return 43;')
        $a = Add-TaggedTypes $src 'PesterProbe{0}.Probe'
        $b = Add-TaggedTypes $edited 'PesterProbe{0}.Probe'
        $a.FullName | Should -Not -Be $b.FullName
        $b::Answer() | Should -Be 43
    }

    It 'names the cached assembly for the runtime, so no two evict or poison each other' {
        [void](Add-TaggedTypes $src 'PesterProbe{0}.Probe')
        $rt = "net$([System.Environment]::Version.Major)"
        Get-ChildItem ([System.IO.Path]::GetTempPath()) -Filter "matrix-PesterProbe-*-$rt.dll" |
            Should -Not -BeNullOrEmpty
    }
}
