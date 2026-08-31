# Shared test fixtures. Not named *.Tests.ps1, so Pester does not try to run it.

function New-TestTab ($hwnd, $index, $text, $glyph) {
    # $glyph: 'busy', 'idle', or 'none' for a tab Claude has not titled
    [pscustomobject]@{
        Hwnd = $hwnd; Index = $index; Text = $text
        IsBusy = $glyph -eq 'busy'; IsIdle = $glyph -eq 'idle'
    }
}

# A session record shaped the way the lane and tab code reads it. Konsole's pid
# matching needs Pid, and so does the tab map's session signature; the Windows
# title scoring does not, and leaves it at 0.
# The parameter is $processId, not $pid: the automatic $PID is read-only and a
# parameter that shadows it never binds.
function New-TestSession ($id, $status = 'idle', $task = '', $processId = 0) {
    [pscustomobject]@{ SessionId = $id; Status = $status; Task = $task
                       Name = ''; Cwd = ''; Pid = $processId }
}

# Compiles .cs sources standalone for a test, through the same tagged-type
# machinery lib/console.ps1 uses, so Windows CI covers the Linux C# too. The
# types come back flat: collect with @() at the call site, because a bare
# assignment would unroll a one-type result to the type itself.
function Import-TestCsType ([string[]] $Source, [string[]] $TypeName) {
    $src = foreach ($p in $Source) { [System.IO.File]::ReadAllText($p) }
    @(Add-TaggedTypes ($src -join "`n") $TypeName)
}
