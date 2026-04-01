# Patchwork session guard — Windows equivalent of guard.sh.
# Verifies audit system is operational before Claude Code starts.

$ErrorActionPreference = "SilentlyContinue"

$patchworkDir = Join-Path $env:USERPROFILE ".patchwork"
$eventsFile = Join-Path $patchworkDir "events.jsonl"
$stateDir = Join-Path $patchworkDir "state"
$guardStatusFile = Join-Path $stateDir "guard-status.json"
$systemPolicy = Join-Path ($env:PROGRAMDATA ?? "C:\ProgramData") "Patchwork\policy.yml"
$userPolicy = Join-Path $patchworkDir "policy.yml"

# Ensure state directory
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null }

$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# --- Node discovery ---
$node = $null
$pw = $null

$searchPaths = @(
    (Join-Path $env:USERPROFILE "local\nodejs\*\bin"),
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    (Join-Path $env:APPDATA "nvm\*"),
    (Join-Path $env:USERPROFILE ".volta\bin"),
    (Join-Path $env:USERPROFILE ".fnm\node-versions\*\installation")
)

foreach ($pattern in $searchPaths) {
    foreach ($dir in (Resolve-Path $pattern -ErrorAction SilentlyContinue)) {
        $nodeExe = Join-Path $dir.Path "node.exe"
        $pwExe = Join-Path $dir.Path "patchwork.cmd"
        if (-not (Test-Path $pwExe)) { $pwExe = Join-Path $dir.Path "patchwork" }

        if ((Test-Path $nodeExe) -and (Test-Path $pwExe)) {
            try {
                & $nodeExe --version 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $node = $nodeExe
                    $pw = $pwExe
                    break
                }
            } catch {}
        }
    }
    if ($node) { break }
}

# 1. Check patchwork CLI available
if (-not $node) {
    # Try bare patchwork
    try {
        & patchwork --version 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $pw = (Get-Command patchwork -ErrorAction SilentlyContinue).Source
        }
    } catch {}
}

if (-not $pw) {
    Write-Error "Patchwork CLI not found."
    @{ status = "failed"; reason = "cli_not_found"; ts = $ts } | ConvertTo-Json | Set-Content $guardStatusFile
    exit 1
}

# Cache paths for hook-wrapper
if ($node) { Set-Content (Join-Path $stateDir "node-path") $node }
Set-Content (Join-Path $stateDir "patchwork-path") $pw

# 2. Check audit store
if (-not (Test-Path $patchworkDir)) {
    New-Item -ItemType Directory -Path $patchworkDir -Force | Out-Null
}

# 3. Check policy
if (-not (Test-Path $systemPolicy) -and -not (Test-Path $userPolicy)) {
    Write-Warning "[patchwork-guard] No policy file found"
}

# 4. Record guard success
@{ status = "ok"; ts = $ts } | ConvertTo-Json | Set-Content $guardStatusFile

# 5. Forward to patchwork hook session-start
if ($node) {
    $input | & $node $pw hook session-start
} else {
    $input | & patchwork hook session-start
}
exit $LASTEXITCODE
