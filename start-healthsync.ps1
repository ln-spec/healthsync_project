[CmdletBinding()]
param([switch]$ValidateOnly)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

function Read-EnvFile([string]$Path) {
  if (!(Test-Path $Path)) {
    throw "Required env file is missing: $Path"
  }

  $values = @{}
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    if ($line -match '^\s*([^#=\s]+)\s*=\s*(.*)$') {
      $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
  }
  return $values
}

function Test-PortListening([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    return $result.AsyncWaitHandle.WaitOne(300) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

$misplacedBackendEnv = Join-Path $backend ".env.local"
if (Test-Path $misplacedBackendEnv) {
  throw "backend/.env.local is not read by the API. Move browser NEXT_PUBLIC_* values to frontend/.env.local and backend settings to backend/.env."
}

$frontendEnv = Read-EnvFile (Join-Path $frontend ".env.local")
$backendEnv = Read-EnvFile (Join-Path $backend ".env")
$frontendKey = $frontendEnv["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
if (!$frontendKey) {
  $frontendKey = $frontendEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
}

foreach ($name in @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_API_BASE_URL")) {
  if ([string]::IsNullOrWhiteSpace($frontendEnv[$name])) {
    throw "Missing $name in frontend/.env.local."
  }
}
if ([string]::IsNullOrWhiteSpace($frontendKey)) {
  throw "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in frontend/.env.local."
}
foreach ($name in @("SUPABASE_URL", "SUPABASE_ANON_KEY")) {
  if ([string]::IsNullOrWhiteSpace($backendEnv[$name])) {
    throw "Missing $name in backend/.env."
  }
}
if ([string]::IsNullOrWhiteSpace($backendEnv["ALLOWED_ORIGINS"])) {
  throw "Missing ALLOWED_ORIGINS in backend/.env."
}
if ($frontendEnv["NEXT_PUBLIC_SUPABASE_URL"] -cne $backendEnv["SUPABASE_URL"] -or $frontendKey -cne $backendEnv["SUPABASE_ANON_KEY"]) {
  throw "Frontend and backend Supabase project settings differ. Use the same project URL and public key in both env files."
}
if ($frontendEnv["NEXT_PUBLIC_API_BASE_URL"].TrimEnd("/") -cne "http://127.0.0.1:8000/api/v1") {
  throw "For local startup, set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1."
}

$python = Join-Path $backend ".venv313\Scripts\python.exe"
if (!(Test-Path $python)) {
  & py -3.13 -m venv (Join-Path $backend ".venv313")
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create the Python 3.13 backend environment."
  }
}
& $python -c "import fastapi, supabase, pydantic_settings"
if ($LASTEXITCODE -ne 0) {
  & $python -m pip install -r (Join-Path $backend "requirements.txt")
  if ($LASTEXITCODE -ne 0) {
    throw "Backend dependency installation failed."
  }
}

if (!(Test-Path (Join-Path $frontend "node_modules\next\dist\bin\next"))) {
  Push-Location $frontend
  try {
    & npm install
    if ($LASTEXITCODE -ne 0) {
      throw "Frontend dependency installation failed."
    }
  } finally {
    Pop-Location
  }
}

$frontendPort = 0
foreach ($candidate in @(3000, 3001)) {
  if (!(Test-PortListening $candidate)) {
    $frontendPort = $candidate
    break
  }
}
if ($frontendPort -eq 0) {
  throw "Ports 3000 and 3001 are busy. Close an existing frontend dev server and retry."
}
if ($ValidateOnly) {
  Write-Output "Configuration is valid. The local frontend will use port $frontendPort."
  exit 0
}

$apiHealthy = $false
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2
  $apiHealthy = $health.status -eq "ok"
} catch {
  $apiHealthy = $false
}
if (!$apiHealthy) {
  if (Test-PortListening 8000) {
    throw "Port 8000 is busy but the HealthSync API health check failed."
  }
  Start-Process -FilePath $python -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000") -WorkingDirectory $backend
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2
      if ($health.status -eq "ok") {
        $apiHealthy = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
}
if (!$apiHealthy) {
  throw "The API did not become healthy. Check the backend window for startup errors."
}

$frontendOrigin = "http://127.0.0.1:$frontendPort"
$allowedOrigins = @($backendEnv["ALLOWED_ORIGINS"].Split(",") | ForEach-Object { $_.Trim() })
if ($allowedOrigins -notcontains $frontendOrigin) {
  throw "Add $frontendOrigin to ALLOWED_ORIGINS in backend/.env."
}
$cors = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/patients" -Method Options -Headers @{
  Origin = $frontendOrigin
  "Access-Control-Request-Method" = "GET"
  "Access-Control-Request-Headers" = "authorization,content-type"
} -UseBasicParsing -TimeoutSec 5
if ($cors.Headers["Access-Control-Allow-Origin"] -ne $frontendOrigin) {
  throw "The API did not allow the frontend origin $frontendOrigin."
}

$command = "npm run dev -- --hostname 127.0.0.1 --port $frontendPort"
Start-Process -FilePath $env:ComSpec -ArgumentList @("/c", $command) -WorkingDirectory $frontend
for ($attempt = 0; $attempt -lt 50; $attempt++) {
  try {
    $page = Invoke-WebRequest -Uri $frontendOrigin -UseBasicParsing -TimeoutSec 2
    if ($page.StatusCode -eq 200) {
      Write-Output "HealthSync is running at $frontendOrigin"
      exit 0
    }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
throw "The frontend did not become ready. Check its terminal window for startup errors."
