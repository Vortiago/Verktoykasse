# The terminal-output layer: tagged-type compilation, the escape sequences that own
# the screen, and the filter for every string drawn to it.
#
# Kept apart from types.ps1, which only loads and compiles the C# sources in cs/.

# Keep one cell per character or the header shears. Block control codes (C0, DEL, C1).
# Allow only Latin-1/Latin Extended-A: the renderer's inline UTF-8 encoder handles it.
#
# Build the allowed set once, programmatically, so file encoding never matters:
# ASCII printable \x20-\x7E + printable Latin-1 Supplement \xA0-\xFF (carries the
# middle dot the titles use) + Latin Extended-A U+0100-U+017F. Exclude the C1 range
# \x80-\x9F: those are control codes (U+009B is an 8-bit CSI). A user-set /rename
# name must not put one on the screen.
#
# Use a HashSet for O(1) lookup, not regex: PowerShell's -replace with interpolated
# character classes is fragile (backslash escaping, metacharacters). Script scope, not
# per call: this runs for every header string of every session on every poll.
$script:CellAllowed = [System.Collections.Generic.HashSet[char]]::new()
foreach ($cellCode in @(0x20..0x7E) + @(0xA0..0xFF) + @(0x0100..0x017F)) {
    [void]$script:CellAllowed.Add([char]$cellCode)
}

# The same three ranges as $CellAllowed, as a regex, for the "is there anything
# to do?" question only. Never for the replacing: it decides whether the loop
# runs, and the loop still decides every character.
# \u escapes, so the pattern is ASCII and this file's encoding stays irrelevant.
$script:CellNeedsWork = [regex]::new('[^\u0020-\u007E\u00A0-\u00FF\u0100-\u017F]',
                                     [System.Text.RegularExpressions.RegexOptions]::Compiled)

function ConvertTo-CellText {
    param([string] $Text)
    # Almost every string here is already clean, and a clean string can be handed
    # back untouched. The scan below is an interpreted loop over every character,
    # and it runs for each remote session on every poll as well as locally.
    if (-not $script:CellNeedsWork.IsMatch($Text)) { return $Text }
    $sb = [System.Text.StringBuilder]::new($Text.Length)
    $chars = $Text.ToCharArray()
    for ($i = 0; $i -lt $chars.Length; $i++) {
        $c = $chars[$i]
        if ($script:CellAllowed.Contains($c)) {
            [void]$sb.Append($c)
        } else {
            [void]$sb.Append(' ')
        }
    }
    $sb.ToString()
}

function Get-RainGlyph {
    # Glyphs draw uniformly: the counts set the mix. Katakana two thirds, a letter
    # about one glyph in ten. Half-width katakana render one cell wide; the
    # full-width block takes two and shears the grid.
    param([bool] $Ascii)
    if ($Ascii) {
        return [char[]]'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz<>/\|+*=-:;?#$%&@'
    }
    ([char[]](0xFF66..0xFF9D | ForEach-Object { [char]$_ })) +
        [char[]]'ZTAESHLC' +
        [char[]]'0123456789' +
        [char[]]':."=*+-<>|'
}

$script:ESC = [char]27
$script:CLS = "$script:ESC[2J$script:ESC[H"   # clear screen, cursor home

# 1049 = alternate screen buffer, 25 = cursor, 1007 = alternate scroll (the terminal
# sends arrow keys for the mouse wheel). LEAVE must turn back on whatever ENTER turns off.
$script:ENTER_SCREEN = "$script:ESC[?1049h$script:CLS$script:ESC[?1007l$script:ESC[?25l"
$script:LEAVE_SCREEN = "$script:ESC[0m$script:CLS$script:ESC[?1007h$script:ESC[?1049l$script:ESC[?25h"

# A .NET type cannot be unloaded, so the namespaces carry a hash of the source.
# An edit then gives fresh types instead of silently reusing an earlier run's compile.
#
# The hash also names a cached assembly in TEMP: compiling shells out to csc, and the
# cached DLL loads an order of magnitude faster. Any source edit invalidates the tag.
# The name carries the runtime major version: two pwsh installs on different .NET
# majors (a stable and a preview) must not load each other's build. LoadFrom is lazy,
# so a wrong-runtime DLL resolves here and fails only at first use, past every
# fallback.
# On any error, fall back to compiling in memory. See README.md.
function Add-TaggedTypes {
    param([string] $Source, [string[]] $TypeNames)   # names hold {0} where the tag goes
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Source))
        $family = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($TypeNames -join '|'))
    } finally { $sha.Dispose() }
    $tag = ([BitConverter]::ToString($bytes) -replace '-').Substring(0, 8)

    if (-not (($TypeNames[0] -f $tag) -as [type])) {
        # One cache per source family: two compiled sources must not evict each
        # other. The family is the whole name list, not just its first entry - the
        # suite compiles ConsoleVT_Linux.cs on its own under the same first name
        # types.ps1 uses for the whole bundle, and a family read from that name
        # alone had the two deleting each other's cache on every alternating run.
        $stem = ($TypeNames[0] -split '[.{]')[0]
        $fam  = ([BitConverter]::ToString($family) -replace '-').Substring(0, 6)
        $rt   = "net$([System.Environment]::Version.Major)"
        $dll  = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-$stem-$fam-$tag-$rt.dll"
        try {
            if (-not [System.IO.File]::Exists($dll)) {
                # Compile to a private name, then move into place. A loaded assembly is
                # locked. Two rains starting at once must not load a half-written file.
                $tmp = "$dll.$PID.tmp"
                try {
                    Add-Type -TypeDefinition $Source.Replace('__TAG__', $tag) -OutputAssembly $tmp -ErrorAction Stop
                    if (-not [System.IO.File]::Exists($dll)) { [System.IO.File]::Move($tmp, $dll) }
                } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }

                # Only this tag is reachable now. Drop what earlier edits left behind.
                # Keep the runtime in the filter: runtimes cache side by side, and a
                # wider glob evicts them on every alternation.
                # Skip a copy another process still has loaded; it is locked.
                Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Filter "matrix-$stem-$fam-*-$rt.dll" -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -ne $dll } |
                    Remove-Item -Force -ErrorAction SilentlyContinue
            }
            # LoadFrom, not Add-Type -Path: the cmdlet pays the Utility module load
            # for one call. Its only extra is registering the assembly for a later
            # -ReferencedAssemblies resolve. Nothing here does that.
            if (-not (($TypeNames[0] -f $tag) -as [type])) {
                [void][System.Reflection.Assembly]::LoadFrom($dll)
            }
        } catch {
            if (-not (($TypeNames[0] -f $tag) -as [type])) {
                Add-Type -TypeDefinition $Source.Replace('__TAG__', $tag)
            }
        }
    }
    foreach ($name in $TypeNames) { ($name -f $tag) -as [type] }
}

# Handing stdin back, in the one order that works. CursorVisible and
# TreatControlCAsInput each apply .NET's own cached console state, so a stdin
# mode restored before them is overwritten by the setter after it: the mode has
# to go last of the three. Both frame loops call this from their finally, and
# both restore the output encoding after - that one does not touch stdin.
function Restore-ConsoleState {
    param($VT, $StdinMode)
    try { [Console]::CursorVisible = $true } catch { }
    try { [Console]::TreatControlCAsInput = $false } catch { }
    if ($null -ne $StdinMode) { try { [void]$VT::SetStdinMode($StdinMode) } catch { } }
}

