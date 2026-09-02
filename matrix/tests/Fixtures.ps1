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

# A session in the shape Get-LocalSession hands out: everything the lane header
# and the wire format read. Not New-TestSession above. That one leaves Name and
# Cwd empty, which sends Get-SessionTitle into Get-SessionFact to read a
# transcript, and the protocol suites must not touch a file.
function New-WireSession ($id, $name = 'api', $status = 'idle', $task = '') {
    [pscustomobject]@{
        Pid = 0; SessionId = $id; Name = $name; NameSource = 'user'; Cwd = '?'
        Status = $status; WaitingFor = ''; StartedAt = 1000; UpdatedAt = 2000
        Style = (Get-SessionStyle $status); Task = $task
    }
}

# Poll until a condition holds, or give up. Sockets and child processes are not
# synchronous: a connect on loopback lands in well under a millisecond, but "well
# under" is not "before the next statement". Every wait in the suite is bounded.
# An unbounded one hangs the whole run, and CI shows it as a timeout with no name.
#
# Anything the condition accumulates must be $script:-scoped. A bare $x += inside
# the block writes a NEW local each call, so the caller sees nothing and the
# condition still passes off its own copy.
function Wait-Until ([scriptblock] $Condition, [int] $TimeoutMs = 2000, [int] $StepMs = 10) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
        if (& $Condition) { return $true }
        Start-Sleep -Milliseconds $StepMs
    }
    $false
}

# What Claude writes as "procStart" for a live process on this platform: a
# FILETIME on Windows, /proc clock ticks on Linux. The fake registries a test
# writes have to carry the same shape sessions.ps1 reads back, so both come from
# here. The caller dot-sources ../lib/sessions.ps1 for Get-ProcessStartTicks, the
# way Import-TestCsType below relies on console.ps1.
function Get-TestProcStart ([int] $ProcessId = $PID) {
    if ($IsWindows) {
        # Dispose: StartTime opens a kernel handle, the reason sessions.ps1
        # wraps its own copy of this call the same way.
        $p = [System.Diagnostics.Process]::GetProcessById($ProcessId)
        try { $p.StartTime.ToFileTimeUtc() } finally { $p.Dispose() }
    }
    else { Get-ProcessStartTicks -ProcessId $ProcessId }
}

# Snapshot and restore a set of environment variables around a test.
# "Restore, do not null": a developer running the suite inside a real tmux pane
# or Konsole tab must not lose their variables from their own process the way
# Remove-Item Env:\ would.
function Get-EnvSnapshot ([string[]] $Names) {
    $saved = @{}
    foreach ($n in $Names) { $saved[$n] = [Environment]::GetEnvironmentVariable($n) }
    $saved
}

function Restore-EnvSnapshot ($Saved) {
    foreach ($n in $Saved.Keys) {
        if ($null -eq $Saved[$n]) { Remove-Item -LiteralPath "Env:\$n" -ErrorAction SilentlyContinue }
        else { Set-Item -LiteralPath "Env:\$n" -Value $Saved[$n] }
    }
}

# Compiles .cs sources standalone for a test, through the same tagged-type
# machinery lib/console.ps1 uses, so Windows CI covers the Linux C# too. The
# types come back flat: collect with @() at the call site, because a bare
# assignment would unroll a one-type result to the type itself.
function Import-TestCsType ([string[]] $Source, [string[]] $TypeName) {
    $src = foreach ($p in $Source) { [System.IO.File]::ReadAllText($p) }
    @(Add-TaggedTypes ($src -join "`n") $TypeName)
}
