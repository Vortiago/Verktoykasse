# oclaude machine -- the per-machine config file: where it lives, and how it combines
# with the defaults in config.ps1. Loaded by ../oclaude.ps1.
#
# One rule, so that there is nothing to remember: a key present in the machine file
# REPLACES the default value for that key outright. Nothing merges inside a key. So a
# machine file that sets Models must list all four tiers. Test-OClaudeConfig below warns
# about the mistakes that rule makes possible.

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
    param([Parameter(Mandatory)][string]$Path)
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
    # Warns about what replacing a whole key gets wrong. Every entry point calls
    # Get-OClaudeConfig exactly once, so this runs once per command with no latch.
    param([Parameter(Mandatory)]$Cfg, [string]$Path)

    # The four are fixed by Claude Code's own environment contract, not by the map.
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

    # DISABLE_1M_CONTEXT asserts a 200K ceiling in the CLI, and a larger value trips its
    # window_above_boundary path. config.ps1 says so in prose. This is the check.
    if ($Cfg.Disable1MContext) {
        foreach ($key in 'MaxContextTokens', 'AutoCompactWindow') {
            if ($Cfg.$key -gt 200000) {
                Write-Warning (('oclaude: {0} is {1} while Disable1MContext is on, which ' +
                                'asserts a 200000 ceiling. Lower it, or turn the flag off ' +
                                'and raise both together.') -f $key, $Cfg.$key)
            }
        }
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

    # $null when no machine file loaded, which is what Get-OClaudeConfigState reads.
    $cfg | Add-Member -NotePropertyName MachineConfig `
                      -NotePropertyValue $(if ($override) { $path } else { $null }) `
                      -Force -PassThru
}

function Get-OClaudeConfigState {
    # One answer to "which config is this shell running", for every printer to share.
    # Exists and Loaded differ for a file that is there but threw, or that returned no
    # hashtable. Reporting that as "no machine file" is what sends someone hunting for a
    # file they are looking straight at.
    param($Cfg = (Get-OClaudeConfig))
    $path   = Get-OClaudeMachineConfigPath
    $exists = [bool](Test-Path -LiteralPath $path)
    $loaded = [bool]$Cfg.MachineConfig

    [pscustomobject]@{
        Path   = $path
        Source = if ($env:OCLAUDE_CONFIG) { '$env:OCLAUDE_CONFIG' } else { 'default path' }
        Exists = $exists
        Loaded = $loaded
        Description = if ($loaded) { $path }
                      elseif ($exists) { "$path is present but did not load (see the warning above)" }
                      else { "defaults from lib/config.ps1 (no $path)" }
    }
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
    # Prints the file this shell reads and what became of it. The answer stops being
    # obvious once $env:OCLAUDE_CONFIG is set in one shell and not another. Running the
    # config here is the point: a file that fails to load warns as it does so.
    $state = Get-OClaudeConfigState
    Write-Host ('{0}  ({1})' -f $state.Path, $state.Source)
    Write-Host ('  {0}' -f $state.Description) `
        -ForegroundColor $(if ($state.Loaded) { 'Gray' } else { 'DarkYellow' })
}
