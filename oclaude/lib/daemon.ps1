# oclaude daemon -- probe, start and restart the ollama daemon.
# Loaded by ../oclaude.ps1.

function Test-OllamaServer {
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint)
    # -NoProxy: loopback must not go through a corporate proxy, and skipping WPAD
    # keeps the first call in a session from blowing the timeout
    try { $null = Invoke-RestMethod -Uri "$Endpoint/api/version" -TimeoutSec 10 -NoProxy; $true }
    catch { $false }
}

function Wait-OllamaServer {
    # Returns the loop's own verdict, so the failure path does not pay another probe
    # (and another 10s timeout) to learn what the loop already knew.
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint, [int]$TimeoutSec = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-OllamaServer -Endpoint $Endpoint) { return $true }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

function Start-OllamaServer {
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint, [int]$TimeoutSec = 30)
    if (Test-OllamaServer -Endpoint $Endpoint) { return $true }

    $cfg = Get-OClaudeConfig
    Write-Host 'ollama: daemon down, starting...' -ForegroundColor DarkYellow

    # The child inherits these, so they configure the daemon we are about to spawn.
    # One entry per variable, the same shape session.ps1 uses: a name listed once
    # cannot fall out of step with its own save or restore.
    $spawnEnv = [ordered]@{
        OLLAMA_KEEP_ALIVE        = $cfg.KeepAlive
        OLLAMA_CONTEXT_LENGTH    = $cfg.ContextLength
        OLLAMA_MAX_LOADED_MODELS = $cfg.MaxLoadedModels
        OLLAMA_KV_CACHE_TYPE     = $cfg.KvCacheType
        OLLAMA_NUM_PARALLEL      = $cfg.NumParallel
        # A shell predating the User-scope change carries no OLLAMA_HOST, and a daemon
        # started without it binds loopback, breaking every container with no error.
        OLLAMA_HOST              = [Environment]::GetEnvironmentVariable('OLLAMA_HOST', 'User')
    }

    $saved = @{}
    foreach ($v in $spawnEnv.Keys) { $saved[$v] = [Environment]::GetEnvironmentVariable($v) }
    try {
        foreach ($v in $spawnEnv.Keys) {
            # A null stays null: OLLAMA_HOST is unset when User scope holds nothing.
            if ($null -ne $spawnEnv[$v]) { Set-Item "Env:$v" $spawnEnv[$v] }
        }
        Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    } finally {
        foreach ($v in $spawnEnv.Keys) {
            if ($null -eq $saved[$v]) { Remove-Item "Env:$v" -ErrorAction SilentlyContinue }
            else { Set-Item "Env:$v" $saved[$v] }
        }
    }

    if (Wait-OllamaServer -Endpoint $Endpoint -TimeoutSec $TimeoutSec) {
        Write-Host 'ollama: up' -ForegroundColor DarkGreen
        return $true
    }
    Write-Error "ollama: did not answer on $Endpoint within ${TimeoutSec}s"
    $false
}

function Test-OllamaIdentity {
    # A health check only proves SOMETHING answers on 11434, not that it is YOUR daemon.
    # This box has two Windows profiles, and a stale ollama from the other one grabbed the
    # port the moment a restart freed it: health check green, different model store, every
    # cc-* tag gone, no error anywhere. The tag check is the decisive one -- a wrong-store
    # daemon cannot fake the derived tags, and they are exactly what breaks.
    param($Cfg)

    try {
        $ver = (Invoke-RestMethod -Uri "$($Cfg.Endpoint)/api/version" -TimeoutSec 10 -NoProxy).version
    } catch {
        Write-Host "  identity: cannot query the daemon -- $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }

    # Get-OllamaModel already reports each name in both its tagged and its bare form,
    # which is exactly the question here: the derived tags are spelled bare in the map.
    # The version call above has proved the daemon answers, so an empty list now is a
    # real verdict rather than a transport failure.
    $have    = Get-OllamaModel -Endpoint $Cfg.Endpoint
    $missing = @($Cfg.Derived.Keys | Where-Object { $have -notcontains $_ })

    Write-Host ("  {0,-26} {1}" -f 'server version', $ver) -ForegroundColor Gray
    if (-not $missing) {
        Write-Host ("  {0,-26} {1} derived tags present" -f 'model store', $Cfg.Derived.Count) -ForegroundColor Gray
        return $true
    }

    Write-Host ''
    Write-Host 'ollama: WRONG DAEMON ANSWERED' -ForegroundColor Red
    Write-Host ("  missing derived tags: {0}" -f ($missing -join ', ')) -ForegroundColor Red
    Write-Host '  Something else holds the port and is serving its own model store.' -ForegroundColor Red
    Write-Host '  Find it, then stop it (elevation needed if it belongs to another user):' -ForegroundColor DarkYellow
    Write-Host '    netstat -ano | Select-String ":11434.*LISTENING"' -ForegroundColor DarkGray
    Write-Host '    Get-CimInstance Win32_Process -Filter "Name like ''ollama%''" |' -ForegroundColor DarkGray
    Write-Host '      Select-Object ProcessId, ExecutablePath' -ForegroundColor DarkGray
    Write-Host '    taskkill /F /PID <pid>        # from an elevated shell' -ForegroundColor DarkGray
    return $false
}

function oclaude-restart-daemon {
    # The daemon only sees env vars held by whatever launched it, and a shell opened
    # before a User-scope change carries a stale block. Re-read User scope, then
    # relaunch. Aborts any in-flight `ollama pull`.
    [void](Test-OClaudeStale)
    $applied = @{}
    # OLLAMA_HOST is here because containers reach the daemon over the network;
    # dropping it silently rebinds to loopback.
    foreach ($v in 'OLLAMA_HOST', 'OLLAMA_KEEP_ALIVE', 'OLLAMA_MAX_LOADED_MODELS',
                   'OLLAMA_CONTEXT_LENGTH', 'OLLAMA_KV_CACHE_TYPE', 'OLLAMA_FLASH_ATTENTION',
                   'OLLAMA_IGPU_ENABLE', 'OLLAMA_LLM_LIBRARY', 'OLLAMA_NUM_PARALLEL') {
        $val = [Environment]::GetEnvironmentVariable($v, 'User')
        if ($val) { Set-Item "Env:$v" $val; $applied[$v] = $val }
    }

    # llama-server runners are children the tray does not manage: killing only the
    # parents orphans them, still holding tens of GiB and starving the scheduler
    Get-Process -Name 'ollama app', 'ollama', 'llama-server' -ErrorAction SilentlyContinue |
        Stop-Process -Force
    Start-Sleep -Seconds 3

    $app     = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
    $viaTray = Test-Path $app
    if ($viaTray) { Start-Process -FilePath $app }
    else { Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden }

    $cfg = Get-OClaudeConfig
    if (Wait-OllamaServer -Endpoint $cfg.Endpoint -TimeoutSec 30) {
        Write-Host 'ollama: restarted with' -ForegroundColor DarkGreen
        $applied.GetEnumerator() | Sort-Object Key | ForEach-Object {
            # The tray forces its own OLLAMA_CONTEXT_LENGTH, so on that path reporting
            # ours as applied would be a lie.
            $note = if ($viaTray -and $_.Key -eq 'OLLAMA_CONTEXT_LENGTH') { '   (tray overrides this)' } else { '' }
            Write-Host ("  {0,-26} {1}{2}" -f $_.Key, $_.Value, $note) -ForegroundColor Gray
        }
        [void](Test-OllamaIdentity -Cfg $cfg)
    } else {
        Write-Error 'ollama: did not come back up'
    }
}
