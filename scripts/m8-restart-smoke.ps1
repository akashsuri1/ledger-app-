param([int]$Port = 18088)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$target = [IO.Path]::GetFullPath((Join-Path $root "backend\target"))
$run = [IO.Path]::GetFullPath((Join-Path $target ("m8-restart-" + [guid]::NewGuid().ToString("N"))))
if (-not $run.StartsWith($target + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Restart-test directory escaped the backend target directory."
}
[IO.Directory]::CreateDirectory($run) | Out-Null
$data = Join-Path $run "data"
$jar = Join-Path $target "ledgerflow-backend-0.0.1-SNAPSHOT.jar"
$java = Join-Path $env:JAVA_HOME "bin\java.exe"
$base = "http://127.0.0.1:$Port"
$cookies = Join-Path $run "cookies.txt"
$request = Join-Path $run "request.json"
$response = Join-Path $run "response.json"
$attachment = Join-Path $run "invoice.pdf"
$download = Join-Path $run "download.pdf"
$process = $null

function Utf8([string]$Path, [string]$Value) { [IO.File]::WriteAllText($Path, $Value, [Text.UTF8Encoding]::new($false)) }
function Invoke-Curl([string[]]$Arguments) { & curl.exe @Arguments; if ($LASTEXITCODE -ne 0) { throw "curl failed ($LASTEXITCODE)" } }
function Csrf {
    Invoke-Curl @("--fail-with-body", "-sS", "-c", $cookies, "-b", $cookies, "$base/api/auth/csrf", "-o", $response)
    $line = Get-Content $cookies | Where-Object { $_ -match "XSRF-TOKEN" } | Select-Object -Last 1
    if (-not $line) { throw "CSRF cookie was not issued" }
    return (($line -split "`t")[-1])
}
function Mutate([string]$Method, [string]$Path, [string]$Body) {
    $token = Csrf; Utf8 $request $Body
    Invoke-Curl @("--fail-with-body", "-sS", "-X", $Method, "-c", $cookies, "-b", $cookies,
        "-H", "Content-Type: application/json", "-H", "X-XSRF-TOKEN: $token", "--data-binary", "@$request", "$base$Path", "-o", $response)
    return (Get-Content $response -Raw | ConvertFrom-Json)
}
function GetApi([string]$Path) {
    Invoke-Curl @("--fail-with-body", "-sS", "-b", $cookies, "$base$Path", "-o", $response)
    return (Get-Content $response -Raw | ConvertFrom-Json)
}
function Start-Backend([int]$Sequence) {
    $script:process = Start-Process $java -ArgumentList @("-Dserver.port=$Port", "-Dledgerflow.data-dir=$data",
        "-Dlogging.level.root=WARN", "-jar", $jar) -WorkingDirectory (Join-Path $root "backend") -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $run "backend-$Sequence.out.log") -RedirectStandardError (Join-Path $run "backend-$Sequence.err.log")
    $readinessError = ""
    for ($attempt = 0; $attempt -lt 360; $attempt++) {
        if ($script:process.HasExited) { throw "Backend exited during start $Sequence" }
        try {
            Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri "$base/api/health" | Out-Null
            return
        } catch {
            $readinessError = $_.Exception.Message
            Start-Sleep -Milliseconds 250
        }
    }
    throw "Backend did not start ($Sequence): $readinessError"
}
function Stop-Backend {
    if ($script:process -and -not $script:process.HasExited) { Stop-Process $script:process.Id -Force; $script:process.WaitForExit() }
    $script:process = $null
}

try {
    if (-not (Test-Path $java)) { throw "JAVA_HOME must point to a working JDK" }
    if (-not (Test-Path $jar)) { throw "Package the backend first" }
    Start-Backend 1
    Mutate POST "/api/auth/register" '{"name":"Restart Owner","email":"m8-restart@example.com","password":"correct horse battery staple"}' | Out-Null
    Mutate POST "/api/auth/login" '{"email":"m8-restart@example.com","password":"correct horse battery staple"}' | Out-Null
    $company = (Mutate POST "/api/companies" '{"name":"Restart Company"}').data.id
    $region = (Mutate POST "/api/companies/$company/regions" '{"name":"North"}').data.id
    $party = (Mutate POST "/api/companies/$company/parties" "{`"regionId`":$region,`"name`":`"Persistent Party`"}").data.id
    $transaction = (Mutate POST "/api/companies/$company/transactions" "{`"partyId`":$party,`"type`":`"CREDIT`",`"amount`":12345,`"transactionDate`":`"2026-09-15`",`"description`":`"Persistent invoice`"}").data.id
    Utf8 $attachment "%PDF-1.4`nM8 restart persistence"
    $token = Csrf
    Invoke-Curl @("--fail-with-body", "-sS", "-X", "POST", "-c", $cookies, "-b", $cookies, "-H", "X-XSRF-TOKEN: $token",
        "-F", "file=@$attachment;type=application/pdf", "$base/api/companies/$company/transactions/$transaction/attachment", "-o", $response)
    Stop-Backend

    if (-not (Test-Path (Join-Path $data "ledgerflow.db"))) { throw "Default database was not created under LEDGERFLOW_DATA_DIR" }
    Start-Backend 2
    $bootstrap = (GetApi "/api/me/bootstrap").data
    if ($bootstrap.companies.Count -ne 1 -or $bootstrap.companies[0].id -ne $company) { throw "Session or company did not survive restart" }
    if ((GetApi "/api/companies/$company/dashboard").data.netBalance -ne 12345) { throw "Ledger did not survive restart" }
    Invoke-Curl @("--fail-with-body", "-sS", "-b", $cookies, "$base/api/companies/$company/transactions/$transaction/attachment", "-o", $download)
    if (-not [Linq.Enumerable]::SequenceEqual([byte[]][IO.File]::ReadAllBytes($attachment), [byte[]][IO.File]::ReadAllBytes($download))) { throw "Attachment did not survive restart" }
    Write-Output "M8_RESTART_PERSISTENCE_OK"
} finally {
    Stop-Backend
}
