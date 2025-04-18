bucket: logos
    - polici allow crud for all




create account



add ristourne-access-code



in admin mode pwershell
    - Set-ExecutionPolicy RemoteSigned



npm install --legacy-peer-deps





@echo off
echo Starting Docker Desktop...

start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

:: Wait for Docker to be ready
echo Waiting for Docker to start...
:waitDocker
timeout /t 5 >nul
docker info >nul 2>&1
if errorlevel 1 (
    goto waitDocker
)

echo Docker is running.

:: Change to your project directory
cd /d "C:\Users\BIOSIM\Desktop\lrms"

:: Start Supabase with npx
echo Starting Supabase with npx...
start "Supabase" cmd /c "npx supabase start --ignore-health-check"

:: Wait for Supabase to initialize (adjust time as needed)
echo Waiting for Supabase to initialize...
timeout /t 15 >nul

:: Start Vite preview server
echo Starting npm preview...
start "Vite Preview" cmd /c "npm run preview"

pause