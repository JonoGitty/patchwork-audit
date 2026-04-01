# Patchwork hook wrapper — Windows equivalent of hook-wrapper.sh.
# Discovers Node.js at runtime and forwards to patchwork hook.
# Called by Claude Code hooks: powershell.exe -ExecutionPolicy Bypass -File hook-wrapper.ps1 <event>

param([string]$HookEvent)

$ErrorActionPreference = "SilentlyContinue"

# Try cached paths from guard
$statePath = Join-Path $env:USERPROFILE ".patchwork\state"
$nodePath = if (Test-Path "$statePath\node-path") { (Get-Content "$statePath\node-path" -Raw).Trim() } else { $null }
$pwPath = if (Test-Path "$statePath\patchwork-path") { (Get-Content "$statePath\patchwork-path" -Raw).Trim() } else { $null }

if ($nodePath -and (Test-Path $nodePath) -and $pwPath) {
    $input | & $nodePath $pwPath hook $HookEvent
    exit $LASTEXITCODE
}

# Runtime discovery
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
            $input | & $nodeExe $pwExe hook $HookEvent
            exit $LASTEXITCODE
        }
    }
}

# Last resort: bare patchwork
$input | & patchwork hook $HookEvent
exit $LASTEXITCODE
