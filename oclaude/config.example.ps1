# oclaude machine config -- the template oclaude-init-config copies.
#
# Copy this to ~/.config/oclaude/config.ps1. Edit your copy: oclaude reads nothing from
# the repo. `oclaude-config-path` says which file this shell reads. oclaude reads it
# fresh on every command, so an edit needs no reload.
#
# The file must END with a hashtable. Each key REPLACES that key in lib/config.ps1
# outright, so Models must list all four tiers. oclaude warns about a tier left out, a
# tier with no label, and a key it does not recognise.
#
# This is the repo's second worked map: a laptop, so the chat tiers are cloud and only
# the background tier is local. lib/config.ps1 is the first, an APU with the memory to
# run every tier locally. Neither is a recommendation.

@{
    # ---- model map ------------------------------------------------------------
    # `ollama list` shows what is pulled. A `:cloud` tag resolves server-side and is
    # never pulled, so oclaude-status sends it a one-token request to prove access.
    Models = [ordered]@{
        OPUS   = 'glm-5.3-flash:cloud'   # the only tier that answers you, since
                                         #   DefaultAlias is 'opus'. The smaller, faster
                                         #   GLM 5.3, because the main loop is what you
                                         #   wait for
        SONNET = 'qwen3.5:cloud'         # NOT a chat tier. It is the permission
                                         #   classifier, so whatever sits here decides
                                         #   which tool calls run without asking. A
                                         #   different vendor from OPUS on purpose
        HAIKU  = 'cc-fast-8b'            # background traffic, and the one local tier.
                                         #   Local keeps the small constant calls off
                                         #   the network
        FABLE  = 'glm-5.3:cloud'         # the big GLM 5.3, and the advisor subagent.
                                         #   Slow is fine: you ask it when stuck
    }
    Names = [ordered]@{
        OPUS   = 'GLM 5.3 Flash (cloud)'
        SONNET = 'Qwen3.5 (cloud, permission classifier)'
        HAIKU  = 'LFM2.5 8B-A1B q8 128k (local, background)'
        FABLE  = 'GLM 5.3 (cloud)'
    }

    # ---- derived tags ---------------------------------------------------------
    # A derived tag pins num_ctx and the sampling parameters on top of a base model. It
    # references the base model's blobs, so it costs a manifest, not a copy. After an
    # edit, run oclaude-build-models to rebuild.
    #
    # Only the local tier needs one. oclaude builds only a tag some tier points at, so
    # dropping the default's cc-chat-35b-q8 spec here changes nothing either way.
    #
    # LFM2.5-8B-A1B is chosen on IFEval and non-hallucination rate rather than size, and
    # 1B ACTIVE is what makes it usable with no GPU to spare. NumCtx is the model
    # maximum. Params are the vendor defaults from the model card.
    Derived = [ordered]@{
        'cc-fast-8b' = @{
            From   = 'lfm2.5:8b-a1b-q8_0'
            NumCtx = 128000
            Params = [ordered]@{ temperature = 0.2; top_k = 80; repeat_penalty = 1.05 }
        }
    }

    # ---- tunables -------------------------------------------------------------
    # Anything not listed here keeps its value in lib/config.ps1, which carries the
    # reasoning. This map leaves StreamIdleMs and TimeoutMs alone.

    # Claude Code holds ONE cap for every tier, so the honest ceiling is the smallest
    # window among them. Measured on the daemon: both GLM tags hold 1048576, qwen3.5
    # holds 262144, the local lfm2.5 holds 128000. This is qwen3.5's, the smallest CLOUD
    # window, so OPUS, SONNET and FABLE all sit inside their real limit.
    #
    # HAIKU is the one tier left below the cap, on purpose. It takes small background
    # calls rather than the session, and oclaude-build-models prints a note naming it.
    # If you want nothing below the cap, move HAIKU to a cloud tag.
    MaxContextTokens  = 262144
    AutoCompactWindow = 240000   # under the cap, so compaction has room to run before
                                 #   the session reaches it

    # OFF, because the 1M marker is honest for the cloud tiers here. While it is on it
    # pins the session to 200000, which would make the two values above unusable: the
    # CLI trips window_above_boundary once AutoCompactWindow passes 200000.
    Disable1MContext = $false

    # The default 2 exists because Ollama serves one request per LOCAL model at a time.
    # A cloud tag has no such limit, and three of the four tiers here are cloud.
    ToolConcurrency = 6
}
