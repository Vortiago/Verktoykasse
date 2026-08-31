# Konsole on Linux, standing in for the Windows Terminal pieces of tabs.ps1.
# matrix.ps1 dot-sources tabs.ps1 first and this file second, so the same names
# here replace the Windows ones. Everything tabs.ps1 owns that is already
# platform-neutral - the tab map state, the retry backoff, the merge - is reused
# untouched.
#
# The D-Bus call each function makes is a scriptblock seam (-Call), which is how
# the tests drive these without a bus. The real one talks to the Konsole process
# that launched this shell: konsole is not a well-known bus name, so the unique
# name it exports through the environment is the one to call.

$script:KonsoleService = $env:KONSOLE_DBUS_SERVICE
$script:KonsoleBus = $null

# The one default -Call seam, built once and shared by the tab functions: they
# differ in which arguments they pass, not in how a call reaches the bus. A
# seam that drifted from Invoke-Konsole's defaults once sent an empty interface
# field, and the bus answers an invalid message by hanging up.
$script:KonsoleCall = { param($Path, $Iface = 'org.kde.konsole.Session', $Member,
                              $OutSig = '', $InSig = '', $InArgs = @())
                        Invoke-Konsole -Path $Path -Iface $Iface -Member $Member `
                                       -InSig $InSig -InArgs $InArgs -OutSig $OutSig }

function Get-KonsoleBus {
    if ($null -ne $script:KonsoleBus) { return $script:KonsoleBus }
    if (-not $script:KonsoleService) {
        throw 'matrix: this shell is not running in a Konsole tab'
    }
    $script:KonsoleBus = $DBusType::Session()
    $script:KonsoleBus
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
    (Get-KonsoleBus).Call($script:KonsoleService, $Path, $Iface, $Member,
                          $InSig, $InArgs, $OutSig)
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
    param([scriptblock] $Call)
    if (-not $Call) { $Call = $script:KonsoleCall }

    try {
        # The bus values arrive unwrapped: Invoke-Konsole's output comes through
        # the pipeline, so a lone string arrives as a bare string - and @() around
        # a string enumerates its CHARACTERS, which is how one reply's first
        # character once stood in for the whole XML. Cast instead of index.
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
    # session itself.
    param(
        [Parameter(Mandatory)] $Tab,
        [scriptblock] $Call
    )
    if (-not $Call) { $Call = $script:KonsoleCall }
    try {
        [void](& $Call -Path "/Windows/$($Tab.Hwnd)" -Iface 'org.kde.konsole.Window' `
                       -Member 'setCurrentSession' -InSig 'i' -InArgs @([int]$Tab.Element))
        return $true
    } catch {
        return $false
    }
}

function Resolve-SessionTab {
    # Konsole tab titles do not carry Claude's glyph - the default tab format is
    # "dir : shell", so the Windows title scoring has nothing to score. The tab's
    # process id is exact instead: walk a session's ancestors, and the tab whose
    # process id is among them is the tab it runs in.
    #
    # The walk goes UP from the claude pid, not down from the tab: claude is
    # often not the tab shell's direct child (bash -> ollama -> claude), so
    # descending from the tab would never find it.
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab,
        [scriptblock] $Ancestors        # test seam: pid -> ancestor pid list
    )
    if (-not $Ancestors) {
        $Ancestors = { param([int] $ProcessId) Get-ProcessAncestorId -ProcessId $ProcessId }
    }

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