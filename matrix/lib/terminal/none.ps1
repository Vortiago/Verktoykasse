# The backend for a terminal that answers nothing: macOS outside tmux.
#
# Terminal.app and iTerm2 expose no tab a script can name and none it can raise
# from another process, so there is no map to build. This is not a stub waiting
# to be filled in - it is the honest answer, and it exists so the rain still
# runs. Every session gets a lane; only -ThisWindow and -Click are unavailable,
# and Test-TabSupport below is what tells the user which and why.
#
# Run the rain inside tmux on a Mac and tmux.ps1 answers instead, with the exact
# pane match every other Unix backend gets. That is what the reason says to do.
#
# Same seven functions as the other backends, because tabmap.ps1 calls them by
# name and knows no platform.

function Get-OwnTerminalWindow {
    # Nothing identifies this window, which is the whole point of this file.
    # Falsy, so Test-TabSupport below is reached with the answer it expects.
    0
}

function Test-TabSupport {
    # The one function here that says something. Read at startup, and matrix.ps1
    # turns it into the message each flag deserves.
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
    # Never reached with a real tab, since there are none. Answered anyway, so a
    # caller that keys an empty map does not fall over.
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
