# oclaude models -- the model store, and the derived tags that pin num_ctx.
# Loaded by ../oclaude.ps1.

function Test-CloudModel {
    # Cloud tags resolve server-side, so they are never "not pulled".
    param([string]$Model)
    return [bool]($Model -match '(:|-)cloud$')
}

function Get-OClaudeLocalModel {
    # The tags this map runs locally. A derived tag name is one of them, because a tier
    # points at the TAG, not its base model. So one list answers what to pull, what to
    # build, and what proves the daemon serves your store.
    param([Parameter(Mandatory)]$Cfg)
    # Wrapped: Sort-Object returns a scalar for a one-model map, and callers want .Count
    # and -contains.
    @(@($Cfg.Models.Values | Where-Object { -not (Test-CloudModel $_) }) | Sort-Object -Unique)
}

function Get-OClaudeDerivedTagInUse {
    # The derived tags some tier points at: what to build, and whose bases to pull.
    # Widening what counts as in use lands here, for both loops at once.
    param([Parameter(Mandatory)]$Cfg)
    $local = Get-OClaudeLocalModel -Cfg $Cfg
    @($Cfg.Derived.Keys | Where-Object { $local -contains $_ })
}

function Get-OClaudeNumCtx {
    # The num_ctx pinned behind a tag. Nothing when the tier names a base model
    # directly and so has no pin.
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
    # (Re)create the derived tags that pin num_ctx. Cheap: a tag references the base
    # model's existing blobs, so it costs a manifest, not a copy. The stale check matters
    # most here, since you run this right after editing Derived.
    [void](Test-OClaudeStale)
    Build-OClaudeDerivedTag -Cfg (Get-OClaudeConfig)
}

function Build-OClaudeDerivedTag {
    # The body of oclaude-build-models without the entry-point work. oclaude-pull builds
    # the tags too, and calling the entry point would re-run the stale check and rebuild
    # a config it already holds.
    param([Parameter(Mandatory)]$cfg)
    if (-not (Start-OllamaServer -Endpoint $cfg.Endpoint)) { return }

    # Only the tags a tier points at, so Derived can carry a spec you are not running
    # today without building or pulling its weights.
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

    # Claude Code holds ONE context cap for every tier, so any tier pinned below the cap
    # can be handed more than it holds. How much that matters splits in two.
    #
    # The MAIN LOOP tier holds the session, so overfilling it loses the conversation.
    # That is a warning, and only when the cap EXCEEDS the pin.
    #
    # Every other tier reads a SLICE of a transcript that grows to the auto-compact
    # window, so that window is their bound. A note, not a warning: a classifier that
    # stops answering stops gating tool calls, and a truncated background call is
    # silent.
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

    # Report a failed pull here. oclaude-build-models would rediscover it as
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
