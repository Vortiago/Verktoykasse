# One tool, run to completion, its stdout handed back.
#
# Its own file because three callers in two load groups need it and none can own
# it. sessions.ps1 always loads. remote/tcp.ps1 loads only under -Remote or
# -ExposeOnSSH, so tcp.ps1 cannot own it. RemoteTcp.Tests.ps1 sources tcp.ps1
# alone, so sessions.ps1 cannot either. Nothing here depends on anything, which
# lets it load first.
#
# Invoke-Tmux in terminal/tmux.ps1 stays separate on purpose: it throws on a
# non-zero exit and waits unbounded, and Get-AllTerminalTab depends on the throw.

function Invoke-Tool {
    <#
    .SYNOPSIS
        Run a tool and return its stdout, or '' when it cannot run or will not stop.
    .DESCRIPTION
        Drain both pipes at once. Reading one to the end first deadlocks the
        pair. A tool blocked writing its full stderr waits forever while
        Invoke-Tool waits in ReadToEnd for stdout's EOF.

        Bound the wait. A tab-map rebuild and a click both reach this, and a
        hung tool would hang the rain.

        Every failure answers '' rather than throwing. A caller here asks a
        question the rain can live without an answer to.
    .PARAMETER FileName
        Not found on PATH is a failure like any other, which is how Windows
        answers for ps, ss and lsof alike.
    #>
    param([Parameter(Mandatory)] [string] $FileName, [string[]] $ToolArgs)
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FileName
    foreach ($a in $ToolArgs) { $psi.ArgumentList.Add($a) }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    # $p exists only once Start answers, and a tool that is not on PATH throws
    # there. The finally must survive a failed start.
    $p = $null
    try {
        $p = [System.Diagnostics.Process]::Start($psi)
        $out = $p.StandardOutput.ReadToEndAsync()
        $err = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit(2000)) {
            # Kill it rather than read .Result, which waits with no bound at all.
            # Already gone: the tool can exit between WaitForExit and Kill.
            try { $p.Kill() } catch { }
            return ''
        }
        [void]$err.Result
        $out.Result
    } catch {
        ''
    } finally {
        if ($p) { $p.Dispose() }
    }
}
