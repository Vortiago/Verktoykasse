# oclaude config -- the default model map and every tunable.
# Loaded by ../oclaude.ps1.
#
# These are defaults, not recommendations. Models change monthly and machines differ,
# so treat the map below as one worked example. To configure your own machine, write
# ~/.config/oclaude/config.ps1 rather than editing this file. `oclaude-init-config`
# creates it from config.example.ps1, and lib/machine.ps1 explains how the two combine.

function Get-OClaudeDefaultConfig {
    # ---- model map ------------------------------------------------------------
    # What each tier is FOR. A tier can point at a derived tag or straight at a model.
    #
    #   OPUS     the session, since DefaultAlias is 'opus'. The only tier that answers you
    #   SONNET   the permission classifier, NOT a chat tier. Whatever sits here decides
    #            which tool calls run without asking
    #   HAIKU    background traffic
    #   FABLE    the advisor subagent
    $models = [ordered]@{
        OPUS   = 'cc-chat-35b-q8'
        SONNET = 'cc-fast-8b'
        HAIKU  = 'cc-fast-8b'
        FABLE  = 'nemotron-3-ultra:cloud'
    }

    # derived tag -> base model, a pinned num_ctx and sampling params. Rebuild with
    # oclaude-build-models. Without a pin, every model loads at the daemon-wide
    # OLLAMA_CONTEXT_LENGTH, and at a large value only one fits in memory.
    #
    # oclaude builds and pulls only a tag some tier points at. For Params, start from
    # the model card's own values.
    $derived = [ordered]@{
        'cc-chat-35b-q8' = @{
            From   = 'qwen3.6:35b-a3b-mtp-q8_0'
            NumCtx = 262144
            Params = [ordered]@{ temperature = 0.6; top_p = 0.95; top_k = 20
                                 min_p = 0.0; presence_penalty = 0.0; repeat_penalty = 1.0 }
        }
        'cc-fast-8b'     = @{
            From   = 'lfm2.5:8b-a1b-q8_0'
            NumCtx = 128000
            Params = [ordered]@{ temperature = 0.2; top_k = 80; repeat_penalty = 1.05 }
        }
    }

    # What Claude Code's model picker shows.
    $names = [ordered]@{
        OPUS   = 'Qwen3.6 35B-A3B q8 256k (local)'
        SONNET = 'LFM2.5 8B-A1B q8 128k (local, permission classifier)'
        HAIKU  = 'LFM2.5 8B-A1B q8 128k (local, background)'
        FABLE  = 'Nemotron 3 Ultra 550B (cloud)'
    }

    # An ALIAS (fable / opus / sonnet / haiku), never a raw Ollama tag: an unresolvable
    # subagent model falls back to the CALLER's with no error, which makes the advisor
    # the very model that asked. $env:OCLAUDE_ADVISOR overrides this per shell.
    $advisor = 'fable'
    # --------------------------------------------------------------------------

    [pscustomobject]@{
        Endpoint        = 'http://localhost:11434'
        Models          = $models
        Names           = $names
        Derived         = $derived
        Advisor         = $advisor         # NOT CLAUDE_CODE_SUBAGENT_MODEL, which overrides
                                           #   every agent definition, so oclaude clears it
        DefaultAlias    = 'opus'           # NOT 'opusplan', which runs execution on SONNET

        # Daemon settings are not here. Whatever starts the daemon supplies them, and
        # that is not always oclaude, so set the User-scope OLLAMA_* settings instead.
        # oclaude-restart-daemon re-reads them and reports what it applied.

        # The next three move together. Claude Code applies ONE cap to every tier, so
        # the cap belongs at the smallest tier window. Above it, the CLI overfills the
        # smaller tiers and Ollama truncates with no error.
        MaxContextTokens = 262144          # do not subtract MaxOutputTokens: the CLI
                                           #   already reserves room for the reply
        Disable1MContext = $true           # drops the account's [1m] marker. While on, it
                                           #   caps AutoCompactWindow at 200000
        AutoCompactWindow = 200000         # where the CLI COMPACTS. Keep it under the cap,
                                           #   and under 200000 while the flag above is on:
                                           #   more trips "window_above_boundary"

        MaxOutputTokens = 32000
        StreamIdleMs    = 900000           # oclaude counts as 'firstParty', which hardcodes
                                           #   a 3 min byte-idle timeout. A queued request
                                           #   emits nothing, so that fires and the CLIENT
                                           #   disconnects. Only
                                           #   CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS overrides
                                           #   it, clamped to 10s..30min
        ToolConcurrency = 2                # ollama serves one request per LOCAL model, so
                                           #   more only queue and risk the idle timeout.
                                           #   This pool QUEUES rather than refusing
        TimeoutMs       = 600000
    }
}
