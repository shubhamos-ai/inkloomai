@echo off
setlocal enabledelayedexpansion

title Inkloom AI Launcher
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo ===================================================================
echo             INKLOOM AI - ENTERPRISE AD COMPLIANCE ENGINE           
echo ===================================================================
echo.

:: 1. Validate Environment Files
echo [Inkloom] Checking environment configuration...
if not exist "%ROOT_DIR%.env" (
    if not exist "%ROOT_DIR%.env.local" (
        if exist "%ROOT_DIR%.env.example" (
            copy "%ROOT_DIR%.env.example" "%ROOT_DIR%.env" >nul
            echo [WARN] Root .env missing. Created from .env.example.
        )
    )
)

if not exist "%ROOT_DIR%server\.env" (
    if exist "%ROOT_DIR%server\.env.example" (
        copy "%ROOT_DIR%server\.env.example" "%ROOT_DIR%server\.env" >nul
        echo [WARN] Server .env missing. Created from server\.env.example.
    )
)

:: 2. Ensure Local MongoDB Daemon is Running
echo [Inkloom] Checking local MongoDB instance on port 27017...
netstat -ano | findstr :27017 >nul 2>&1
if errorlevel 1 (
    echo [Inkloom] Starting local MongoDB daemon on port 27017...
    if not exist "C:\Users\SHIVAM\mongodb\data" mkdir "C:\Users\SHIVAM\mongodb\data"
    start "Inkloom AI - MongoDB Database (:27017)" cmd /k "C:\Users\SHIVAM\mongodb\bin\mongod.exe --dbpath C:\Users\SHIVAM\mongodb\data --port 27017 --bind_ip 127.0.0.1"
    timeout /t 3 /nobreak >nul
) else (
    echo [Inkloom] Local MongoDB is active and accepting connections.
)

:: 3. Setup Python Virtual Environment and Backend Dependencies
echo [Inkloom] Validating backend runtime (Python & FastAPI)...
if not exist "%ROOT_DIR%server\.venv\Scripts\activate.bat" (
    echo [Inkloom] Setting up Python virtual environment in server\.venv...
    python -m venv "%ROOT_DIR%server\.venv"
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment. Ensure Python is installed.
        pause
        exit /b 1
    )
    echo [Inkloom] Installing backend requirements...
    "%ROOT_DIR%server\.venv\Scripts\pip.exe" install -r "%ROOT_DIR%server\requirements.txt"
) else (
    echo [Inkloom] Backend virtual environment verified.
)

:: 4. Setup Frontend Dependencies
echo [Inkloom] Validating frontend client dependencies...
if not exist "%ROOT_DIR%node_modules" (
    echo [Inkloom] node_modules missing. Running npm install...
    call npm.cmd install --legacy-peer-deps
) else (
    echo [Inkloom] Frontend node_modules verified.
)

:: 5. Start Services in Parallel
echo.
echo [Inkloom] Starting backend API on http://127.0.0.1:8000 ...
start "Inkloom AI - Backend Server (:8000)" cmd /k "cd /d ""%ROOT_DIR%server"" && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [Inkloom] Starting background analysis worker...
start "Inkloom AI - Background Worker" cmd /k "cd /d ""%ROOT_DIR%server"" && call .venv\Scripts\activate.bat && python -m app.worker"

echo [Inkloom] Starting frontend Next.js dev server on http://localhost:3000 ...
start "Inkloom AI - Frontend Client (:3000)" cmd /k "cd /d ""%ROOT_DIR%"" && npm.cmd run dev"

:: 6. Display Status Banner
echo.
echo ===================================================================
echo           ALL INKLOOM AI SERVICES RUNNING SUCCESSFULLY!            
echo ===================================================================
echo.
echo   [Frontend Web Client]   http://localhost:3000
echo   [Onboarding Flow]       http://localhost:3000/onboarding
echo   [Compliance Dashboard]  http://localhost:3000/dashboard
echo   [FastAPI Backend]       http://localhost:8000
echo   [Swagger Interactive]   http://localhost:8000/docs
echo   [Ad Verifier Endpoint]  http://localhost:8000/api/verify-ad
echo   [Health Check]          http://localhost:8000/api/v1/health
echo   [MongoDB Database]      mongodb://127.0.0.1:27017/inkloom
echo.
echo ===================================================================
echo   Separate terminal windows have opened for MongoDB, Backend & Frontend.
echo   Press any key to close this launcher (services keep running).
echo ===================================================================
pause >nul
