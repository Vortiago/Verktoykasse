# The terminal-output layer: compiling tagged types, the escape sequences that own the
# screen, and the filter every string drawn to it goes through.
#
# Kept apart from types.ps1, which is only the C# sources.

# One cell per character or the header shears: no control codes, and nothing outside
# Latin-1/Latin Extended-A, which the renderer's inline UTF-8 encoder handles.
function ConvertTo-CellText {
    param([string] $Text)
    # Build the allowed-char set programmatically so file encoding never matters.
    # ASCII printable \x20-\x7E + middle dot (U+00B7) + Latin-1 Supplement \x80-\xFF
    # + Latin Extended-A U+0100-U+017F.
    #
    # Using a HashSet for O(1) lookup instead of regex: PowerShell's -replace with
    # interpolated character classes is fragile (backslash escaping, metacharacters).
    # A char-by-char pass is fast enough for the short strings involved.
    $allowed = [System.Collections.Generic.HashSet[char]]::new()
    $codes = @(0x20..0x7E) + @(0x00B7) + @(0x80..0xFF) + @(0x0100..0x017F)
    for ($j = 0; $j -lt $codes.Length; $j++) {
        [void]$allowed.Add([char]$codes[$j])
    }
    $sb = [System.Text.StringBuilder]::new($Text.Length)
    $chars = $Text.ToCharArray()
    for ($i = 0; $i -lt $chars.Length; $i++) {
        $c = $chars[$i]
        if ($allowed.Contains($c)) {
            [void]$sb.Append($c)
        } else {
            [void]$sb.Append(' ')
        }
    }
    $sb.ToString()
}

$script:ESC = [char]27
$script:CLS = "$script:ESC[2J$script:ESC[H"   # clear screen, cursor home

# 1049 = alternate screen buffer, 25 = cursor, 1007 = alternate scroll, which is what
# makes a terminal send arrow keys for the mouse wheel. Whatever ENTER turns off, LEAVE
# must turn back on.
$script:ENTER_SCREEN = "$script:ESC[?1049h$script:CLS$script:ESC[?1007l$script:ESC[?25l"
$script:LEAVE_SCREEN = "$script:ESC[0m$script:CLS$script:ESC[?1007h$script:ESC[?1049l$script:ESC[?25h"

# A .NET type cannot be unloaded, so the namespaces carry a hash of the source: edit it
# and you get fresh types instead of silently reusing whatever an earlier run in this
# session compiled.
#
# That hash also names a cached assembly in TEMP, because compiling shells out to csc and
# the cached DLL loads an order of magnitude faster. The tag invalidates it on any source
# edit, and PSEdition is in the name because 5.1 and 7 target different frameworks.
# Anything that goes wrong falls back to compiling in memory. See README.md.
function Add-TaggedTypes {
    param([string] $Source, [string[]] $TypeNames)   # names hold {0} where the tag goes
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Source)) } finally { $sha.Dispose() }
    $tag = ([BitConverter]::ToString($bytes) -replace '-').Substring(0, 8)

    if (-not (($TypeNames[0] -f $tag) -as [type])) {
        # One cache per source family: two sources compiled through here must not
        # evict each other. Only the renderer uses this today.
        $stem = ($TypeNames[0] -split '[.{]')[0]
        $dll  = Join-Path ([System.IO.Path]::GetTempPath()) "matrix-$stem-$tag-$($PSVersionTable.PSEdition).dll"
        try {
            if (-not [System.IO.File]::Exists($dll)) {
                # Compile to a private name and move it into place: a loaded assembly is
                # locked, and two rains starting at once must not load a half-written file.
                $tmp = "$dll.$PID.tmp"
                try {
                    Add-Type -TypeDefinition $Source.Replace('__TAG__', $tag) -OutputAssembly $tmp -ErrorAction Stop
                    if (-not [System.IO.File]::Exists($dll)) { [System.IO.File]::Move($tmp, $dll) }
                } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }

                # Only this tag is reachable now, so drop what earlier edits left behind.
                # The edition stays in the filter: the two editions cache side by side,
                # and a wider glob makes them evict each other on every alternation.
                # A copy another process still has loaded is locked; skip it.
                Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Filter "matrix-$stem-*-$($PSVersionTable.PSEdition).dll" -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -ne $dll } |
                    Remove-Item -Force -ErrorAction SilentlyContinue
            }
            # LoadFrom, not Add-Type -Path: the cmdlet pays for the Utility module to do
            # what is one call, and only adds registering the assembly for a later
            # -ReferencedAssemblies resolve, which nothing here does.
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
