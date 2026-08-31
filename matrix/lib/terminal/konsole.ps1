# Konsole on Linux: the backend tabmap.ps1 calls when the rain is not on Windows.
# It answers the same six names windows-terminal.ps1 does, so the map above it
# never asks which platform it is on. matrix.ps1 loads one of the two, not both.
#
# Every call goes through the -Call seam, which is how the tests drive these
# without a bus. It defaults to Invoke-Konsole so the call's defaults are written
# once: a seam that re-spelled them drifted, sent an empty interface field, and
# the bus hangs up on an invalid message. konsole is not a well-known bus name,
# so the unique one it exports through the environment is what gets dialled.

$script:KonsoleService = $env:KONSOLE_DBUS_SERVICE
$script:KonsoleBus = $null

function Get-KonsoleBus {
    if ($null -ne $script:KonsoleBus) { return $script:KonsoleBus }
    if (-not $script:KonsoleService) {
        throw 'matrix: this shell is not running in a Konsole tab'
    }
    $script:KonsoleBus = $DBusType::Session()
    $script:KonsoleBus
}

function Reset-KonsoleBus {
    # Hang up, so the next call dials again.
    if ($null -ne $script:KonsoleBus) {
        try { $script:KonsoleBus.Dispose() } catch { }
        $script:KonsoleBus = $null
    }
}

function Invoke-Konsole {
    param(
        [Parameter(Mandatory)] [string] $Path,
        [string] $Iface = 'org.kde.konsole.Session',
        [Parameter(Mandatory)] [string] $Member,
        [string] $InSig = '',
        [object[]] $InArgs = @(),
        [string] $OutSig = ''
    )
    $bus = Get-KonsoleBus
    try {
        $bus.Call($script:KonsoleService, $Path, $Iface, $Member,
                  $InSig, $InArgs, $OutSig)
    } catch {
        # Cached for the life of the run, and a failed call leaves it mid-message:
        # the next read starts inside a reply nobody finished. Without this, one
        # timed-out read blanks the lanes for good on the same dead socket.
        Reset-KonsoleBus
        throw
    }
}

function Get-OwnTerminalWindow {
    # Konsole sets KONSOLE_DBUS_WINDOW before starting the shell in a tab. Unlike
    # Windows, where the foreground window is a guess timed against the launch,
    # this is exact.
    if ($env:KONSOLE_DBUS_WINDOW -match '/Windows/(\d+)$') { [int]$Matches[1] } else { 0 }
}

function Get-AllTerminalTab {
    # Every tab of every Konsole window in the process that launched this shell.
    # Like Windows Terminal, konsole keeps all its windows in one process, so one
    # bus name covers them all.
    param([scriptblock] $Call = ${function:Invoke-Konsole})

    try {
        # Invoke-Konsole's output comes through the pipeline, so a lone string
        # arrives bare - and @() around a string enumerates its CHARACTERS, which
        # is how one reply's first character once stood in for the whole XML.
        $xml = [string](& $Call -Path '/Windows' -Iface 'org.freedesktop.DBus.Introspectable' `
                                -Member 'Introspect' -OutSig 's')
        $tabs = foreach ($m in [regex]::Matches($xml, '<node\s+name="(\d+)"')) {
            $w = [int]$m.Groups[1].Value
            $ids = [string[]](& $Call -Path "/Windows/$w" -Iface 'org.kde.konsole.Window' `
                                        -Member 'sessionList' -OutSig 'as')
            $i = 0
            foreach ($id in $ids) {
                $tabPid = [int](& $Call -Path "/Sessions/$id" -Member 'processId' `
                                       -OutSig 'i')
                [pscustomobject]@{
                    Hwnd = $w; Index = $i; Name = ''; Text = ''
                    Element = [int]$id; Pid = $tabPid
                }
                $i++
            }
        }
        return @($tabs)
    } catch {
        return @()          # a closed window mid-walk is no reason to blank the rain
    }
}

function Select-TerminalTab {
    # Konsole switches the window's current session; there is no Activate on the
    # session itself, and no raise either. org.kde.konsole.Window is ViewManager's
    # whole Q_SCRIPTABLE list and nothing in it raises or activates
    # (activationRequest is a signal, not a method). So a click on a session in
    # another Konsole window switches that window's tab where nobody can see it,
    # unlike windows-terminal.ps1, which has WinFinder::Activate. Fixing it means
    # leaving Konsole for KWindowSystem or an XDG activation token, and Wayland
    # lets the compositor refuse the raise anyway.
    param(
        [Parameter(Mandatory)] $Tab,
        [scriptblock] $Call = ${function:Invoke-Konsole}
    )
    try {
        [void](& $Call -Path "/Windows/$($Tab.Hwnd)" -Iface 'org.kde.konsole.Window' `
                       -Member 'setCurrentSession' -InSig 'i' -InArgs @([int]$Tab.Element))
        return $true
    } catch {
        return $false
    }
}

function Test-TabSupport {
    # Konsole's two preconditions, before the rain starts: the tab that launched
    # this shell, and a bus to ask about it. Dialling here turns a missing bus into
    # a message - Get-AllTerminalTab answers a failed call with an empty list,
    # which -ThisWindow would render as a window holding no sessions at all.
    param([long] $Hwnd)
    if (-not $Hwnd) { return 'this shell is not running in a Konsole tab' }
    try { [void](Get-KonsoleBus) } catch { return ($_.Exception.Message -replace '^matrix: ', '') }
    ''
}

function Get-TabKey {
    # A tab's identity. Konsole hands out a session id that outlives the tab's
    # position, so unlike Windows Terminal this key IS an identity across passes:
    # closing a tab renumbers the ones to its right, and an index-keyed carry in
    # Merge-SessionTab would then name a different tab than the one it stored.
    param($Tab)
    "$($Tab.Hwnd):$($Tab.Element)"
}

function Resolve-SessionTab {
    # Konsole tab titles do not carry Claude's glyph - the default format is
    # "dir : shell" - so the Windows title scoring has nothing to score. The tab's
    # process id is exact instead: the tab whose pid is among a session's ancestors
    # is the tab it runs in. The walk goes UP from the claude pid, because claude
    # is often not the tab shell's direct child (bash -> ollama -> claude).
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab,
        # test seam: pid -> ancestor pid list
        [scriptblock] $Ancestors = ${function:Get-ProcessAncestorId}
    )

    $tabPids = @{}
    foreach ($t in $Tab) { $tabPids[[int]$t.Pid] = $t }

    $map = @{}
    foreach ($s in $Session) {
        foreach ($ancestor in @(& $Ancestors ([int]$s.Pid))) {
            if ($tabPids.ContainsKey([int]$ancestor)) {
                $map[$s.SessionId] = $tabPids[[int]$ancestor]
                break
            }
        }
    }
    $map
}

function Get-ProcessAncestorId {
    # A pid and every pid above it, read from /proc. The chain is short (shell,
    # terminal, init) and the walk runs once per session per tab-map rebuild, not
    # per poll.
    param([Parameter(Mandatory)] [int] $ProcessId)
    $out = [System.Collections.Generic.List[int]]::new()
    $p = $ProcessId
    for ($i = 0; $i -lt 64 -and $p -ge 1; $i++) {
        $out.Add($p)
        try {
            $m = [regex]::Match([System.IO.File]::ReadAllText("/proc/$p/status"),
                                '(?m)^PPid:\s+(\d+)')
            if (-not $m.Success) { break }
            $p = [int]$m.Groups[1].Value
        } catch { break }
    }
    $out
}
