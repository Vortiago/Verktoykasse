# Konsole on Linux: the backend tabmap.ps1 calls when the rain is on Linux and not
# inside tmux - tmux owns every terminal it nests in, so it answers before Konsole.
# It answers the same six names windows-terminal.ps1 does, so the map above it
# never asks which platform it is on. matrix.ps1 loads one of the three, not several.
#
# Every call goes through the -Call seam, which is how the tests drive these
# without a bus. It defaults to Invoke-Konsole so the call's defaults are written
# once: a seam that re-spelled them drifted, sent an empty interface field, and
# the bus hangs up on an invalid message. konsole is not a well-known bus name,
# so the unique one it exports through the environment is what gets dialled.

$script:KonsoleService = $env:KONSOLE_DBUS_SERVICE
$script:KonsoleBus = $null
$script:WindowIface  = 'org.kde.konsole.Window'
$script:IntrospectIface = 'org.freedesktop.DBus.Introspectable'

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

function Get-KonsoleWindowId {
    # Introspection answers with a <node name="N"/> per window.
    param([string] $Xml)
    foreach ($m in [regex]::Matches($Xml, '<node\s+name="(\d+)"')) { [int]$m.Groups[1].Value }
}

function Get-AllTerminalTab {
    # Every tab of every Konsole window in the process that launched this shell.
    # Like Windows Terminal, konsole keeps all its windows in one process, so one
    # bus name covers them all.
    param([scriptblock] $Call = ${function:Invoke-Konsole})

    try {
        # Cast, do not wrap. Invoke-Konsole returns through the pipeline, so a lone
        # string arrives bare, and @() around a string enumerates its characters.
        $xml = [string](& $Call -Path '/Windows' -Iface $script:IntrospectIface `
                                -Member 'Introspect' -OutSig 's')
        $tabs = foreach ($w in Get-KonsoleWindowId $xml) {
            $ids = [string[]](& $Call -Path "/Windows/$w" -Iface $script:WindowIface `
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
    # Konsole switches the window's current session. It cannot raise the window:
    # org.kde.konsole.Window is ViewManager's whole Q_SCRIPTABLE list, and nothing
    # in it raises or activates. So a click on a session in another Konsole window
    # switches that window's tab where nobody can see it. A fix means leaving
    # Konsole for KWindowSystem or an XDG activation token, and Wayland lets the
    # compositor refuse the raise anyway.
    param(
        [Parameter(Mandatory)] $Tab,
        [scriptblock] $Call = ${function:Invoke-Konsole}
    )
    try {
        [void](& $Call -Path "/Windows/$($Tab.Hwnd)" -Iface $script:WindowIface `
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
    # Konsole tab titles do not carry Claude's glyph, so the Windows title scoring
    # has nothing to score. The tab process id is exact instead. The walk goes up
    # from the claude pid, because claude is often not the tab shell's direct child
    # (bash -> ollama -> claude).
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab,
        # test seam: pid -> ancestor pid list. ${function:...} resolves by name at
        # call time, so it reads $null - silently - whenever sessions.ps1 was not
        # sourced before this file. Name the missing dependency instead of dying
        # inside the poll on '&' against nothing.
        [scriptblock] $Ancestors = ${function:Get-ProcessAncestorId}
    )

    if (-not $Ancestors) {
        throw 'matrix: Get-ProcessAncestorId is not loaded - source lib/sessions.ps1 before the terminal backend'
    }

    $tabPids = @{}
    foreach ($t in $Tab) { $tabPids[[int]$t.Pid] = $t }

    $map = @{}
    foreach ($s in $Session) {
        foreach ($ancestor in @(& $Ancestors ([int]$s.Pid))) {
            # A walk that dies mid-chain returns $null inside an array, and
            # [int]$null is 0: skip it rather than match a tab with no pid.
            if (-not $ancestor) { continue }
            if ($tabPids.ContainsKey([int]$ancestor)) {
                $map[$s.SessionId] = $tabPids[[int]$ancestor]
                break
            }
        }
    }
    $map
}

# Get-ProcessAncestorId lives in sessions.ps1 now, next to the other process-table
# readers: the tmux backend needs the same walk. Resolve-SessionTab still reaches
# it through the -Ancestors seam's default, which by name resolves to that copy.
