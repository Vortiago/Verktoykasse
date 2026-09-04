# oclaude machine config -- the template oclaude-init-config copies.
#
# Copy this to ~/.config/oclaude/config.ps1 and edit your copy. `oclaude-status` says
# which file this shell reads. oclaude reads it fresh on every command, so an edit needs
# no reload.
#
# The file must END with a hashtable. Each key REPLACES that key in lib/config.ps1
# outright, so Models must list all four tiers. oclaude warns about a tier left out, a
# tier with no label, and a key it does not recognise.
#
# This map is a laptop: cloud chat tiers, one small local tier. lib/config.ps1 is the
# other worked example, a machine with the memory to run every tier locally.

@{
    # A `:cloud` tag resolves server-side and is never pulled. oclaude-status sends it a
    # one-token request to prove access.
    Models = [ordered]@{
        OPUS   = 'glm-5.3-flash:cloud'
        SONNET = 'qwen3.5:cloud'
        HAIKU  = 'cc-fast-8b'
        FABLE  = 'glm-5.3:cloud'
    }
    Names = [ordered]@{
        OPUS   = 'GLM 5.3 Flash (cloud)'
        SONNET = 'Qwen3.5 (cloud, permission classifier)'
        HAIKU  = 'LFM2.5 8B-A1B q8 128k (local, background)'
        FABLE  = 'GLM 5.3 (cloud)'
    }

    # Only a local tier needs a derived tag. Listing this key drops the default's other
    # spec, though oclaude builds only what a tier points at either way.
    Derived = [ordered]@{
        'cc-fast-8b' = @{
            From   = 'lfm2.5:8b-a1b-q8_0'
            NumCtx = 128000
            Params = [ordered]@{ temperature = 0.2; top_k = 80; repeat_penalty = 1.05 }
        }
    }

    # Anything not listed here keeps its lib/config.ps1 value.
    #
    # One cap covers every tier, so this sits at the smallest CLOUD window here. HAIKU is
    # local and below it on purpose, and oclaude-build-models prints a note naming it.
    # Move HAIKU to a cloud tag if you want nothing below the cap.
    MaxContextTokens  = 262144
    AutoCompactWindow = 240000
    Disable1MContext  = $false   # off, because the 1M marker is honest for these tiers.
                                 #   On, it would cap AutoCompactWindow at 200000

    ToolConcurrency = 6          # the default 2 is for a local main loop, which serves
                                 #   one request at a time. Cloud tiers do not
}
