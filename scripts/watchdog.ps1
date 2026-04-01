# Patchwork Watchdog — Windows equivalent of watchdog.sh.
# Verifies audit hooks are installed and reinstalls if missing.
# Runs via Windows Task Scheduler every 5 minutes.

$ErrorActionPreference = "SilentlyContinue"

$patchworkDir = Join-Path $env:USERPROFILE ".patchwork"
$logFile = Join-Path $patchworkDir "watchdog.log"
$settingsFile = Join-Path $env:USERPROFILE ".claude\settings.json"
$guardScript = Join-Path $PSScriptRoot "guard.ps1"

function Write-Log($msg) {
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    Add-Content $logFile "$ts $msg"
}

# --- Find working node + patchwork ---
$node = $null
$pw = $null

$searchPaths = @(
    (Join-Path $env:USERPROFILE "local\nodejs\*\bin"),
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    (Join-Path $env:APPDATA "nvm\*"),
    (Join-Path $env:USERPROFILE ".volta\bin")
)

foreach ($pattern in $searchPaths) {
    foreach ($dir in (Resolve-Path $pattern -ErrorAction SilentlyContinue)) {
        $nodeExe = Join-Path $dir.Path "node.exe"
        $pwExe = Join-Path $dir.Path "patchwork.cmd"
        if (-not (Test-Path $pwExe)) { $pwExe = Join-Path $dir.Path "patchwork" }

        if ((Test-Path $nodeExe) -and (Test-Path $pwExe)) {
            try {
                & $nodeExe --version 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) { $node = $nodeExe; $pw = $pwExe; break }
            } catch {}
        }
    }
    if ($node) { break }
}

# 1. Check patchwork exists
if (-not $pw) {
    Write-Log "CRITICAL: patchwork not found"
    exit 1
}

# 2. Check settings.json exists
if (-not (Test-Path $settingsFile)) {
    Write-Log "CRITICAL: settings.json missing — writing hooks"
    New-Item -ItemType Directory -Path (Split-Path $settingsFile) -Force | Out-Null
    & $node $pw init claude-code --strict-profile --policy-mode fail-closed 2>$null
    Write-Log "REINSTALLED: hooks written"
    exit 0
}

# 3. Check hooks use correct patchwork path
$settings = Get-Content $settingsFile -Raw | ConvertFrom-Json
$preToolCmd = $settings.hooks.PreToolUse[0].command ?? ""

if (-not $preToolCmd.Contains("patchwork")) {
    Write-Log "WARNING: hooks missing — reinstalling"
    & $node $pw init claude-code --strict-profile --policy-mode fail-closed 2>$null
    Write-Log "REINSTALLED: hooks restored"
    exit 0
}

# 4. Check fail-closed
if (-not $preToolCmd.Contains("PATCHWORK_PRETOOL_FAIL_CLOSED=1")) {
    Write-Log "WARNING: fail-closed not set — reinstalling"
    & $node $pw init claude-code --strict-profile --policy-mode fail-closed 2>$null
    Write-Log "REINSTALLED: fail-closed restored"
    exit 0
}

# 5. Check policy
$systemPolicy = Join-Path ($env:PROGRAMDATA ?? "C:\ProgramData") "Patchwork\policy.yml"
$userPolicy = Join-Path $patchworkDir "policy.yml"
if (-not (Test-Path $systemPolicy) -and -not (Test-Path $userPolicy)) {
    Write-Log "WARNING: no policy file found"
}

# 6. Check audit store
if (-not (Test-Path $patchworkDir)) {
    Write-Log "CRITICAL: .patchwork directory not found"
    exit 1
}

# 7. Rotate log if > 100KB
if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 102400) {
    $lines = Get-Content $logFile -Tail 200
    Set-Content $logFile $lines
    Write-Log "ROTATED: watchdog log trimmed"
}
