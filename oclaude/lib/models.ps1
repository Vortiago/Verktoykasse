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
    $localModels = Get-OClaudeLocalModel -Cfg $cfg
    $tags = @($cfg.Derived.Keys | Where-Object { $localModels -contains $_ })
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

    # Bounded by the MAIN LOOP tier only, the one DefaultAlias resolves to. SONNET is a
    # classifier that never sees the session's context, so including it fired a false
    # warning. Warn only when the cap EXCEEDS the tier: below it is a valid choice.
    $mainTier = if ($cfg.DefaultAlias -match 'opus') { 'OPUS' } else { $cfg.DefaultAlias.ToUpper() }
    $mainCtx  = if ($cfg.Derived.Contains($cfg.Models[$mainTier])) {
        $cfg.Derived[$cfg.Models[$mainTier]].NumCtx
    } else { $null }
    if ($null -ne $mainCtx -and $cfg.MaxContextTokens -gt $mainCtx) {
        Write-Host (("warn: MaxContextTokens is {0} but the {1} tier num_ctx is {2}; " +
                     'Claude Code will overfill that tier') -f $cfg.MaxContextTokens, $mainTier, $mainCtx) `
            -ForegroundColor DarkYellow
    }

    # Softer check: the classifier reads a slice of the transcript, so its num_ctx has
    # to cover a session grown to the auto-compact window. Overflow is not a crash, but
    # a classifier that stops answering is one that stops gating tool calls.
    $fastCtx = if ($cfg.Derived.Contains($cfg.Models['SONNET'])) {
        $cfg.Derived[$cfg.Models['SONNET']].NumCtx
    } else { $null }
    if ($null -ne $fastCtx -and $fastCtx -lt $cfg.AutoCompactWindow) {
        Write-Host (("note: classifier tier num_ctx {0} is below the auto-compact window {1}; " +
                     'long sessions will hit transcript_too_long') -f $fastCtx, $cfg.AutoCompactWindow) `
            -ForegroundColor DarkGray
    }
}

function oclaude-pull {
    # Pull the base models the derived tags are built from, then rebuild the tags.
    [void](Test-OClaudeStale)
    $cfg = Get-OClaudeConfig
    if (-not (Start-OllamaServer -Endpoint $cfg.Endpoint)) { return }
    $have = Get-OllamaModel -Endpoint $cfg.Endpoint

    # Same filter as Build-OClaudeDerivedTag: the bases of the derived tags in use, plus
    # any tier that names a base model directly.
    $localModels = Get-OClaudeLocalModel -Cfg $cfg
    $bases = @($cfg.Derived.Keys | Where-Object { $localModels -contains $_ } |
               ForEach-Object { $cfg.Derived[$_].From }) | Sort-Object -Unique
    $plain = @($localModels | Where-Object { -not $cfg.Derived.Contains($_) })
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
