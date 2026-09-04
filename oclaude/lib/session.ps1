# oclaude session -- the launcher: the env block, the advisor, the claude call.
# Loaded by ../oclaude.ps1.

function Test-ArgFlag {
    # Is $Flag already in the caller's argv? -contains is an EXACT match and misses the
    # `--flag=value` form, which made oclaude prepend its default over the caller's.
    param([string[]]$Arguments, [string]$Flag)
    $rx = '^' + [regex]::Escape($Flag) + '(=|$)'
    return [bool]@($Arguments | Where-Object { "$_" -match $rx })
}

function oclaude {
    [void](Test-OClaudeStale)
    if ($args.Count -and ($args[0] -in '--help', '-h', '/?', 'help')) { oclaude-help; return }

    $cfg = Get-OClaudeConfig

    $vars = @(
        'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY',
        'ANTHROPIC_DEFAULT_OPUS_MODEL',   'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
        'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',  'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
        'ANTHROPIC_DEFAULT_FABLE_MODEL',  'ANTHROPIC_DEFAULT_FABLE_MODEL_NAME',
        'CLAUDE_CODE_SUBAGENT_MODEL', 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
        'CLAUDE_CODE_MAX_CONTEXT_TOKENS', 'CLAUDE_CODE_DISABLE_1M_CONTEXT',
        'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
        'CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS', 'CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY',
        'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'API_TIMEOUT_MS',
        'CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION', 'CLAUDE_CODE_ENABLE_AWAY_SUMMARY'
    )
    $saved = @{}
    foreach ($v in $vars) { $saved[$v] = [Environment]::GetEnvironmentVariable($v) }

    try {
        if (-not (Start-OllamaServer -Endpoint $cfg.Endpoint)) { return }

        $have = Get-OllamaModel -Endpoint $cfg.Endpoint
        foreach ($tier in $cfg.Models.Keys) {
            $model = $cfg.Models[$tier]
            # cloud tags resolve server-side, so only local models can be "missing"
            if (-not (Test-CloudModel $model) -and $have -notcontains $model) {
                Write-Host ("warn: {0} -> {1} is not pulled (run oclaude-pull)" -f $tier.ToLower(), $model) `
                    -ForegroundColor DarkYellow
            }
        }

        $env:ANTHROPIC_BASE_URL   = $cfg.Endpoint
        $env:ANTHROPIC_AUTH_TOKEN = 'ollama'
        Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue

        foreach ($tier in $cfg.Models.Keys) {
            # A tier with no label falls back to its tag, so the picker shows something
            # true rather than an empty row. Test-OClaudeConfig warns about it either way.
            $label = if ($cfg.Names[$tier]) { $cfg.Names[$tier] } else { $cfg.Models[$tier] }
            Set-Item "Env:ANTHROPIC_DEFAULT_${tier}_MODEL"      $cfg.Models[$tier]
            Set-Item "Env:ANTHROPIC_DEFAULT_${tier}_MODEL_NAME" $label
        }

        # Outranks every subagent's own model, including the advisor's, so an inherited
        # value would silently pin the advisor to the caller's tier.
        Remove-Item Env:CLAUDE_CODE_SUBAGENT_MODEL -ErrorAction SilentlyContinue
        $env:CLAUDE_CODE_MAX_OUTPUT_TOKENS            = $cfg.MaxOutputTokens
        # without this, Claude Code assumes 200k for model names it does not recognise
        $env:CLAUDE_CODE_MAX_CONTEXT_TOKENS           = $cfg.MaxContextTokens
        # MAX_CONTEXT_TOKENS alone does NOT bound a tag Claude Code does not recognise;
        # this is the knob that makes auto-compact actually fire. Without it the
        # transcript outgrows the runner and llama-server context-shifts, silently
        # dropping the oldest tokens.
        $env:CLAUDE_CODE_AUTO_COMPACT_WINDOW          = $cfg.AutoCompactWindow
        # Drops the account's [1m] marker, which advertises a window a local model does
        # not have. Config decides it, because an all-cloud map may genuinely have one.
        # Removed rather than left alone when off: an inherited value would still apply.
        if ($cfg.Disable1MContext) { $env:CLAUDE_CODE_DISABLE_1M_CONTEXT = '1' }
        else { Remove-Item Env:CLAUDE_CODE_DISABLE_1M_CONTEXT -ErrorAction SilentlyContinue }
        $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
        # Background calls DISABLE_NONESSENTIAL_TRAFFIC does not cover. Both fork the whole
        # conversation onto the MAIN LOOP model. On Anthropic that is a cache hit. Here it
        # is a real request holding the only runner slot. Both accept 0/false/no/off.
        #
        # prompt_suggestion fires after every turn and its gate is live for this account.
        # away_summary defaults ON in code, and this pins it off before a gate flip makes
        # it fire. /recap is a slash command, so it is unaffected. Auto-memory extraction
        # is the third of these and stays on deliberately.
        $env:CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION     = '0'
        $env:CLAUDE_CODE_ENABLE_AWAY_SUMMARY          = '0'
        $env:API_TIMEOUT_MS                           = $cfg.TimeoutMs
        $env:CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS       = $cfg.StreamIdleMs
        $env:CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY     = $cfg.ToolConcurrency

        # Injected per launch, so the advisor exists only in oclaude sessions: nothing
        # lands in ~/.claude/agents or a repo. Description wording is the trigger.
        $agents = @{
            advisor = [ordered]@{
                description = 'Advisor with fresh eyes on a problem. Reach for it when an ' +
                              'error survives two fixes, before committing to a plan that ' +
                              'is expensive to reverse, and before declaring a hard task ' +
                              'done. Give it the file paths and lines in question, what you ' +
                              'tried, and what you are still unsure about.'
                prompt      = @(
                    'You are asked for advice on a problem someone else is working on. You have their written summary and the repository.'
                    ''
                    'Verify against the code before you answer: open every file and line the summary names. Every claim you return cites the file and line you read it in.'
                    ''
                    'Return one decision, the evidence that settles it, and the next concrete action. You are done when the asker can act without a follow-up.'
                    ''
                    'Where the summary and the code disagree, say so and go with the code.'
                ) -join "`n"
                model       = $cfg.Advisor
            }
        }

        $ccArgs = @($args)
        if (-not (Test-ArgFlag $ccArgs '--agents')) {
            $ccArgs = @('--agents', ($agents | ConvertTo-Json -Depth 5 -Compress)) + $ccArgs
        }
        if (-not (Test-ArgFlag $ccArgs '--model')) {
            $ccArgs = @('--model', $cfg.DefaultAlias) + $ccArgs
        }
        claude @ccArgs
    }
    finally {
        foreach ($v in $vars) {
            if ($null -eq $saved[$v]) { Remove-Item "Env:$v" -ErrorAction SilentlyContinue }
            else { Set-Item "Env:$v" $saved[$v] }
        }
    }
}
