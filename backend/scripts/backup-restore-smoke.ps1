param(
    [int]$Port = 18086
)

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = [IO.Path]::GetFullPath((Join-Path $backendRoot "target"))
$runRoot = [IO.Path]::GetFullPath((Join-Path $targetRoot ("m6-smoke-" + [guid]::NewGuid().ToString("N"))))
if (-not $runRoot.StartsWith($targetRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw "Smoke-test directory escaped the backend target directory."
}
[IO.Directory]::CreateDirectory($runRoot) | Out-Null

$jar = Join-Path $targetRoot "ledgerflow-backend-0.0.1-SNAPSHOT.jar"
$java = Join-Path $env:JAVA_HOME "bin\java.exe"
$database = Join-Path $runRoot "ledgerflow.db"
$data = Join-Path $runRoot "data"
$cookies = Join-Path $runRoot "cookies.txt"
$response = Join-Path $runRoot "response.json"
$request = Join-Path $runRoot "request.json"
$backup = Join-Path $runRoot "company.lfbak"
$attachment = Join-Path $runRoot "invoice.pdf"
$download = Join-Path $runRoot "restored.pdf"
$stdout = Join-Path $runRoot "server.out.log"
$stderr = Join-Path $runRoot "server.err.log"
$base = "http://127.0.0.1:$Port"
$passphrase = "smoke backup passphrase"
$process = $null

function Write-Utf8([string]$Path, [string]$Value) {
    [IO.File]::WriteAllText($Path, $Value, [Text.UTF8Encoding]::new($false))
}

function Invoke-Curl([string[]]$Arguments) {
    & curl.exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "curl failed with exit code $LASTEXITCODE" }
}

function Get-Csrf {
    Invoke-Curl @("--fail-with-body", "-sS", "-c", $cookies, "-b", $cookies,
        "$base/api/auth/csrf", "-o", $response)
    $line = Get-Content $cookies | Where-Object { $_ -match "XSRF-TOKEN" } | Select-Object -Last 1
    if (-not $line) { throw "CSRF cookie was not issued." }
    return (($line -split "`t")[-1])
}

function Invoke-JsonMutation([string]$Method, [string]$Path, [string]$Body) {
    $token = Get-Csrf
    Write-Utf8 $request $Body
    Invoke-Curl @("--fail-with-body", "-sS", "-X", $Method, "-c", $cookies, "-b", $cookies,
        "-H", "Content-Type: application/json", "-H", "X-XSRF-TOKEN: $token",
        "--data-binary", "@$request", "$base$Path", "-o", $response)
    return (Get-Content $response -Raw | ConvertFrom-Json)
}

function Invoke-Get([string]$Path) {
    Invoke-Curl @("--fail-with-body", "-sS", "-b", $cookies, "$base$Path", "-o", $response)
    return (Get-Content $response -Raw | ConvertFrom-Json)
}

try {
    if (-not (Test-Path $jar)) { throw "Packaged JAR is missing: $jar" }
    if (-not (Test-Path $java)) { throw "JAVA_HOME must point to a working JDK." }
    $arguments = @(
        "-Dserver.port=$Port",
        "-Dledgerflow.database.path=$database",
        "-Dledgerflow.data-dir=$data",
        "-Dledgerflow.backups.pbkdf2-iterations=100000",
        "-Dlogging.level.root=WARN",
        "-jar", $jar
    )
    $process = Start-Process -FilePath $java -ArgumentList $arguments -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $ready = $false
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if ($process.HasExited) { throw "Packaged JAR exited before becoming ready." }
        try {
            Invoke-Curl @("--fail", "-s", "--connect-timeout", "1", "$base/api/auth/csrf", "-o", $response)
            $ready = $true
            break
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (-not $ready) { throw "Packaged JAR did not become ready." }

    Invoke-JsonMutation "POST" "/api/auth/register" `
        '{"name":"Smoke Owner","email":"smoke-m6@example.com","password":"correct horse battery staple"}' | Out-Null
    Invoke-JsonMutation "POST" "/api/auth/login" `
        '{"email":"smoke-m6@example.com","password":"correct horse battery staple"}' | Out-Null
    $company = (Invoke-JsonMutation "POST" "/api/companies" `
        '{"name":"Smoke Company","address":"Smoke Road","phone":"9876543210"}').data.id
    $region = (Invoke-JsonMutation "POST" "/api/companies/$company/regions" `
        '{"name":"Punjab"}').data.id
    $party = (Invoke-JsonMutation "POST" "/api/companies/$company/parties" `
        ("{`"regionId`":$region,`"name`":`"Smoke Party`",`"phone`":`"9876543210`"}")).data.id
    $transaction = (Invoke-JsonMutation "POST" "/api/companies/$company/transactions" `
        ("{`"partyId`":$party,`"type`":`"CREDIT`",`"amount`":25000," +
         "`"transactionDate`":`"2026-09-13`",`"description`":`"Smoke invoice`"}")).data.id

    Write-Utf8 $attachment "%PDF-1.4`nLedgerFlow M6 smoke"
    $token = Get-Csrf
    Invoke-Curl @("--fail-with-body", "-sS", "-X", "POST", "-c", $cookies, "-b", $cookies,
        "-H", "X-XSRF-TOKEN: $token", "-F", "file=@$attachment;type=application/pdf",
        "$base/api/companies/$company/transactions/$transaction/attachment", "-o", $response)

    $token = Get-Csrf
    Write-Utf8 $request ("{`"passphrase`":`"$passphrase`"}")
    Invoke-Curl @("--fail-with-body", "-sS", "-X", "POST", "-c", $cookies, "-b", $cookies,
        "-H", "Content-Type: application/json", "-H", "X-XSRF-TOKEN: $token",
        "--data-binary", "@$request", "$base/api/companies/$company/backup", "-o", $backup)
    if ((Get-Item $backup).Length -lt 64) { throw "Encrypted backup was unexpectedly small." }

    Invoke-JsonMutation "DELETE" "/api/companies/$company/transactions/$transaction" '{}' | Out-Null
    if ((Invoke-Get "/api/companies/$company/dashboard").data.transactionCount -ne 0) {
        throw "Original Company mutation was not applied."
    }

    $token = Get-Csrf
    Invoke-Curl @("--fail-with-body", "-sS", "-X", "POST", "-c", $cookies, "-b", $cookies,
        "-H", "X-XSRF-TOKEN: $token", "-F", "file=@$backup;type=application/vnd.ledgerflow.backup",
        "-F", "passphrase=$passphrase", "$base/api/backups/restore/preview", "-o", $response)
    $preview = Get-Content $response -Raw | ConvertFrom-Json
    if (-not $preview.data.valid -or $preview.data.counts.transactions -ne 1 -or
            $preview.data.counts.attachments -ne 1) { throw "Restore preview counts were incorrect." }

    $token = Get-Csrf
    Invoke-Curl @("--fail-with-body", "-sS", "-X", "POST", "-c", $cookies, "-b", $cookies,
        "-H", "X-XSRF-TOKEN: $token", "-F", "file=@$backup;type=application/vnd.ledgerflow.backup",
        "-F", "passphrase=$passphrase", "-F", "companyName=Smoke Company Restored",
        "$base/api/backups/restore/commit", "-o", $response)
    $restoredCompany = (Get-Content $response -Raw | ConvertFrom-Json).data.companyId
    $restoredParty = (Invoke-Get "/api/companies/$restoredCompany/parties").data[0].id
    $restoredTransaction = (Invoke-Get "/api/companies/$restoredCompany/transactions").data[0].id

    Invoke-Curl @("--fail-with-body", "-sS", "-b", $cookies,
        "$base/api/companies/$restoredCompany/transactions/$restoredTransaction/attachment", "-o", $download)
    if (-not [Linq.Enumerable]::SequenceEqual([byte[]][IO.File]::ReadAllBytes($attachment),
            [byte[]][IO.File]::ReadAllBytes($download))) { throw "Restored attachment bytes differ." }
    $dashboard = Invoke-Get "/api/companies/$restoredCompany/dashboard"
    if ($dashboard.data.netBalance -ne 25000 -or $dashboard.data.transactionCount -ne 1) {
        throw "Restored Dashboard totals were incorrect."
    }
    $statement = Invoke-Get "/api/companies/$restoredCompany/reports/party-statement?partyId=$restoredParty"
    if ($statement.data.closingBalance -ne 25000 -or $statement.data.displayedTransactionCount -ne 1) {
        throw "Restored Statement totals were incorrect."
    }
    Invoke-JsonMutation "POST" "/api/auth/logout" '{}' | Out-Null
    Write-Output "BACKUP_RESTORE_SMOKE_OK"
} finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
        $process.WaitForExit()
    }
}
