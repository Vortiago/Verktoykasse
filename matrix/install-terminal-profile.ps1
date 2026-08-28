<#
.SYNOPSIS
    Adds a Windows Terminal profile that opens the rain, with the CRT effect on.

.DESCRIPTION
    Writes one profile into Windows Terminal's settings.json. Windows Terminal reloads
    settings.json as it is saved, so the profile appears in the dropdown at once with no
    restart.

    The profile is keyed by a GUID derived from -Name, so running this again updates the
    same profile instead of adding another. -Remove takes it out.

    settings.json is backed up next to itself first. It is rewritten from parsed JSON,
    so hand-written comments and formatting in it do not survive; the backup does. That
    backup is written once and never overwritten, so it stays the original.

.PARAMETER Name
    Profile name, as it appears in the dropdown. Default "Matrix".

.PARAMETER Arguments
    Arguments passed to matrix.ps1. Default is the session view with the stats line.

.PARAMETER NoRetro
    Leave the CRT effect off. It is on by default, which is the point of this.

.PARAMETER Remove
    Delete the profile instead of adding it.

.PARAMETER SettingsPath
    Path to settings.json. Found automatically when omitted.

.EXAMPLE
    .\install-terminal-profile.ps1 -WhatIf     # what it would change, without writing

.EXAMPLE
    .\install-terminal-profile.ps1

.EXAMPLE
    .\install-terminal-profile.ps1 -Name 'Matrix (plain)' -Arguments '-Fps 60'

.EXAMPLE
    .\install-terminal-profile.ps1 -Remove

.NOTES
    -ThisWindow scopes the lanes to the terminal window the rain starts in, so open this
    profile as a TAB in the window whose sessions you want to watch. Opened as its own
    window it will correctly report that there are no sessions in it.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $Name      = 'Matrix',
    [string] $Arguments = '-Fps 60 -Stats -Sessions -ThisWindow -Click',
    [switch] $NoRetro,
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
    # Same name, same GUID, so re-running updates the profile rather than adding one.
    param([string] $Key)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("matrix-rain:$Key")) }
    finally { $sha.Dispose() }
    # cast, or the slice is object[] and [guid] takes the string overload
    '{' + [guid]::new([byte[]]$bytes[0..15]).ToString() + '}'
}

if (-not $SettingsPath) { $SettingsPath = Find-TerminalSettings }
if (-not [System.IO.File]::Exists($SettingsPath)) { throw "Not found: $SettingsPath" }

$scriptPath = Join-Path $PSScriptRoot 'matrix.ps1'
if (-not [System.IO.File]::Exists($scriptPath)) { throw "matrix.ps1 not found at: $scriptPath" }

# Resolved now, so the profile does not depend on PATH later. PowerShell 7 if it is
# here: the assembly cache is keyed on PSEdition, so a profile that picks the other one
# pays a second compile for the same rain.
$shell = Get-Command pwsh.exe -ErrorAction SilentlyContinue
if (-not $shell) { $shell = Get-Command powershell.exe -ErrorAction SilentlyContinue }
if (-not $shell) { throw 'Neither pwsh.exe nor powershell.exe found.' }

$guid = Get-ProfileGuid $Name
$raw  = [System.IO.File]::ReadAllText($SettingsPath)
try { $settings = $raw | ConvertFrom-Json -ErrorAction Stop }
catch { throw "Could not parse $SettingsPath : $($_.Exception.Message)" }

# profiles is either a bare array or { defaults, list }
$list = if ($settings.profiles -is [array]) { $settings.profiles } else { $settings.profiles.list }
if ($null -eq $list) { throw 'settings.json has no profiles list.' }

$keep    = @($list | Where-Object { $_.guid -ne $guid })
$existed = $keep.Count -ne @($list).Count

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
    if (-not $NoRetro) { $entry['experimental.retroTerminalEffect'] = $true }
}

$action = if ($Remove) { "remove profile '$Name'" }
          elseif ($existed) { "update profile '$Name'" }
          else { "add profile '$Name'" }
$newList = if ($Remove) { $keep } else { $keep + [pscustomobject]$entry }

if ($settings.profiles -is [array]) { $settings.profiles = $newList } else { $settings.profiles.list = $newList }

$backup  = "$SettingsPath.matrix-bak"
$applied = $PSCmdlet.ShouldProcess($SettingsPath, $action)
if ($applied) {
    # First run only. Run two and overwriting would replace the hand-written original
    # with the copy this script already rewrote, which is the thing the backup is for.
    if (-not [System.IO.File]::Exists($backup)) { [System.IO.File]::WriteAllText($backup, $raw) }
    # Depth well past the deepest thing Windows Terminal nests, or it silently truncates.
    [System.IO.File]::WriteAllText($SettingsPath, ($settings | ConvertTo-Json -Depth 32))
}

Write-Host ("{0} {1}" -f $(if ($applied) { 'Done:' } else { 'Would' }), $action) -ForegroundColor $(if ($applied) { 'Green' } else { 'Yellow' })
Write-Host "  settings : $SettingsPath"
if ($applied) { Write-Host "  backup   : $backup" }
if ($entry) { Write-Host "  runs     : $($entry.commandline)" -ForegroundColor DarkGray }
if ($applied -and $entry) {
    Write-Host ''
    Write-Host 'It is in the dropdown now; Windows Terminal reloads settings as they are saved.' -ForegroundColor Cyan
    Write-Host 'Open it as a TAB in the window whose sessions you want -ThisWindow to scope to.' -ForegroundColor Cyan
}
