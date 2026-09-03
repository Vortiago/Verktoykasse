# oclaude config -- the DEFAULT model map and every tunable.
# Loaded by ../oclaude.ps1.
#
# This file is committed, so it holds one machine's map as a worked example. Do not
# edit it to configure your own machine. Write ~/.config/oclaude/config.ps1 instead,
# which sits outside the repo and overrides any key here. `oclaude-init-config` creates
# it from config.example.ps1. lib/machine.ps1 explains how the two combine.
#
# The map below is a Ryzen APU with 128 GiB of shared memory, which is why every chat
# tier is local. config.example.ps1 is the other worked example: a mostly-cloud map.

function Get-OClaudeDefaultConfig {
    # ---- model map ------------------------------------------------------------
    # Tiers point at derived tags, not base models: the tray forces
    # OLLAMA_CONTEXT_LENGTH=262144, at which only one model fits. The per-tag
    # `PARAMETER num_ctx` in $derived is what lets several stay resident.
    $models = [ordered]@{
        OPUS   = 'cc-chat-35b-q8'            # the only tier that answers you. DefaultAlias is
                                             #   'opus', so this runs plan AND execution
        SONNET = 'cc-fast-8b'                # NOT a chat tier: the permission auto-mode
                                             #   classifier. C7() probes the SONNET alias first,
                                             #   so whatever sits here decides which tool calls
                                             #   run without asking. ~99% prefill, which is why
                                             #   ACTIVE params are what matter
        HAIKU  = 'cc-fast-8b'                # background traffic; keeps it off the 35B's runner
        FABLE  = 'nemotron-3-ultra:cloud'    # cloud, free tier. glm-5.2:cloud is 403 without
                                             #   a subscription
    }
    # derived tag -> base model + pinned context. Rebuild with oclaude-build-models.
    #
    # Context is nearly free here (one KV layer, 40 recurrent), so the 35B's ~41 GiB
    # resident is almost all weights. A second runner of the same tag is therefore
    # expensive, and the scheduler clamps its budget to free SYSTEM RAM.
    #
    # Params are Qwen's "precise coding" preset. Do not restore Ollama's default
    # presence_penalty 1.5, which fights the exact repetition file paths need. Measured
    # and rejected: use_mmap false gives the same free memory and a slower load.
    $derived = [ordered]@{
        'cc-chat-35b-q8' = @{
            From   = 'qwen3.6:35b-a3b-mtp-q8_0'
            NumCtx = 262144   # the model's full trained window
            Params = [ordered]@{ temperature = 0.6; top_p = 0.95; top_k = 20
                                 min_p = 0.0; presence_penalty = 0.0; repeat_penalty = 1.0 }
        }
        # SONNET/HAIKU: LFM2.5-8B-A1B, chosen on IFEval and non-hallucination rate rather
        # than size. A dense 4B loses, because 4B ACTIVE is MORE per-token work than the
        # 35B-A3B's 3B active. num_ctx is the model maximum: the classifier's prompt grows
        # with the transcript, and overflowing it stops it gating tool calls. Params are the
        # vendor defaults from the model card.
        'cc-fast-8b'       = @{
            From   = 'lfm2.5:8b-a1b-q8_0'
            NumCtx = 128000
            Params = [ordered]@{ temperature = 0.2; top_k = 80; repeat_penalty = 1.05 }
        }
        # A tag no tier points at is neither built nor pulled, so a spec left here for
        # a model you are not running today costs nothing.
    }
    $names = [ordered]@{
        OPUS   = 'Qwen3.6 35B-A3B q8 256k (local)'
        SONNET = 'LFM2.5 8B-A1B q8 128k (local, permission classifier)'
        HAIKU  = 'LFM2.5 8B-A1B q8 128k (local, background)'
        FABLE  = 'Nemotron 3 Ultra 550B (cloud)'
    }
    # The advisor subagent's model. Get-OClaudeConfig applies $env:OCLAUDE_ADVISOR over
    # this, so the per-shell variable outranks the machine file.
    #
    # Never use a raw Ollama tag. Use an ALIAS: fable, opus, sonnet or haiku. An
    # unresolvable subagent model falls back to the CALLER's with no error, so a typo
    # makes the advisor the very model that asked for advice.
    $advisor = 'fable'
    # --------------------------------------------------------------------------

    [pscustomobject]@{
        Endpoint        = 'http://localhost:11434'
        Models          = $models
        Names           = $names
        Derived         = $derived
        Advisor         = $advisor         # NOT CLAUDE_CODE_SUBAGENT_MODEL: that overrides
                                           #   every agent definition, so oclaude clears it
        DefaultAlias    = 'opus'           # NOT 'opusplan', which runs execution on the
                                           #   SONNET tier, that is, the 8B classifier

        # Daemon settings are NOT here. They only applied where oclaude started the
        # daemon itself, and the tray application starts it first and ignores them. A
        # setting that works sometimes is worse than none.
        #
        # Set the User-scope OLLAMA_* settings instead, which hold for whoever starts
        # the daemon. oclaude-restart-daemon re-reads them and reports what it applied.
        # OLLAMA_CONTEXT_LENGTH is why the per-tag num_ctx pins above exist: one
        # daemon-wide window sized for the largest model leaves room for that one only.

        MaxContextTokens = 262144          # one global value, so at most the SMALLEST num_ctx
                                           #   among the TIERS, or Claude Code overfills that
                                           #   tier and Ollama truncates silently. Do not also
                                           #   subtract MaxOutputTokens: the CLI already
                                           #   reserves room for the reply
        MaxOutputTokens = 32000
        Disable1MContext = $true           # drops the account's [1m] marker, which advertises
                                           #   a window a local model does not have. Set it
                                           #   $false only when every tier that receives the
                                           #   transcript holds more than 200000. Then raise
                                           #   MaxContextTokens and AutoCompactWindow with
                                           #   it, since leaving them buys nothing
        AutoCompactWindow = 200000         # where Claude Code COMPACTS, deliberately below
                                           #   num_ctx so the runner never context-shifts.
                                           #   200000 is the CEILING WHILE Disable1MContext
                                           #   is on, not a constant: that flag asserts 200K,
                                           #   and a larger value then trips the CLI's
                                           #   "window_above_boundary" path. Turn the flag off
                                           #   and this rises to whatever the tiers hold,
                                           #   which is what a cloud map wants
        StreamIdleMs    = 900000           # oclaude counts as 'firstParty', which hardcodes a
                                           #   3 min byte-idle timeout. A queued request emits
                                           #   nothing, so that fires and the CLIENT disconnects.
                                           #   Only CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS overrides
                                           #   it (CLAUDE_STREAM_IDLE_TIMEOUT_MS is a different
                                           #   branch). The CLI clamps it to 10s..30min
        ToolConcurrency = 2                # ollama serves one request per LOCAL model, so the
                                           #   default 10 queue and risk the idle timeout.
                                           #   This pool QUEUES rather than refusing. Capping
                                           #   CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS instead
                                           #   would refuse the spawn outright
        TimeoutMs       = 600000           # local prefill on big prompts is slow
    }
}
