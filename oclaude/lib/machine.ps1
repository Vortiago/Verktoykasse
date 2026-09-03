# oclaude machine -- the per-machine config file, and how it combines with the
# defaults in config.ps1. Loaded by ../oclaude.ps1.
#
# One rule: a key in the machine file REPLACES that key outright. Nothing merges inside
# a key, so a file that sets Models must list all four tiers.

function Get-OClaudeMachineConfigPath {
    # One path on every platform, so the docs can name it. $env:OCLAUDE_CONFIG wins,
    # which is how one shell tries a map without moving files.
    if ($env:OCLAUDE_CONFIG) { return $env:OCLAUDE_CONFIG }
    Join-Path (Join-Path (Join-Path $HOME '.config') 'oclaude') 'config.ps1'
}

function Read-OClaudeMachineConfig {
    # The machine file's hashtable, or $null when there is none.
    #
    # & rather than dot-source, for two reasons. A child scope cannot redefine the
    # functions this shell loaded. And this re-runs the file every call, so an edit needs
    # no profile reload. Hence Test-OClaudeStale ignores this file.
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }

    try { $result = & $Path }
    catch {
        Write-Warning (('oclaude: {0} failed to run -- {1}. Falling back to the defaults.') -f
                       $Path, $_.Exception.Message)
        return $null
    }

    # A stray expression writes to the pipeline too, so the result can be an array.
    # Name that case. The symptom is a map that looks ignored.
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

    # An unknown key does nothing at all, the hardest kind of typo to see. The config
    # object's own property list is the authority, so this cannot go stale.
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
    # What replacing a whole key gets wrong. Every entry point calls Get-OClaudeConfig
    # once, so this runs once per command and needs no latch.
    param([Parameter(Mandatory)]$Cfg, [string]$Path)

    # Claude Code's environment contract fixes these four, not the map.
    $tiers = @('OPUS', 'SONNET', 'HAIKU', 'FABLE')
    $have  = @($Cfg.Models.Keys)

    # A tier missing from a replaced Models has no model behind it, and the CLI then
    # sends the tier name itself as the model.
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

    # With no label, Claude Code's model picker shows the raw Ollama tag.
    $unnamed = @($have | Where-Object { @($Cfg.Names.Keys) -notcontains $_ })
    if ($unnamed) {
        Write-Warning (('oclaude: Names has no label for {0}, so the picker shows the raw ' +
                        'tag.') -f ($unnamed -join ', '))
    }
}

function Test-OClaudeContextCap {
    # An invariant of the values, not of whole-key replacement, so it runs even with no
    # machine file. The defaults are still config, and a check that never sees them has a
    # blind spot by construction.
    #
    # Disable1MContext caps where the CLI COMPACTS, so AutoCompactWindow is the key it
    # binds. MaxContextTokens sits above it in the defaults on purpose.
    param([Parameter(Mandatory)]$Cfg)
    if ($Cfg.Disable1MContext -and $Cfg.AutoCompactWindow -gt 200000) {
        Write-Warning (('oclaude: AutoCompactWindow is {0} while Disable1MContext is on, ' +
                        'which asserts a 200000 ceiling. Lower it, or turn the flag off ' +
                        'and raise MaxContextTokens with it.') -f $Cfg.AutoCompactWindow)
    }
}

function Get-OClaudeConfig {
    # The defaults, then the machine file, then this shell's environment.
    $path     = Get-OClaudeMachineConfigPath
    $override = Read-OClaudeMachineConfig -Path $path
    $cfg      = Merge-OClaudeMachineConfig -Default (Get-OClaudeDefaultConfig) `
                                           -Override $override -Path $path
    # Nothing to say about replacement when no machine file loaded. The cap holds anyway.
    if ($override) { Test-OClaudeConfig -Cfg $cfg -Path $path }
    Test-OClaudeContextCap -Cfg $cfg

    # Last word, so one shell can pick a different advisor without editing a file.
    if ($env:OCLAUDE_ADVISOR) { $cfg.Advisor = $env:OCLAUDE_ADVISOR }

    # $null when no machine file loaded. Get-OClaudeConfigState reads it.
    $cfg | Add-Member -NotePropertyName MachineConfig `
                      -NotePropertyValue $(if ($override) { $path } else { $null }) `
                      -Force -PassThru
}

function Get-OClaudeConfigState {
    # One answer to "which config is this shell running", shared by every printer.
    # Exists and Loaded differ for a file that is there but threw. Calling that "no
    # machine file" sends someone hunting for a file they are looking straight at.
    #
    # Pass -Cfg when you hold one. The default resolves the config itself, which is what
    # oclaude-config-path wants: that run is what emits the warning it points at.
    param($Cfg = (Get-OClaudeConfig))
    $path   = Get-OClaudeMachineConfigPath
    $exists = [bool](Test-Path -LiteralPath $path)
    $loaded = [bool]$Cfg.MachineConfig

    # Description never names the file. Summary is the one-line form for a printer whose
    # subject is the path. Apart, they stop config-path printing the path twice.
    $description = if ($loaded) { 'loaded' }
                   elseif ($exists) { 'present, but it did not load (see the warning above)' }
                   else { 'not present, so the defaults in lib/config.ps1 are in use' }

    [pscustomobject]@{
        Path        = $path
        Source      = if ($env:OCLAUDE_CONFIG) { '$env:OCLAUDE_CONFIG' } else { 'default path' }
        Exists      = $exists
        Loaded      = $loaded
        Description = $description
        Summary     = if ($loaded) { $path } else { '{0}  ({1})' -f $path, $description }
    }
}

function oclaude-init-config {
    # Creates the machine file from config.example.ps1. Never overwrites: the file is
    # hand-written and outside the repo, so no copy of it exists.
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
    # Which file this shell reads, and what became of it. Not obvious once
    # $env:OCLAUDE_CONFIG is set in one shell and not another. Resolving the config here
    # is the point: a file that fails to load warns as it does so.
    $state = Get-OClaudeConfigState
    Write-Host ('{0}  ({1})' -f $state.Path, $state.Source)
    Write-Host ('  {0}' -f $state.Description) `
        -ForegroundColor $(if ($state.Loaded) { 'DarkGray' } else { 'DarkYellow' })
}
