param([int]$Port = 18109)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$resources = [IO.Path]::GetFullPath((Join-Path $root "desktop\src-tauri\resources"))
$runtime = Join-Path $resources "runtime\bin\javaw.exe"
$jar = Join-Path $resources "backend\ledgerflow-backend.jar"
$target = [IO.Path]::GetFullPath((Join-Path $root "backend\target"))
$run = [IO.Path]::GetFullPath((Join-Path $target ("m9-runtime-" + [guid]::NewGuid().ToString("N"))))
if (-not $run.StartsWith($target + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Runtime-test directory escaped backend target."
}
[IO.Directory]::CreateDirectory($run) | Out-Null
$data = Join-Path $run "data"
$token = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$base = "http://127.0.0.1:$Port"
$process = $null
try {
    if (-not (Test-Path $runtime) -or -not (Test-Path $jar)) { throw "Run prepare-desktop.ps1 first." }
    $process = Start-Process $runtime -ArgumentList @(
        "-Dserver.port=$Port", "-Dserver.address=127.0.0.1", "-Dspring.profiles.active=desktop",
        "-Dledgerflow.data-dir=$data", "-Dledgerflow.desktop.shutdown-token=$token", "-jar", $jar
    ) -WorkingDirectory $run -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $run "backend.out.log") -RedirectStandardError (Join-Path $run "backend.err.log")
    $ready = $false
    for ($attempt = 0; $attempt -lt 240; $attempt++) {
        if ($process.HasExited) { throw "Bundled backend exited before readiness." }
        try {
            $health = Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 1
            if ($health.status -eq "UP") { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw "Bundled backend readiness timed out." }
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen
    if ($listener.LocalAddress -ne "127.0.0.1") { throw "Backend was not bound exclusively to IPv4 loopback." }
    $dashboardHtml = (Invoke-WebRequest -UseBasicParsing -Uri "$base/dashboard").Content
    if ($dashboardHtml -notmatch "LedgerFlow") { throw "Desktop SPA route did not return the production UI." }
    if (Get-Command java.exe -ErrorAction SilentlyContinue) {
        $oldPath = $env:Path
        try {
            $env:Path = "$env:SystemRoot\System32;$env:SystemRoot"
            if (Get-Command java.exe -ErrorAction SilentlyContinue) { throw "Java remained available on the isolated PATH." }
            if ((Invoke-RestMethod -Uri "$base/api/health").status -ne "UP") { throw "Bundled runtime stopped without system Java." }
        } finally { $env:Path = $oldPath }
    }
    Invoke-RestMethod -Method Post -Uri "$base/api/desktop/shutdown" -Headers @{"X-LedgerFlow-Shutdown"=$token} | Out-Null
    if (-not $process.WaitForExit(10000)) { throw "Backend did not stop gracefully." }
    if (-not (Test-Path (Join-Path $data "ledgerflow.db"))) { throw "SQLite was not created in the test app-data directory." }
    Write-Output "M9_BUNDLED_RUNTIME_OK"
    Write-Output "M9_CLEAN_SHUTDOWN_OK"
} finally {
    if ($process -and -not $process.HasExited) { Stop-Process $process.Id -Force }
}
