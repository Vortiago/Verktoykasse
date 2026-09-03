# oclaude machine config -- the template oclaude-init-config copies.
#
# Copy this to ~/.config/oclaude/config.ps1, then edit it. Nothing is read from the
# repo: this file is a starting point, and your copy is yours.
#
# The file must END with a hashtable. Every key in it REPLACES the matching key in
# lib/config.ps1 outright, and nothing merges inside a key. So Models must list all
# four tiers, and Derived must list every tag you want built. oclaude warns at launch
# about a tier left out, a tag no tier uses, and a key it does not recognise.
#
# Run `oclaude-config-path` to see which file this shell reads. It is read fresh on
# every command, so an edit takes effect on the next `oclaude` with no reload.
#
# This example is the second of the repo's two worked maps: a laptop, so the chat tiers
# are cloud and only the background tier is local. lib/config.ps1 is the first, an APU
# with enough memory to run every tier locally. Neither is a recommendation.

@{
    # ---- model map ------------------------------------------------------------
    # `ollama list` shows what is pulled. A `:cloud` tag resolves server-side and is
    # never pulled, so oclaude-status sends it a one-token request to prove access.
    Models = [ordered]@{
        OPUS   = 'glm-5.3-flash:cloud'   # the only tier that answers you. DefaultAlias
                                         #   is 'opus', so this runs plan AND execution.
                                         #   The smaller, faster GLM 5.3, because the
                                         #   main loop is what you wait for
        SONNET = 'qwen3.5:cloud'         # NOT a chat tier: the permission auto-mode
                                         #   classifier, so whatever sits here decides
                                         #   which tool calls run without asking. A
                                         #   different vendor from OPUS on purpose, so
                                         #   one model's blind spot is not both
        HAIKU  = 'cc-fast-8b'            # background traffic, and the one local tier.
                                         #   Local keeps the small constant calls off
                                         #   the network and off the plan
        FABLE  = 'glm-5.3:cloud'         # the big GLM 5.3, and the advisor subagent's
                                         #   model. Slow is acceptable here: you ask it
                                         #   when stuck, not once a turn
    }
    Names = [ordered]@{
        OPUS   = 'GLM 5.3 Flash (cloud)'
        SONNET = 'Qwen3.5 (cloud, permission classifier)'
        HAIKU  = 'LFM2.5 8B-A1B q8 128k (local, background)'
        FABLE  = 'GLM 5.3 (cloud)'
    }

    # ---- derived tags ---------------------------------------------------------
    # A derived tag pins num_ctx and the sampling parameters on top of a base model. It
    # references the base model's blobs, so it costs a manifest rather than a copy.
    # Rebuild after an edit with oclaude-build-models.
    #
    # Only the local tier needs one. Listing this key at all drops the default's
    # cc-chat-35b-q8, which is the point: oclaude-pull walks Derived and would otherwise
    # fetch a 35B nothing here runs.
    #
    # LFM2.5-8B-A1B is picked on IFEval and non-hallucination rate rather than size, and
    # 1B ACTIVE is what makes it usable with no GPU to spare. num_ctx is the model
    # maximum. Params are the vendor defaults from the model card.
    Derived = [ordered]@{
        'cc-fast-8b' = @{
            From   = 'lfm2.5:8b-a1b-q8_0'
            NumCtx = 128000
            Params = [ordered]@{ temperature = 0.2; top_k = 80; repeat_penalty = 1.05 }
        }
    }

    # ---- tunables -------------------------------------------------------------
    # Everything not listed here keeps the value in lib/config.ps1, which carries the
    # reasoning for each one. StreamIdleMs and TimeoutMs are deliberately left alone:
    # they are generous for a cloud tier and still needed by the local one.

    # Both GLM tags report a 1M window, but Disable1MContext caps the session at 200K,
    # so this is the whole of it. Raising the pair together is the only way to use more,
    # and then the local HAIKU tier truncates a background call in silence.
    MaxContextTokens  = 200000
    AutoCompactWindow = 170000   # below the cap, so compaction has room to run before
                                 #   the session reaches it

    # Left ON even though every chat tier here has a 1M window. Turning it off asserts a
    # window the local tier does not have, and buys nothing until MaxContextTokens and
    # AutoCompactWindow rise with it.
    Disable1MContext = $true

    # The default 2 exists because Ollama serves one request per LOCAL model at a time.
    # A cloud tag has no such limit, and three of the four tiers here are cloud.
    ToolConcurrency = 6
}
