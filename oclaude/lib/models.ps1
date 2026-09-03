# oclaude models -- the model store, and the derived tags that pin num_ctx.
# Loaded by ../oclaude.ps1.

function Test-CloudModel {
    # Cloud tags resolve server-side, so they are never "not pulled". Three call sites.
    param([string]$Model)
    return [bool]($Model -match '(:|-)cloud$')
}

function Get-OClaudeLocalModel {
    # The tags this map runs locally: every tier model that is not a cloud tag. A derived
    # tag name is one of these, because a tier points at the TAG and not at its base
    # model. One list therefore answers three questions -- what to pull, what to build,
    # and what proves the daemon is serving your model store.
    param([Parameter(Mandatory)]$Cfg)
    # Wrapped, because Sort-Object returns a scalar for a one-model map and every caller
    # asks it for .Count or -contains.
    @(@($Cfg.Models.Values | Where-Object { -not (Test-CloudModel $_) }) | Sort-Object -Unique)
}

function Get-OClaudeDerivedTagInUse {
    # The derived tags some tier points at: what to build, and whose bases to pull. Both
    # loops asked this question with their own copy of the filter, held in step by a
    # comment. Widening what counts as in use now lands in one place.
    param([Parameter(Mandatory)]$Cfg)
    $local = Get-OClaudeLocalModel -Cfg $Cfg
    @($Cfg.Derived.Keys | Where-Object { $local -contains $_ })
}

function Get-OClaudeNumCtx {
    # The num_ctx pinned behind a tag, or nothing when the tier names a base model
    # directly and so has no pin. Three callers asked this with a Contains test and a
    # double subscript.
    param([Parameter(Mandatory)]$Cfg, [string]$Model)
    if ($Model -and $Cfg.Derived.Contains($Model)) { $Cfg.Derived[$Model].NumCtx }
}

function Get-OllamaModel {
    # Both tagged and bare names: /api/tags reports "cc-chat-35b-q8:latest" while the
    # model map spells it "cc-chat-35b-q8". Either form is valid to send to the API.
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint)
    try {
        $names = @((Invoke-RestMethod -Uri "$Endpoint/api/tags" -TimeoutSec 20 -NoProxy).models.name)
        @($names) + @($names | ForEach-Object { $_ -replace ':latest$', '' }) | Sort-Object -Unique
    }
    catch { @() }
}

function Test-OllamaCloudModel {
    # Cloud models serve without being pulled, so a 1-token request is the only
    # honest test of plan access.
    param([Parameter(Mandatory)][string]$Model, [string]$Endpoint = (Get-OClaudeConfig).Endpoint)
    $body = @{ model = $Model; max_tokens = 1; messages = @(@{ role = 'user'; content = 'hi' }) } |
        ConvertTo-Json -Depth 5 -Compress
    try {
        $null = Invoke-RestMethod -Uri "$Endpoint/v1/messages" -Method Post -ContentType 'application/json' `
            -Body $body -TimeoutSec 120 -NoProxy
        'ok'
    } catch {
        $detail = $_.ErrorDetails.Message
        if ($detail) {
            try { return ($detail | ConvertFrom-Json).error.message } catch { return $detail }
        }
        $_.Exception.Message
    }
}

function oclaude-build-models {
    # (Re)create the derived tags that pin num_ctx. Cheap: they reference the base
    # model's existing blobs, so a tag costs a manifest, not a copy. The stale check
    # matters most here -- this is what you run right after editing $derived.
    [void](Test-OClaudeStale)
    Build-OClaudeDerivedTag -Cfg (Get-OClaudeConfig)
}

function Build-OClaudeDerivedTag {
    # The body of oclaude-build-models, minus the entry-point work. oclaude-pull ends
    # by building the tags too, and calling the entry point would re-run the stale
    # check and rebuild the config it already holds.
    param([Parameter(Mandatory)]$cfg)
    if (-not (Start-OllamaServer -Endpoint $cfg.Endpoint)) { return }

    # Only the tags a tier points at. A spec nothing runs costs nothing, so Derived can
    # carry a model you are not using today without building or pulling its weights.
    $tags = Get-OClaudeDerivedTagInUse -Cfg $cfg
    if (-not $tags) { Write-Host 'no derived tag is in use' -ForegroundColor DarkGray }

    foreach ($tag in $tags) {
        $spec = $cfg.Derived[$tag]
        $file = Join-Path ([System.IO.Path]::GetTempPath()) "Modelfile.$tag"
        $lines = @("FROM $($spec.From)", "PARAMETER num_ctx $($spec.NumCtx)")
        if ($spec.Params) {
            foreach ($k in $spec.Params.Keys) { $lines += "PARAMETER $k $($spec.Params[$k])" }
        }
        Set-Content -Path $file -Value $lines -Encoding ascii
        Write-Host ("building {0} from {1} at num_ctx {2}" -f $tag, $spec.From, $spec.NumCtx) `
            -ForegroundColor DarkYellow
        ollama create $tag -f $file | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Error "failed to build $tag" }
        Remove-Item $file -ErrorAction SilentlyContinue
    }

    # Claude Code holds ONE context cap and applies it to every tier, so any tier whose
    # pin sits below that cap can be handed more than it holds. Which matters how much
    # depends on the tier, so this says two different things.
    #
    # The MAIN LOOP tier, the one DefaultAlias resolves to, holds the session itself.
    # Overfilling it loses the conversation, so that is a warning. Warn only when the cap
    # EXCEEDS the pin: below it is a valid choice.
    #
    # Every other tier reads a SLICE of a transcript that grows to the auto-compact
    # window, so the window is the honest bound for them. Overflow there is not a crash,
    # but a classifier that stops answering is one that stops gating tool calls, and a
    # background call that truncates does so with no error anywhere. This used to name
    # SONNET alone, which said nothing about a local HAIKU tier under a cloud main loop.
    $mainTier = if ($cfg.DefaultAlias -match 'opus') { 'OPUS' } else { $cfg.DefaultAlias.ToUpper() }
    foreach ($tier in $cfg.Models.Keys) {
        $pin = Get-OClaudeNumCtx -Cfg $cfg -Model $cfg.Models[$tier]
        if ($null -eq $pin) { continue }

        if ($tier -eq $mainTier) {
            if ($cfg.MaxContextTokens -gt $pin) {
                Write-Host (("warn: MaxContextTokens is {0} but the {1} tier num_ctx is {2}; " +
                             'Claude Code will overfill that tier') -f $cfg.MaxContextTokens, $tier, $pin) `
                    -ForegroundColor DarkYellow
            }
        } elseif ($pin -lt $cfg.AutoCompactWindow) {
            Write-Host (("note: the {0} tier num_ctx {1} is below the auto-compact window {2}; " +
                         'a long session can overfill it silently') -f $tier.ToLower(), $pin, $cfg.AutoCompactWindow) `
                -ForegroundColor DarkGray
        }
    }
}

function oclaude-pull {
    # Pull the base models the derived tags are built from, then rebuild the tags.
    [void](Test-OClaudeStale)
    $cfg = Get-OClaudeConfig
    if (-not (Start-OllamaServer -Endpoint $cfg.Endpoint)) { return }
    $have = Get-OllamaModel -Endpoint $cfg.Endpoint

    # The bases of the derived tags in use, plus any tier that names a base directly.
    $bases = @(Get-OClaudeDerivedTagInUse -Cfg $cfg |
               ForEach-Object { $cfg.Derived[$_].From }) | Sort-Object -Unique
    $plain = @(Get-OClaudeLocalModel -Cfg $cfg | Where-Object { -not $cfg.Derived.Contains($_) })
    $missing = @(@($bases) + @($plain) | Sort-Object -Unique |
        Where-Object { $have -notcontains $_ })

    # Report a failed pull here: oclaude-build-models would rediscover it as
    # "failed to build <tag>", which names the wrong culprit.
    $failed = @()
    foreach ($m in $missing) {
        Write-Host "pulling $m ..." -ForegroundColor DarkYellow
        ollama pull $m
        if ($LASTEXITCODE -ne 0) { $failed += $m }
    }
    if (-not $missing) { Write-Host 'all base models present' -ForegroundColor DarkGreen }
    if ($failed) {
        Write-Error ("ollama pull failed for: {0}. Derived tags built from them will fail too." -f ($failed -join ', '))
    }
    Build-OClaudeDerivedTag -Cfg $cfg
}
