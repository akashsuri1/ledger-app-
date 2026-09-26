param(
    [string]$JdkHome = $env:JAVA_HOME,
    [switch]$SkipQualityChecks
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot "prepare-desktop.ps1") -JdkHome $JdkHome -SkipQualityChecks:$SkipQualityChecks
if ($LASTEXITCODE -ne 0) { throw "Desktop resource preparation failed." }

Push-Location (Join-Path $root "desktop")
try {
    $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
    $env:Path = "$cargoBin;$env:Path"
    npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw "Tauri Rust checks failed." }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Tauri installer build failed." }
} finally { Pop-Location }

Write-Output "M9_WINDOWS_INSTALLER_BUILT"
