# oclaude report -- the functions that only print state.
# Loaded by ../oclaude.ps1.

function oclaude-status {
    [void](Test-OClaudeStale)
    $cfg = Get-OClaudeConfig
    $up  = Test-OllamaServer -Endpoint $cfg.Endpoint
    Write-Host ''
    Write-Host ("daemon   {0}  {1}" -f $cfg.Endpoint, $(if ($up) { 'up' } else { 'DOWN' })) `
        -ForegroundColor $(if ($up) { 'DarkGreen' } else { 'Red' })

    # The first question when a tier is not the one you expected is which file was read.
    if ($cfg.MachineConfig) {
        Write-Host ("config   {0}" -f $cfg.MachineConfig) -ForegroundColor DarkGray
    } else {
        Write-Host ("config   defaults from lib/config.ps1  (no {0})" -f (Get-OClaudeMachineConfigPath)) `
            -ForegroundColor DarkYellow
        Write-Host '         run oclaude-init-config to make one for this machine' -ForegroundColor DarkGray
    }
    $have = if ($up) { Get-OllamaModel -Endpoint $cfg.Endpoint } else { @() }
    Write-Host ''
    foreach ($tier in $cfg.Models.Keys) {
        $model = $cfg.Models[$tier]
        if (Test-CloudModel $model) {
            $state = if ($up) { Test-OllamaCloudModel -Model $model -Endpoint $cfg.Endpoint } else { 'daemon down' }
            $ok    = $state -eq 'ok'
            $clean = ($state -replace '\s+', ' ').Trim()
            $label = if ($ok) { 'cloud, access ok' }
                     else { 'cloud, ' + $clean.Substring(0, [Math]::Min(62, $clean.Length)) }
        } else {
            $ok    = $have -contains $model
            $label = if ($ok) { 'ok' } else { 'not pulled' }
        }
        Write-Host ("  {0,-7} {1,-26} {2}" -f $tier.ToLower(), $model, $label) `
            -ForegroundColor $(if ($ok) { 'Gray' } else { 'DarkYellow' })
    }
    Write-Host ("  {0,-7} {1,-30}" -f 'advisor', $cfg.Advisor) -ForegroundColor Gray
    Write-Host ''
    if ($up) {
        Write-Host 'loaded:' -ForegroundColor DarkGray
        ollama ps
    }
}

function oclaude-help {
    $cfg = Get-OClaudeConfig
    Write-Host ''
    Write-Host '  Claude Code on local Ollama models' -ForegroundColor White
    Write-Host ''
    Write-Host '  oclaude [args]' -ForegroundColor Cyan -NoNewline
    Write-Host ("            launch Claude Code (default --model {0})" -f $cfg.DefaultAlias)
    Write-Host '                            args pass straight through: -p, -c, --model, ...'
    Write-Host '  oclaude-status' -ForegroundColor Cyan -NoNewline
    Write-Host '             daemon state, per-tier model, live cloud access check'
    Write-Host '  oclaude-init-config' -ForegroundColor Cyan -NoNewline
    Write-Host '        create this machine''s config from config.example.ps1'
    Write-Host '  oclaude-config-path' -ForegroundColor Cyan -NoNewline
    Write-Host '        which config file this shell reads, and whether it exists'
    Write-Host '  oclaude-pull' -ForegroundColor Cyan -NoNewline
    Write-Host '               pull base models, then rebuild derived tags'
    Write-Host '  oclaude-build-models' -ForegroundColor Cyan -NoNewline
    Write-Host '       recreate derived tags (num_ctx + sampling params)'
    Write-Host '  oclaude-restart-daemon' -ForegroundColor Cyan -NoNewline
    Write-Host '     restart ollama with User-scope OLLAMA_* applied'
    Write-Host '  oclaude-help' -ForegroundColor Cyan -NoNewline
    Write-Host "               this text; run 'claude --help' for the CLI's own flags"
    Write-Host ''
    Write-Host '  tiers' -ForegroundColor White
    foreach ($tier in $cfg.Models.Keys) {
        $model = $cfg.Models[$tier]
        $ctx = if ($cfg.Derived.Contains($model)) { "num_ctx $($cfg.Derived[$model].NumCtx)" } else { '' }
        Write-Host ("    {0,-7} {1,-24} {2}" -f $tier.ToLower(), $model, $ctx) -ForegroundColor Gray
    }
    Write-Host ("    {0,-7} {1,-24} {2}" -f 'advisor', $cfg.Advisor, 'subagent, ask it when stuck') -ForegroundColor Gray
    Write-Host ''
    Write-Host '  notes' -ForegroundColor White
    Write-Host ("    context      Claude Code capped at {0}; must stay <= the smallest num_ctx" -f $cfg.MaxContextTokens) -ForegroundColor Gray
    Write-Host '    first turn   costs a full prefill; later turns extend the cache and are cheap' -ForegroundColor Gray
    Write-Host ('    config       {0}' -f $(if ($cfg.MachineConfig) { $cfg.MachineConfig }
                                              else { 'defaults, no machine file' })) -ForegroundColor Gray
    Write-Host ('    daemon       {0}. config.ps1 holds no daemon setting' -f
                $(if (Test-OClaudeIsWindows) { 'set User-scope OLLAMA_* variables' }
                  else { 'set OLLAMA_* in the service drop-in, or in this shell' })) -ForegroundColor Gray
    Write-Host '    advisor      $env:OCLAUDE_ADVISOR overrides its model per shell (use an alias)' -ForegroundColor Gray
    Write-Host ("    waits        {0}s byte-idle, {1} tool calls at once (ollama serves 1 per model)" -f ($cfg.StreamIdleMs / 1000), $cfg.ToolConcurrency) -ForegroundColor Gray
    Write-Host ''
}
