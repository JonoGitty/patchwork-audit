@echo off
setlocal enabledelayedexpansion

:: Patchwork Audit — build & run helper
:: Usage:
::   run.bat              — show help
::   run.bat setup        — install pnpm + deps + build (first time)
::   run.bat dev          — run CLI in dev mode (tsx, no build needed)
::   run.bat build        — build all packages
::   run.bat test         — run all tests
::   run.bat lint         — lint the codebase
::   run.bat clean        — clean build artifacts
::   run.bat <any args>   — pass args to patchwork CLI (e.g. run.bat status)

cd /d "%~dp0"

:: ── Check Node.js ──
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is not installed. Download from https://nodejs.org
    exit /b 1
)

:: ── Ensure pnpm is available ──
where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    echo [*] pnpm not found — enabling via corepack...
    call corepack enable
    if !errorlevel! neq 0 (
        echo [*] corepack failed — installing pnpm globally via npm...
        call npm install -g pnpm@9.15.0
        if !errorlevel! neq 0 (
            echo [ERROR] Could not install pnpm. Try manually: npm install -g pnpm
            exit /b 1
        )
    )
    :: Verify pnpm is now available
    where pnpm >nul 2>&1
    if !errorlevel! neq 0 (
        echo [*] corepack enabled but pnpm not in PATH — installing via npm...
        call npm install -g pnpm@9.15.0
        if !errorlevel! neq 0 (
            echo [ERROR] Could not install pnpm. Try manually: npm install -g pnpm
            exit /b 1
        )
    )
)

:: ── Install deps if node_modules missing ──
if not exist "node_modules" (
    echo [*] Installing dependencies...
    call pnpm install
    if !errorlevel! neq 0 (
        echo [ERROR] pnpm install failed.
        exit /b 1
    )
)

:: ── Route subcommands ──
if "%~1"=="" goto help
if /i "%~1"=="setup" goto setup
if /i "%~1"=="dev"   goto dev
if /i "%~1"=="build" goto build
if /i "%~1"=="test"  goto test
if /i "%~1"=="lint"  goto lint
if /i "%~1"=="clean" goto clean
goto cli

:help
echo.
echo  Patchwork Audit — the audit trail for AI coding agents
echo  -------------------------------------------------------
echo  Usage:  run.bat [command]
echo.
echo  Commands:
echo    setup        First-time setup (install pnpm, deps, build)
echo    dev          Run CLI in dev mode (no build needed)
echo    build        Build all packages
echo    test         Run all tests
echo    lint         Lint the codebase
echo    clean        Clean build artifacts
echo    ^<args^>       Pass arguments to the patchwork CLI
echo.
echo  Examples:
echo    run.bat setup
echo    run.bat dev
echo    run.bat build
echo    run.bat test
echo    run.bat status
echo    run.bat init --help
echo.
goto end

:setup
echo [*] === Patchwork first-time setup ===
echo.
echo [1/3] Ensuring pnpm...
where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    call corepack enable
    call npm install -g pnpm@9.15.0
)
call pnpm --version
echo.
echo [2/3] Installing dependencies...
call pnpm install
if !errorlevel! neq 0 (
    echo [ERROR] pnpm install failed.
    exit /b 1
)
echo.
echo [3/3] Building all packages...
call pnpm build
if !errorlevel! neq 0 (
    echo [ERROR] Build failed.
    exit /b 1
)
echo.
echo [OK] Setup complete! Try: run.bat dev
goto end

:dev
echo [*] Starting patchwork CLI in dev mode...
call pnpm --filter patchwork-audit dev -- %2 %3 %4 %5 %6 %7 %8 %9
goto end

:build
echo [*] Building all packages...
call pnpm build
goto end

:test
echo [*] Running tests...
call pnpm test
goto end

:lint
echo [*] Linting...
call pnpm lint
goto end

:clean
echo [*] Cleaning build artifacts...
call pnpm clean
goto end

:cli
:: Build first if dist doesn't exist
if not exist "packages\cli\dist\index.js" (
    echo [*] No build found — building first...
    call pnpm build
    if !errorlevel! neq 0 (
        echo [ERROR] Build failed.
        exit /b 1
    )
)
echo [*] Running: patchwork %*
node packages\cli\dist\index.js %*
goto end

:end
endlocal
