@echo off
REM ─────────────────────────────────────────────────────────
REM  update-installer-date.bat
REM
REM  Reads version from package.json, stamps it + today's date
REM  into installer.iss so Inno Setup produces a filename like
REM  CalenRecall_Setup_2026.1.14-beta.5.2026-07-21.exe
REM
REM  Run this BEFORE compiling installer.iss in Inno Setup.
REM ─────────────────────────────────────────────────────────
cd /d "%~dp0"

if not exist "package.json" (
    echo [31mERROR: package.json not found. Run from project root.[0m
    pause
    exit /b 1
)
if not exist "installer.iss" (
    echo [31mERROR: installer.iss not found in current directory.[0m
    pause
    exit /b 1
)

REM ── Get version from package.json ──
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "& { $v = (Get-Content 'package.json' | ConvertFrom-Json).version; Write-Host $v -NoNewline }"`) do set "VERSION=%%V"
if "%VERSION%"=="" (
    echo [31mERROR: Could not read version from package.json.[0m
    pause
    exit /b 1
)

REM ── Get current date in YYYY-MM-DD format (locale-independent) ──
for /f "tokens=2 delims==" %%I in ('"wmic os get localdatetime /value"') do set "dt=%%I"
set "TODAY=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%"

echo.
echo [36m============================================[0m
echo  CalenRecall — Stamp Installer
echo  Version: %VERSION%
echo  Date:    %TODAY%
echo [36m============================================[0m
echo.

REM ── Update MyAppVersion and BuildDate in installer.iss ──
powershell -NoProfile -Command ^
    "$c = Get-Content 'installer.iss'; " ^
    "$c = $c -replace '(?<=#define MyAppVersion \")[^\"]+', '%VERSION%'; " ^
    "$c = $c -replace '(?<=#define BuildDate \")[^\"]+', '%TODAY%'; " ^
    "Set-Content 'installer.iss' $c -Encoding UTF8"

if errorlevel 1 (
    echo [31mERROR: Failed to update installer.iss.[0m
    pause
    exit /b 1
)

echo [32m✓ installer.iss updated — v%VERSION% / %TODAY%[0m
echo.
echo Next step: Open installer.iss in Inno Setup Compiler and click Compile.
echo.
pause
