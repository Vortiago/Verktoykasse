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

function ConvertTo-CellText {
    param([string] $Text)
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
    try { $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Source)) } finally { $sha.Dispose() }
    $tag = ([BitConverter]::ToString($bytes) -replace '-').Substring(0, 8)

    if (-not (($TypeNames[0] -f $tag) -as [type])) {
        # One cache per source family: two compiled sources must not evict each
        # other. Only the renderer uses this today.
        $stem = ($TypeNames[0] -split '[.{]')[0]
        $rt   = "net$([System.Environment]::Version.Major)"
        $dll  = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-$stem-$tag-$rt.dll"
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
                Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Filter "matrix-$stem-*-$rt.dll" -File -ErrorAction SilentlyContinue |
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
