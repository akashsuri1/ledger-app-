param(
    [string]$JdkHome = $env:JAVA_HOME,
    [switch]$SkipQualityChecks
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$frontend = Join-Path $root "frontend"
$backend = Join-Path $root "backend"
$desktop = Join-Path $root "desktop"
$resources = [IO.Path]::GetFullPath((Join-Path $desktop "src-tauri\resources"))
$expectedResourceRoot = [IO.Path]::GetFullPath((Join-Path $root "desktop\src-tauri\resources"))
if ($resources -ne $expectedResourceRoot) { throw "Desktop resource staging path is invalid." }

if ([string]::IsNullOrWhiteSpace($JdkHome)) {
    throw "Set JAVA_HOME to the JDK 23 used to build LedgerFlow, or pass -JdkHome."
}
$jlink = Join-Path $JdkHome "bin\jlink.exe"
$java = Join-Path $JdkHome "bin\java.exe"
if (-not (Test-Path $jlink) -or -not (Test-Path $java)) {
    throw "JDK 23 with jlink is required: $JdkHome"
}

Push-Location $frontend
try {
    npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Frontend dependency install failed." }
    if (-not $SkipQualityChecks) {
        npm.cmd run lint
        if ($LASTEXITCODE -ne 0) { throw "Frontend lint failed." }
        npm.cmd test
        if ($LASTEXITCODE -ne 0) { throw "Frontend tests failed." }
    }
    Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend production build failed." }
} finally { Pop-Location }

$previousJavaHome = $env:JAVA_HOME
$env:JAVA_HOME = $JdkHome
Push-Location $backend
try {
    & .\mvnw.cmd clean package
    if ($LASTEXITCODE -ne 0) { throw "Backend package failed." }
} finally {
    Pop-Location
    $env:JAVA_HOME = $previousJavaHome
}

$jar = Join-Path $backend "target\ledgerflow-backend-0.1.0.jar"
if (-not (Test-Path $jar)) { throw "Packaged backend is missing: $jar" }

$runtime = [IO.Path]::GetFullPath((Join-Path $resources "runtime"))
if (-not $runtime.StartsWith($resources + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Runtime staging path escaped desktop resources."
}
if (Test-Path $runtime) { Remove-Item -LiteralPath $runtime -Recurse -Force }
[IO.Directory]::CreateDirectory($resources) | Out-Null
$modules = @(
    "java.base", "java.compiler", "java.desktop", "java.instrument", "java.logging",
    "java.management", "java.naming", "java.net.http", "java.security.jgss", "java.sql",
    "java.xml", "jdk.crypto.ec", "jdk.unsupported", "jdk.zipfs"
) -join ","
& $jlink --add-modules $modules --output $runtime --strip-debug --no-header-files --no-man-pages --compress=zip-6
if ($LASTEXITCODE -ne 0) { throw "Bundled Java runtime creation failed." }

$backendStage = Join-Path $resources "backend"
[IO.Directory]::CreateDirectory($backendStage) | Out-Null
Copy-Item -LiteralPath $jar -Destination (Join-Path $backendStage "ledgerflow-backend.jar") -Force

Push-Location $desktop
try {
    npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Desktop dependency install failed." }
} finally { Pop-Location }

Write-Output "M9_DESKTOP_RESOURCES_READY"
Write-Output "Runtime: $runtime"
Write-Output "Backend: $(Join-Path $backendStage 'ledgerflow-backend.jar')"
