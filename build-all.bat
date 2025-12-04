@echo off
echo ========================================
echo CalenRecall - Building All Windows Releases
echo ========================================
echo.

REM Kill any running Electron or Node processes to prevent file locks
echo Closing any running Electron/Node processes...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
wmic process where "name like '%%electron%%' or name like '%%node%%'" delete >nul 2>&1
timeout /t 3 /nobreak >nul

REM Clean release folder and locked files
echo Cleaning previous build files...
if exist "release" (
    rd /s /q "release" >nul 2>&1
)
if exist "node_modules\better-sqlite3\build" (
    rd /s /q "node_modules\better-sqlite3\build" >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

echo Building application (includes rebuilding native dependencies for Electron)...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo.

echo Creating Windows distribution (both installer and portable)...
call npm run dist:win
if errorlevel 1 (
    echo ERROR: Distribution build failed
    pause
    exit /b 1
)
echo.

echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Release files are in the 'release' folder.
echo.

REM Open the release folder
if exist "release" (
    start explorer release
)

pause

