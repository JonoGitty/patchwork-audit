# Patchwork System Install — Windows multi-user tamper-proof enforcement.
# Must be run as Administrator.
#
# Usage:
#   .\system-install.ps1                         # current user
#   .\system-install.ps1 -User alice             # specific user
#   .\system-install.ps1 -Users alice,bob        # multiple users
#   .\system-install.ps1 -AllUsers               # all local users
#   .\system-install.ps1 -AllUsers -Policy custom.yml

param(
    [string]$User = "",
    [string[]]$Users = @(),
    [switch]$AllUsers,
    [string]$Policy = ""
)

$ErrorActionPreference = "Stop"
$SYSTEM_DIR = Join-Path ($env:PROGRAMDATA ?? "C:\ProgramData") "Patchwork"
$USERS_CONF = Join-Path $SYSTEM_DIR "users.conf"
$TASK_NAME = "patchwork-watchdog"
$SCRIPT_DIR = $PSScriptRoot
$REPO_DIR = Split-Path $SCRIPT_DIR -Parent

# --- Validation ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator."
    exit 1
}

# --- Resolve user list ---
$targetUsers = @()
if ($AllUsers) {
    $targetUsers = Get-LocalUser | Where-Object {
        $_.Enabled -eq $true -and
        $_.Name -notin @("DefaultAccount", "WDAGUtilityAccount", "Guest") -and
        (Test-Path (Join-Path "C:\Users" $_.Name))
    } | ForEach-Object { $_.Name }
} elseif ($Users.Count -gt 0) {
    $targetUsers = $Users
} elseif ($User) {
    $targetUsers = @($User)
} else {
    $targetUsers = @($env:USERNAME)
}

if ($targetUsers.Count -eq 0) {
    Write-Error "No users found."
    exit 1
}

Write-Host "`n=== Patchwork System Install (Windows) ===" -ForegroundColor Cyan
Write-Host "  Users:      $($targetUsers -join ', ')"
Write-Host "  System dir: $SYSTEM_DIR`n"

# --- Step 1: Create system directory ---
Write-Host "[1/5] Creating $SYSTEM_DIR..."
if (-not (Test-Path $SYSTEM_DIR)) {
    New-Item -ItemType Directory -Path $SYSTEM_DIR -Force | Out-Null
}

# --- Step 2: Install shared assets ---
Write-Host "[2/5] Installing shared assets..."

# Policy
$policySrc = ""
if ($Policy -and (Test-Path $Policy)) { $policySrc = $Policy }
elseif (Test-Path "$REPO_DIR\docs\default-policy.yml") { $policySrc = "$REPO_DIR\docs\default-policy.yml" }

if ($policySrc) {
    Copy-Item $policySrc "$SYSTEM_DIR\policy.yml" -Force
    Write-Host "  Policy: $SYSTEM_DIR\policy.yml"
}

# Guard + hook-wrapper
Copy-Item "$SCRIPT_DIR\guard.ps1" "$SYSTEM_DIR\guard.ps1" -Force
Copy-Item "$SCRIPT_DIR\hook-wrapper.ps1" "$SYSTEM_DIR\hook-wrapper.ps1" -Force
Write-Host "  Guard: $SYSTEM_DIR\guard.ps1"
Write-Host "  Hook wrapper: $SYSTEM_DIR\hook-wrapper.ps1"

# --- Step 3: User registry ---
Write-Host "[3/5] Setting up user registry..."
if (-not (Test-Path $USERS_CONF)) {
    "# Patchwork enrolled users" | Set-Content $USERS_CONF
}

# --- Step 4: Enroll users ---
Write-Host "[4/5] Enrolling users..."
$enrolled = 0

foreach ($u in $targetUsers) {
    Write-Host "`n  --- $u ---"
    $userHome = "C:\Users\$u"
    if (-not (Test-Path $userHome)) {
        Write-Host "  [$u] SKIP — home not found: $userHome" -ForegroundColor Yellow
        continue
    }

    $claudeDir = Join-Path $userHome ".claude"
    $settingsFile = Join-Path $claudeDir "settings.json"
    $pwDir = Join-Path $userHome ".patchwork"

    # Ensure directories
    @($claudeDir, $pwDir, "$pwDir\state", "$pwDir\db") | ForEach-Object {
        if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
    }

    # Remove read-only if locked
    if (Test-Path $settingsFile) {
        attrib -R $settingsFile 2>$null
    }

    # Find node + patchwork for this user
    $nodeExe = $null; $pwExe = $null
    $searchPaths = @(
        (Join-Path $userHome "local\nodejs\*\bin"),
        "C:\Program Files\nodejs",
        (Join-Path $env:APPDATA "nvm\*"),
        (Join-Path $userHome ".volta\bin")
    )
    foreach ($pattern in $searchPaths) {
        foreach ($dir in (Resolve-Path $pattern -ErrorAction SilentlyContinue)) {
            $n = Join-Path $dir.Path "node.exe"
            $p = Join-Path $dir.Path "patchwork.cmd"
            if (-not (Test-Path $p)) { $p = Join-Path $dir.Path "patchwork" }
            if ((Test-Path $n) -and (Test-Path $p)) { $nodeExe = $n; $pwExe = $p; break }
        }
        if ($nodeExe) { break }
    }

    # Try patchwork init
    if ($pwExe) {
        $env:PATH = "$(Split-Path $nodeExe);$env:PATH"
        & $nodeExe $pwExe init claude-code --strict-profile --policy-mode fail-closed 2>$null
    }

    # Patch hooks to use Windows wrapper
    if (Test-Path $settingsFile) {
        $settings = Get-Content $settingsFile -Raw | ConvertFrom-Json
        $wrapper = "powershell.exe -ExecutionPolicy Bypass -File `"$SYSTEM_DIR\hook-wrapper.ps1`""
        $guard = "powershell.exe -ExecutionPolicy Bypass -File `"$SYSTEM_DIR\guard.ps1`""

        $settings.hooks = @{
            PreToolUse = @(@{
                type = "command"
                command = "PATCHWORK_PRETOOL_FAIL_CLOSED=1 PATCHWORK_PRETOOL_WARN_MS=500 PATCHWORK_PRETOOL_TELEMETRY_JSON=1 $wrapper pre-tool"
                timeout = 1500
            })
            PostToolUse = @(@{ type = "command"; command = "$wrapper post-tool"; timeout = 1000 })
            PostToolUseFailure = @(@{ type = "command"; command = "$wrapper post-tool-failure"; timeout = 1000 })
            SessionStart = @(@{ type = "command"; command = $guard; timeout = 1500 })
            SessionEnd = @(@{ type = "command"; command = "$wrapper session-end"; timeout = 500 })
            UserPromptSubmit = @(@{ type = "command"; command = "$wrapper prompt-submit"; timeout = 500 })
            SubagentStart = @(@{ type = "command"; command = "$wrapper subagent-start"; timeout = 500 })
            SubagentStop = @(@{ type = "command"; command = "$wrapper subagent-stop"; timeout = 500 })
        }

        $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsFile -Encoding UTF8
    }

    # Lock settings.json (read-only)
    if (Test-Path $settingsFile) {
        attrib +R $settingsFile
        Write-Host "  [$u] settings.json locked (read-only)"
    }

    # Add to registry
    $existing = if (Test-Path $USERS_CONF) { Get-Content $USERS_CONF } else { @() }
    if ($u -notin $existing) { Add-Content $USERS_CONF $u }

    Write-Host "  [$u] Hooks installed"
    $enrolled++
}

# --- Step 5: Install watchdog scheduled task ---
Write-Host "`n[5/5] Installing system watchdog..."

# Write system watchdog script
$watchdogScript = @"
# Patchwork System Watchdog — runs as SYSTEM via Task Scheduler.
`$ErrorActionPreference = "SilentlyContinue"
`$SYSTEM_DIR = "$SYSTEM_DIR"
`$USERS_CONF = "`$SYSTEM_DIR\users.conf"
`$logFile = "`$SYSTEM_DIR\watchdog.log"

function Write-Log(`$msg) {
    `$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    Add-Content `$logFile "`$ts `$msg"
}

if (-not (Test-Path `$USERS_CONF)) { Write-Log "ERROR: users.conf not found"; exit 1 }

Get-Content `$USERS_CONF | Where-Object { `$_ -and -not `$_.StartsWith("#") } | ForEach-Object {
    `$user = `$_
    `$home = "C:\Users\`$user"
    `$settings = "`$home\.claude\settings.json"

    if (-not (Test-Path `$home)) { return }

    if (-not (Test-Path `$settings)) {
        Write-Log "[`$user] CRITICAL: settings.json missing"
        return
    }

    # Check read-only
    `$item = Get-Item `$settings
    if (-not (`$item.Attributes -match "ReadOnly")) {
        attrib +R `$settings
        Write-Log "[`$user] FIXED: settings.json relocked"
    }

    # Check hooks present
    `$content = Get-Content `$settings -Raw
    if (-not (`$content -match "patchwork")) {
        Write-Log "[`$user] WARNING: hooks missing"
    }
}

# Rotate log
if ((Test-Path `$logFile) -and (Get-Item `$logFile).Length -gt 512000) {
    Get-Content `$logFile -Tail 500 | Set-Content `$logFile
    Write-Log "ROTATED: log trimmed"
}
"@

Set-Content "$SYSTEM_DIR\system-watchdog.ps1" $watchdogScript

# Register scheduled task
$existingTask = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$SYSTEM_DIR\system-watchdog.ps1`""

$triggers = @(
    (New-ScheduledTaskTrigger -AtStartup),
    (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5))
)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TASK_NAME -Action $action -Trigger $triggers -Principal $principal -Force | Out-Null
Write-Host "  Scheduled task '$TASK_NAME' installed (every 5 min + at startup)"

# --- Summary ---
Write-Host "`n=== System Install Complete ===" -ForegroundColor Green
Write-Host "`n  Enrolled users ($enrolled):"
Get-Content $USERS_CONF | Where-Object { $_ -and -not $_.StartsWith("#") } | ForEach-Object {
    Write-Host "    - $_"
}
Write-Host "`n  Protected:"
Write-Host "    settings.json (read-only) per user"
Write-Host "    $SYSTEM_DIR\policy.yml"
Write-Host "`n  Manage users:"
Write-Host "    .\system-install.ps1 -User newuser"
Write-Host "    .\system-uninstall.ps1"
