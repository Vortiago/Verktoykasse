# The terminal backend that answers nothing: macOS outside tmux.
#
# Terminal.app and iTerm2 expose no tab a script can name, and none it can raise
# from another process. There is no map to build.
#
# The rain still runs: every session gets a lane, and only -ThisWindow and -Click
# are unavailable. Test-TabSupport below tells the user which and why.
#
# Inside tmux on macOS, tmux.ps1 answers instead, with the exact pane match every
# other Unix backend gets.
#
# Same seven functions as the other backends, because tabmap.ps1 calls them by
# name and knows no platform.

function Get-OwnTerminalWindow {
    # Nothing identifies this window. Falsy, so tabmap.ps1 reaches
    # Test-TabSupport below with the answer it expects.
    0
}

function Test-TabSupport {
    # Read at startup. matrix.ps1 turns it into the message each flag deserves.
    param([object] $Hwnd)
    'macOS has no tab a script can name outside tmux, so start the rain in tmux'
}

function Get-AllTerminalTab {
    # An empty list, not $null: the callers iterate it.
    @()
}

function Select-TerminalTab {
    param([Parameter(Mandatory)] $Tab)
    $false
}

function Get-TabKey {
    # Never reached: there are no tabs. Answered anyway, so a caller that keys an
    # empty map does not fall over.
    param($Tab)
    ''
}

function Resolve-MachineTab {
    param([Parameter(Mandatory)] [string] $Machine, [scriptblock] $ReadTab = $null)
    $null
}

function Resolve-SessionTab {
    param(
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Session,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [object[]] $Tab
    )
    @{}
}
