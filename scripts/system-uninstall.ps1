# Patchwork System Uninstall — Windows.
# Reverses all system-level protections for all enrolled users.
# Must be run as Administrator.
#
# Usage:
#   .\system-uninstall.ps1
#   .\system-uninstall.ps1 -KeepData

param([switch]$KeepData)

$ErrorActionPreference = "Stop"
$SYSTEM_DIR = Join-Path ($env:PROGRAMDATA ?? "C:\ProgramData") "Patchwork"
$USERS_CONF = Join-Path $SYSTEM_DIR "users.conf"
$TASK_NAME = "patchwork-watchdog"

# --- Validation ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator."
    exit 1
}

Write-Host "`n=== Patchwork System Uninstall (Windows) ===" -ForegroundColor Cyan

# 1. Unlock all enrolled users
Write-Host "`n[1/3] Unlocking enrolled users..."
if (Test-Path $USERS_CONF) {
    $unlocked = 0
    Get-Content $USERS_CONF | Where-Object { $_ -and -not $_.StartsWith("#") } | ForEach-Object {
        $user = $_
        $settings = "C:\Users\$user\.claude\settings.json"
        if (Test-Path $settings) {
            attrib -R $settings 2>$null
            Write-Host "  [$user] settings.json unlocked"
            $unlocked++
        }

        # Remove user-level scheduled task
        $userTask = "patchwork-watchdog-$user"
        $existing = Get-ScheduledTask -TaskName $userTask -ErrorAction SilentlyContinue
        if ($existing) {
            Unregister-ScheduledTask -TaskName $userTask -Confirm:$false
            Write-Host "  [$user] Removed user scheduled task"
        }
    }
    Write-Host "  Unlocked $unlocked user(s)"
} else {
    Write-Host "  No user registry found"
    # Fallback: unlock current user
    $settings = Join-Path $env:USERPROFILE ".claude\settings.json"
    if (Test-Path $settings) {
        attrib -R $settings 2>$null
        Write-Host "  [$env:USERNAME] settings.json unlocked"
    }
}

# 2. Remove system scheduled task
Write-Host "`n[2/3] Removing system watchdog..."
$existing = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
    Write-Host "  Removed: $TASK_NAME"
} else {
    Write-Host "  Not found (already removed)"
}

# 3. Remove system directory
Write-Host "`n[3/3] Removing system directory..."
if (Test-Path $SYSTEM_DIR) {
    if ($KeepData) {
        Write-Host "  Keeping $SYSTEM_DIR (-KeepData)"
    } else {
        Remove-Item $SYSTEM_DIR -Recurse -Force
        Write-Host "  Removed: $SYSTEM_DIR"
    }
} else {
    Write-Host "  Not found"
}

Write-Host "`n=== Uninstall Complete ===" -ForegroundColor Green
Write-Host "  All users' settings.json files are unlocked"
Write-Host "  Hooks still installed but users can now modify them"
Write-Host "  Audit data preserved in each user's .patchwork\"
