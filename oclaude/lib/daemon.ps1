# oclaude daemon -- probe, start and restart the ollama daemon.
# Loaded by ../oclaude.ps1.
#
# Two platforms, two different daemons. On Windows the tray application or a plain
# `ollama serve` owns it, and it reads its settings from whatever launched it, which is
# why those live in User-scope OLLAMA_* variables. On Linux and macOS a service manager
# usually owns it, under its OWN user account and so with its own model store. Starting
# `ollama serve` by hand there gives a second daemon with an empty store, which is
# exactly the wrong-daemon failure Test-OllamaIdentity exists to catch. So the Unix path
# drives the service where there is one, and spawns a process only where there is not.
#
# oclaude holds no daemon defaults of its own on either platform. Whatever starts the
# daemon supplies them.

function Test-OClaudeIsWindows {
    # Windows PowerShell 5.1 does not define $IsWindows, where it reads as $null and
    # would send every platform test down the Unix branch. 5.1 runs on Windows only, so
    # an undefined answer IS Windows.
    if ($null -eq $IsWindows) { return $true }
    return [bool]$IsWindows
}

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

function Get-OllamaDaemonEnv {
    # The OLLAMA_* settings to hand a daemon oclaude starts itself, as a name -> value
    # map, skipping the ones that are not set. Both the lazy start and the explicit
    # restart configure the daemon from this, so the two cannot disagree about what a
    # daemon of ours looks like.
    #
    # Where they come from is per platform. On Windows, User scope: the one place every
    # starter reads, including the tray application and a login shell, and a shell opened
    # before a change carries a stale copy in its own environment, hence reading the
    # scope rather than trusting $env:. On Unix there is no second scope, so this shell's
    # environment is what the child gets. A systemd unit reads neither, and
    # Show-OllamaServiceEnvironment covers that case.
    #
    # OLLAMA_HOST is the one that bites when missing: a daemon started without it binds
    # loopback only, which breaks every container with no error anywhere.
    $found = [ordered]@{}
    $names = 'OLLAMA_HOST', 'OLLAMA_KEEP_ALIVE', 'OLLAMA_MAX_LOADED_MODELS',
             'OLLAMA_CONTEXT_LENGTH', 'OLLAMA_KV_CACHE_TYPE', 'OLLAMA_FLASH_ATTENTION',
             'OLLAMA_IGPU_ENABLE', 'OLLAMA_LLM_LIBRARY', 'OLLAMA_NUM_PARALLEL'
    foreach ($v in $names) {
        $val = if (Test-OClaudeIsWindows) { [Environment]::GetEnvironmentVariable($v, 'User') }
               else { [Environment]::GetEnvironmentVariable($v) }
        if ($val) { $found[$v] = $val }
    }
    $found
}

function Get-OllamaServiceUnit {
    # 'system', 'user' or $null. Unix only, and the answer decides both how to start the
    # daemon and where its settings come from.
    if (Test-OClaudeIsWindows) { return $null }
    if (-not (Get-Command systemctl -ErrorAction SilentlyContinue)) { return $null }

    # list-unit-files, not is-active: a stopped unit is still the thing to start, and
    # is-active answers 'inactive' both for an absent unit and for a stopped one.
    if (@(systemctl list-unit-files ollama.service 2>$null) -match 'ollama\.service') {
        return 'system'
    }
    if (@(systemctl --user list-unit-files ollama.service 2>$null) -match 'ollama\.service') {
        return 'user'
    }
    return $null
}

function Start-OllamaProcess {
    # Spawns `ollama serve` detached. The last resort on Unix, and the usual path on
    # Windows without the tray application.
    if (Test-OClaudeIsWindows) {
        Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
        return
    }
    # -WindowStyle does not apply off Windows, and with no redirection the daemon writes
    # its log over the prompt. Two files, because Start-Process refuses one for both.
    $tmp = [System.IO.Path]::GetTempPath()
    Start-Process -FilePath 'ollama' -ArgumentList 'serve' `
        -RedirectStandardOutput (Join-Path $tmp 'oclaude-ollama-serve.out') `
        -RedirectStandardError  (Join-Path $tmp 'oclaude-ollama-serve.err') | Out-Null
}

function Start-OllamaService {
    # Starts or restarts the systemd unit. Returns $true when the command ran.
    param([Parameter(Mandatory)][string]$Unit,
          [ValidateSet('start', 'restart')][string]$Action = 'start')
    if ($Unit -eq 'user') {
        systemctl --user $Action ollama
        return ($LASTEXITCODE -eq 0)
    }
    # A system unit needs root. -n so that a box without a password rule fails at once
    # rather than waiting for a password nobody is watching for. Absent sudo is the same
    # answer as sudo refusing, so both land on the message below.
    if (Get-Command sudo -ErrorAction SilentlyContinue) {
        sudo -n systemctl $Action ollama 2>$null
        if ($LASTEXITCODE -eq 0) { return $true }
    }

    Write-Host ("ollama: the daemon is a system service, so {0} needs root:" -f $Action) -ForegroundColor Red
    Write-Host ("    sudo systemctl {0} ollama" -f $Action) -ForegroundColor DarkGray
    Write-Host '  Do not run `ollama serve` instead. The service runs as its own user with' -ForegroundColor DarkYellow
    Write-Host '  its own model store, so a hand-started daemon serves an empty one.' -ForegroundColor DarkYellow
    return $false
}

function Start-OllamaServer {
    param([string]$Endpoint = (Get-OClaudeConfig).Endpoint, [int]$TimeoutSec = 30)
    if (Test-OllamaServer -Endpoint $Endpoint) { return $true }

    Write-Host 'ollama: daemon down, starting...' -ForegroundColor DarkYellow

    $unit = Get-OllamaServiceUnit
    if ($unit) {
        if (-not (Start-OllamaService -Unit $unit -Action 'start')) { return $false }
    } else {
        $spawnEnv = Get-OllamaDaemonEnv
        $saved = @{}
        foreach ($v in $spawnEnv.Keys) { $saved[$v] = [Environment]::GetEnvironmentVariable($v) }
        try {
            foreach ($v in $spawnEnv.Keys) { Set-Item "Env:$v" $spawnEnv[$v] }
            Start-OllamaProcess
        } finally {
            foreach ($v in $spawnEnv.Keys) {
                if ($null -eq $saved[$v]) { Remove-Item "Env:$v" -ErrorAction SilentlyContinue }
                else { Set-Item "Env:$v" $saved[$v] }
            }
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
    # A health check only proves SOMETHING answers on the port, not that it is YOUR
    # daemon. On Windows this box has two profiles, and a stale ollama from the other one
    # grabbed the port the moment a restart freed it: health check green, different model
    # store, every cc-* tag gone, no error anywhere. On Unix the same thing happens when
    # `ollama serve` runs as you while the service runs as the ollama user. The store
    # check is the decisive one -- a wrong-store daemon cannot fake the tags, and they
    # are exactly what breaks.
    param($Cfg)

    try {
        $ver = (Invoke-RestMethod -Uri "$($Cfg.Endpoint)/api/version" -TimeoutSec 10 -NoProxy).version
    } catch {
        Write-Host "  identity: cannot query the daemon -- $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    Write-Host ("  {0,-26} {1}" -f 'server version', $ver) -ForegroundColor Gray

    # What proves the store: the derived tags, and any tier running a local model. An
    # all-cloud map has neither, and then the version above is all there is to report.
    $expected = @(@($Cfg.Derived.Keys) +
                  @($Cfg.Models.Values | Where-Object { -not (Test-CloudModel $_) })) |
                Sort-Object -Unique
    if (-not $expected) {
        Write-Host ("  {0,-26} {1}" -f 'model store', 'no local tier, nothing to check') -ForegroundColor Gray
        return $true
    }

    # Get-OllamaModel already reports each name in both its tagged and its bare form,
    # which is exactly the question here: the derived tags are spelled bare in the map.
    # The version call above has proved the daemon answers, so an empty list now is a
    # real verdict rather than a transport failure.
    $have    = Get-OllamaModel -Endpoint $Cfg.Endpoint
    $missing = @($expected | Where-Object { $have -notcontains $_ })
    if (-not $missing) {
        Write-Host ("  {0,-26} {1} local tags present" -f 'model store', $expected.Count) -ForegroundColor Gray
        return $true
    }

    $port = ([uri]$Cfg.Endpoint).Port
    Write-Host ''
    Write-Host 'ollama: WRONG DAEMON ANSWERED' -ForegroundColor Red
    Write-Host ("  missing local tags: {0}" -f ($missing -join ', ')) -ForegroundColor Red
    Write-Host '  Something else holds the port and is serving its own model store.' -ForegroundColor Red
    Write-Host '  Find it, then stop it:' -ForegroundColor DarkYellow
    if (Test-OClaudeIsWindows) {
        Write-Host ('    netstat -ano | Select-String ":{0}.*LISTENING"' -f $port) -ForegroundColor DarkGray
        Write-Host '    Get-CimInstance Win32_Process -Filter "Name like ''ollama%''" |' -ForegroundColor DarkGray
        Write-Host '      Select-Object ProcessId, ExecutablePath' -ForegroundColor DarkGray
        Write-Host '    taskkill /F /PID <pid>        # from an elevated shell' -ForegroundColor DarkGray
    } else {
        Write-Host ("    ss -lptn 'sport = :{0}'" -f $port) -ForegroundColor DarkGray
        Write-Host '    ps -o pid,user,args -C ollama' -ForegroundColor DarkGray
        Write-Host '    kill <pid>                    # sudo if it belongs to another user' -ForegroundColor DarkGray
    }
    return $false
}

function Show-OllamaServiceEnvironment {
    # What the service manager hands the daemon. Reported rather than applied: a system
    # unit reads a drop-in file that needs root to write, so a knob oclaude set here
    # would be a knob that never took.
    param([Parameter(Mandatory)][string]$Unit)
    $userScope = ($Unit -eq 'user')
    $shown = if ($userScope) {
        @(systemctl --user show ollama --property=Environment 2>$null) -join ''
    } else {
        @(systemctl show ollama --property=Environment 2>$null) -join ''
    }
    $vars = @(($shown -replace '^Environment=', '') -split '\s+' |
              Where-Object { $_ -match '^"?OLLAMA_' })

    if ($vars) {
        Write-Host 'ollama: restarted. The service passes' -ForegroundColor DarkGreen
        $vars | Sort-Object | ForEach-Object {
            Write-Host ("  {0}" -f ($_ -replace '^"|"$', '')) -ForegroundColor Gray
        }
        return
    }

    Write-Host 'ollama: restarted. The service passes no OLLAMA_* variables.' -ForegroundColor DarkGreen
    $dropIn = if ($userScope) { '~/.config/systemd/user/ollama.service.d/override.conf' }
              else { '/etc/systemd/system/ollama.service.d/override.conf' }
    $reload = if ($userScope) { 'systemctl --user daemon-reload' } else { 'sudo systemctl daemon-reload' }
    Write-Host '  A drop-in file is this platform''s User scope. Set them there:' -ForegroundColor DarkGray
    Write-Host ("    {0}" -f $dropIn) -ForegroundColor DarkGray
    Write-Host '      [Service]' -ForegroundColor DarkGray
    Write-Host '      Environment="OLLAMA_KEEP_ALIVE=4h"' -ForegroundColor DarkGray
    Write-Host ("    {0}, then oclaude-restart-daemon" -f $reload) -ForegroundColor DarkGray
}

function oclaude-restart-daemon {
    # Restarts the daemon so that a changed setting takes. What a changed setting means
    # is per platform: a User-scope variable on Windows, a unit drop-in under systemd.
    # Aborts any in-flight `ollama pull`.
    [void](Test-OClaudeStale)
    $cfg  = Get-OClaudeConfig
    $unit = Get-OllamaServiceUnit

    if ($unit) {
        # systemd owns the daemon's children through the unit's cgroup, so the manual
        # llama-server sweep below would only race with it.
        if (-not (Start-OllamaService -Unit $unit -Action 'restart')) { return }
        if (Wait-OllamaServer -Endpoint $cfg.Endpoint -TimeoutSec 30) {
            Show-OllamaServiceEnvironment -Unit $unit
            [void](Test-OllamaIdentity -Cfg $cfg)
        } else {
            Write-Error 'ollama: did not come back up'
            $status = if ($unit -eq 'user') { 'systemctl --user status ollama' }
                      else { 'systemctl status ollama' }
            Write-Host ("  {0}" -f $status) -ForegroundColor DarkGray
        }
        return
    }

    # No service manager. The daemon only sees the variables held by whatever launched
    # it, so re-read them and relaunch.
    $applied = Get-OllamaDaemonEnv
    foreach ($v in $applied.Keys) { Set-Item "Env:$v" $applied[$v] }

    # llama-server runners are children the tray does not manage: killing only the
    # parents orphans them, still holding tens of GiB and starving the scheduler
    Get-Process -Name 'ollama app', 'ollama', 'llama-server' -ErrorAction SilentlyContinue |
        Stop-Process -Force
    Start-Sleep -Seconds 3

    $app = if (Test-OClaudeIsWindows) {
        Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
    } else { $null }
    $viaTray = $app -and (Test-Path $app)
    if ($viaTray) { Start-Process -FilePath $app } else { Start-OllamaProcess }

    if (Wait-OllamaServer -Endpoint $cfg.Endpoint -TimeoutSec 30) {
        Write-Host 'ollama: restarted with' -ForegroundColor DarkGreen
        if (-not $applied.Count) { Write-Host '  (no OLLAMA_* set)' -ForegroundColor Gray }
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
