# One child process, run to completion, its stdout handed back.
#
# Its own file because three callers in two load groups need it and no one of
# them can own it: sessions.ps1 always loads and remote/tcp.ps1 only loads under
# -Remote or -ExposeOnSSH, so tcp.ps1 cannot own it, and RemoteTcp.Tests.ps1
# sources tcp.ps1 alone, so sessions.ps1 cannot either. Nothing here depends on
# anything, which is what lets it load first.
#
# Invoke-Tmux in terminal/tmux.ps1 stays separate on purpose: it throws on a
# non-zero exit and waits unbounded, and Get-AllTerminalTab depends on the throw.

function Invoke-Tool {
    <#
    .SYNOPSIS
        Run a tool and return its stdout, or '' when it cannot run or will not stop.
    .DESCRIPTION
        Two lessons live here, and neither is worth carrying more than once.

        Drain both pipes at once. Reading one to the end first deadlocks the
        pair: a child blocked writing its full stderr sits there forever while
        the parent waits in ReadToEnd for stdout's EOF.

        Bound the wait. This is reached from a tab-map rebuild and from a click,
        and a hung child would hang the rain.

        Every failure answers '' rather than throwing. A caller here is asking a
        question the rain can live without an answer to.
    .PARAMETER FileName
        The tool. Not found on PATH is a failure like any other, which is how
        Windows answers for ps, ss and lsof alike.
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
