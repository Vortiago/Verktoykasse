# oclaude machine -- the per-machine config file: where it lives, and how it combines
# with the defaults in config.ps1. Loaded by ../oclaude.ps1.
#
# One rule, so that there is nothing to remember: a key present in the machine file
# REPLACES the default value for that key outright. Nothing merges inside a key. So a
# machine file that sets Models must list all four tiers, and one that sets Derived must
# list every derived tag it wants built. Test-OClaudeConfig below warns about the
# mistakes that rule makes possible.

function Get-OClaudeMachineConfigPath {
    # One path on every platform, so the docs and the error messages can name it.
    # $env:OCLAUDE_CONFIG overrides it, which is how to try a map without moving files.
    if ($env:OCLAUDE_CONFIG) { return $env:OCLAUDE_CONFIG }
    Join-Path (Join-Path (Join-Path $HOME '.config') 'oclaude') 'config.ps1'
}

function Read-OClaudeMachineConfig {
    # Runs the machine file and returns its hashtable, or $null when there is none.
    # Invoked with & rather than dot-sourced, for two reasons. A child scope cannot
    # redefine the functions this shell loaded. And the file is read on every call, so an
    # edit takes effect on the next `oclaude` with no profile reload. That is why
    # Test-OClaudeStale does not track this file.
    param([string]$Path = (Get-OClaudeMachineConfigPath))
    if (-not (Test-Path -LiteralPath $Path)) { return $null }

    try { $result = & $Path }
    catch {
        Write-Warning (('oclaude: {0} failed to run -- {1}. Falling back to the defaults.') -f
                       $Path, $_.Exception.Message)
        return $null
    }

    # A stray expression in the file writes to the pipeline too, so the return value can
    # be an array. Name that case: the symptom is a map that looks ignored.
    $maps = @($result | Where-Object { $_ -is [System.Collections.IDictionary] })
    if ($maps.Count -eq 1) { return $maps[0] }
    if ($maps.Count -eq 0) {
        Write-Warning (('oclaude: {0} returned no hashtable, so the defaults are in use. ' +
                        'The file must END with a hashtable of overrides.') -f $Path)
    } else {
        Write-Warning (('oclaude: {0} returned {1} hashtables, so the defaults are in use. ' +
                        'Something above the final hashtable writes to the pipeline.') -f
                       $Path, $maps.Count)
    }
    return $null
}

function Merge-OClaudeMachineConfig {
    # Applies the machine file over the defaults, one top-level key at a time.
    param([Parameter(Mandatory)]$Default, $Override, [string]$Path)
    if (-not $Override) { return $Default }

    # An unknown key does nothing at all, which is the hardest kind of typo to see. The
    # config object's own property list is the authority, so this cannot fall out of date.
    $known = @($Default.PSObject.Properties.Name)
    foreach ($key in @($Override.Keys)) {
        if ($known -notcontains $key) {
            Write-Warning (('oclaude: {0} sets "{1}", which is not a config key, so it has ' +
                            'no effect. The keys are: {2}') -f $Path, $key, ($known -join ', '))
            continue
        }
        $Default.$key = $Override[$key]
    }
    return $Default
}

function Test-OClaudeConfig {
    # Warns about what replacing a whole key gets wrong. Latched on the file timestamp,
    # because Get-OClaudeConfig also serves default parameter values and so runs many
    # times per command. This warns once per edit per shell.
    param([Parameter(Mandatory)]$Cfg, [string]$Path)

    $stamp = if ($Path -and (Test-Path -LiteralPath $Path)) {
        (Get-Item -LiteralPath $Path).LastWriteTimeUtc
    } else { $null }
    if ($stamp -and $global:OClaudeConfigCheckedAt -eq $stamp) { return }
    $global:OClaudeConfigCheckedAt = $stamp

    $tiers = @('OPUS', 'SONNET', 'HAIKU', 'FABLE')
    $have  = @($Cfg.Models.Keys)

    # Claude Code asks for all four. A tier left out of a replaced Models has no model
    # behind it, and the CLI then sends the tier name itself as the model.
    $missing = @($tiers | Where-Object { $have -notcontains $_ })
    if ($missing) {
        Write-Warning (('oclaude: {0} leaves Models without {1}. A key in the machine file ' +
                        'replaces the default outright, so list every tier.') -f
                       $Path, ($missing -join ', '))
    }
    $extra = @($have | Where-Object { $tiers -notcontains $_ })
    if ($extra) {
        Write-Warning (('oclaude: Models has {0}, which is not a tier, so nothing reads it. ' +
                        'The tiers are {1}.') -f ($extra -join ', '), ($tiers -join ', '))
    }

    # A tier with no label makes Claude Code show the raw Ollama tag in its model picker.
    $unnamed = @($have | Where-Object { @($Cfg.Names.Keys) -notcontains $_ })
    if ($unnamed) {
        Write-Warning (('oclaude: Names has no label for {0}, so the picker shows the raw ' +
                        'tag.') -f ($unnamed -join ', '))
    }

    # oclaude-pull walks Derived and pulls every base model it names, so a derived tag
    # left over from the defaults downloads weights that nothing runs.
    $used   = @($Cfg.Models.Values)
    $orphan = @($Cfg.Derived.Keys | Where-Object { $used -notcontains $_ })
    if ($orphan) {
        Write-Warning (('oclaude: Derived defines {0}, which no tier uses. oclaude-pull ' +
                        'still pulls its base model, so drop the tag or point a tier at ' +
                        'it.') -f ($orphan -join ', '))
    }
}

function Get-OClaudeConfig {
    # The defaults, then the machine file, then the per-shell environment variables.
    $path     = Get-OClaudeMachineConfigPath
    $override = Read-OClaudeMachineConfig -Path $path
    $cfg      = Merge-OClaudeMachineConfig -Default (Get-OClaudeDefaultConfig) `
                                           -Override $override -Path $path
    if ($override) { Test-OClaudeConfig -Cfg $cfg -Path $path }

    # Last word, so that one shell can ask a different model for advice without editing a
    # file. An ALIAS, never a raw tag: config.ps1 says why.
    if ($env:OCLAUDE_ADVISOR) { $cfg.Advisor = $env:OCLAUDE_ADVISOR }

    # $null when no machine file loaded, which is what oclaude-status reports.
    $cfg | Add-Member -NotePropertyName MachineConfig `
                      -NotePropertyValue $(if ($override) { $path } else { $null }) `
                      -Force -PassThru
}

function oclaude-init-config {
    # Creates the machine file from config.example.ps1, then says where it is. Refuses to
    # overwrite: the file is hand-written and lives outside the repo, so there is no copy.
    [void](Test-OClaudeStale)
    $path = Get-OClaudeMachineConfigPath
    if (Test-Path -LiteralPath $path) {
        Write-Host "exists  $path" -ForegroundColor Green
        Write-Host '        Edit it, then run oclaude-status. No reload is needed.' -ForegroundColor DarkGray
        return
    }

    $example = Join-Path $global:OClaudeRoot 'config.example.ps1'
    if (-not (Test-Path -LiteralPath $example)) {
        Write-Error "oclaude: cannot find $example"
        return
    }

    $dir = Split-Path -Parent $path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Copy-Item -LiteralPath $example -Destination $path
    Write-Host "created $path" -ForegroundColor Green
    Write-Host '        A copy, not a link, so updating the repo does not change it.' -ForegroundColor DarkGray
    Write-Host '        Edit the model map in it, then run oclaude-status.' -ForegroundColor DarkGray
}

function oclaude-config-path {
    # Prints the path Get-OClaudeConfig reads, and whether anything is there. The answer
    # stops being obvious once $env:OCLAUDE_CONFIG is set in one shell and not another.
    $path  = Get-OClaudeMachineConfigPath
    $src   = if ($env:OCLAUDE_CONFIG) { '$env:OCLAUDE_CONFIG' } else { 'default path' }
    $state = if (Test-Path -LiteralPath $path) { 'present' }
             else { 'absent, so the defaults are in use' }
    Write-Host ('{0}  ({1}, {2})' -f $path, $src, $state)
}
