<#
.SYNOPSIS
    Adds a Windows Terminal profile that opens the rain.

.DESCRIPTION
    Writes one profile into Windows Terminal's settings.json. Windows Terminal
    reloads settings.json on save: the profile appears in the dropdown at once,
    no restart.

    A GUID derived from -Name keys the profile: a re-run updates the same profile
    instead of adding another. -Remove takes it out.

    settings.json is backed up next to itself first. The file is rewritten from
    parsed JSON: hand-written comments and formatting do not survive; the backup
    does. The backup is written once, never overwritten, so it stays the original.

.PARAMETER Name
    Profile name, as it appears in the dropdown. Default "Matrix".

.PARAMETER Arguments
    Arguments passed to matrix.ps1. Default is the session view with the stats line.

.PARAMETER Retro
    Turn the CRT effect on. Off by default: it is a matter of taste. Windows
    Terminal's own profile settings can toggle it afterwards; a re-run keeps
    whatever was set there.

.PARAMETER Remove
    Delete the profile instead of adding it.

.PARAMETER SettingsPath
    Path to settings.json. Found automatically when omitted.

.EXAMPLE
    .\install-terminal-profile.ps1 -WhatIf     # what it would change, without writing

.EXAMPLE
    .\install-terminal-profile.ps1

.EXAMPLE
    .\install-terminal-profile.ps1 -Retro

.EXAMPLE
    .\install-terminal-profile.ps1 -Name 'Matrix (plain)' -Arguments '-Fps 60'

.EXAMPLE
    .\install-terminal-profile.ps1 -Remove

.NOTES
    -ThisWindow scopes the lanes to the window the rain starts in. Open this
    profile as a TAB in the window whose sessions you want to watch. Opened as
    its own window, it correctly reports that it holds no sessions.
#>
#requires -Version 7
[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $Name      = 'Matrix',
    [string] $Arguments = '-Fps 60 -Stats -Sessions -ThisWindow -Click',
    [switch] $Retro,
    [switch] $Remove,
    [string] $SettingsPath
)

$ErrorActionPreference = 'Stop'

function Find-TerminalSettings {
    # Store build first, then unpackaged, then Preview.
    $local = $env:LOCALAPPDATA
    $candidates = @(
        "$local\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
        "$local\Microsoft\Windows Terminal\settings.json"
        "$local\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json"
    )
    $hit = @($candidates | Where-Object { [System.IO.File]::Exists($_) })
    if ($hit.Count -eq 0) { throw 'Windows Terminal settings.json not found. Pass -SettingsPath.' }
    $hit[0]
}

function Get-ProfileGuid {
    # Same name, same GUID: a re-run updates the profile rather than adding one.
    param([string] $Key)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("matrix-rain:$Key")) }
    finally { $sha.Dispose() }
    # Cast: the slice is object[], and [guid] would take the string overload.
    '{' + [guid]::new([byte[]]$bytes[0..15]).ToString() + '}'
}

if (-not $SettingsPath) { $SettingsPath = Find-TerminalSettings }
if (-not [System.IO.File]::Exists($SettingsPath)) { throw "Not found: $SettingsPath" }

$scriptPath = Join-Path $PSScriptRoot 'matrix.ps1'
if (-not [System.IO.File]::Exists($scriptPath)) { throw "matrix.ps1 not found at: $scriptPath" }

# Resolve now: the profile must not depend on PATH later.
$shell = Get-Command pwsh.exe -ErrorAction SilentlyContinue
if (-not $shell) { throw 'pwsh.exe not found. The rain needs PowerShell 7+.' }

$guid = Get-ProfileGuid $Name
$raw  = [System.IO.File]::ReadAllText($SettingsPath)
# pwsh's ConvertFrom-Json accepts the JSONC Windows Terminal writes: comments and
# trailing commas parse. Only the rewrite below drops them; the backup keeps them.
$settings = $raw | ConvertFrom-Json -ErrorAction Stop

# profiles is either a bare array or { defaults, list }
$list = if ($settings.profiles -is [array]) { $settings.profiles } else { $settings.profiles.list }
if ($null -eq $list) { throw 'settings.json has no profiles list.' }

$old     = @($list | Where-Object { $_.guid -eq $guid })[0]
$keep    = @($list | Where-Object { $_.guid -ne $guid })
$existed = $null -ne $old

if ($Remove -and -not $existed) {
    Write-Host "No profile named '$Name' ($guid) to remove." -ForegroundColor Yellow
    return
}

$entry = $null
if (-not $Remove) {
    $entry = [ordered]@{
        guid             = $guid
        name             = $Name
        commandline      = '"{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}" {2}' -f $shell.Source, $scriptPath, $Arguments
        startingDirectory = $PSScriptRoot
        icon             = [char]::ConvertFromUtf32(0x1F7E9)       # green square
        hidden           = $false
    }
    # Carry over every property this script does not own. A re-run then keeps what
    # the user set in Windows Terminal's own profile UI: colour scheme, font,
    # opacity, the CRT effect.
    if ($old) {
        foreach ($p in $old.PSObject.Properties) {
            if (-not $entry.Contains($p.Name)) { $entry[$p.Name] = $p.Value }
        }
    }
    # -Retro forces the effect on; otherwise the carried-over value stands.
    if ($Retro) { $entry['experimental.retroTerminalEffect'] = $true }
    $retro = [bool]$entry['experimental.retroTerminalEffect']
}

$action = if ($Remove) { "remove profile '$Name'" }
          elseif ($existed) { "update profile '$Name'" }
          else { "add profile '$Name'" }
# Replace an existing profile in place: a re-run does not shuffle the dropdown.
$newList = if ($Remove) { $keep }
           elseif ($existed) { @($list | ForEach-Object { if ($_.guid -eq $guid) { [pscustomobject]$entry } else { $_ } }) }
           else { $keep + [pscustomobject]$entry }

if ($settings.profiles -is [array]) { $settings.profiles = $newList } else { $settings.profiles.list = $newList }

$backup  = "$SettingsPath.matrix-bak"
$hadBak  = [System.IO.File]::Exists($backup)
$applied = $PSCmdlet.ShouldProcess($SettingsPath, $action)
if ($applied) {
    # First run only. Overwriting on run two would replace the hand-written
    # original with the copy this script already rewrote.
    if (-not $hadBak) { [System.IO.File]::WriteAllText($backup, $raw) }
    # Depth well past Windows Terminal's deepest nesting: too shallow silently truncates.
    [System.IO.File]::WriteAllText($SettingsPath, ($settings | ConvertTo-Json -Depth 32))
}

Write-Host ("{0} {1}" -f $(if ($applied) { 'Done:' } else { 'Would' }), $action) -ForegroundColor $(if ($applied) { 'Green' } else { 'Yellow' })
Write-Host "  settings : $SettingsPath"
if ($applied) {
    # Say which run the backup holds: the settings before the FIRST install, not
    # this one. Restoring it undoes every hand edit since, not just this run.
    $when = if ($hadBak) { ' (from the first install, not this run)' } else { '' }
    Write-Host "  backup   : $backup$when"
}
if ($entry) { Write-Host "  runs     : $($entry.commandline)" -ForegroundColor DarkGray }
if ($applied -and $entry) {
    Write-Host ''
    Write-Host 'It is in the dropdown now; Windows Terminal reloads settings as they are saved.' -ForegroundColor Cyan
    Write-Host 'Open it as a TAB in the window whose sessions you want -ThisWindow to scope to.' -ForegroundColor Cyan
    if (-not $retro) {
        Write-Host 'CRT effect is off. -Retro turns it on, or toggle it in the profile settings.' -ForegroundColor DarkGray
    }
}
