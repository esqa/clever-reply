# CleverReply Vencord Plugin Installer
# Run: Right-click -> "Run with PowerShell" or execute in a terminal

$ErrorActionPreference = "Stop"
$pluginName = "CleverReply"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "=== $pluginName Installer ===" -ForegroundColor Cyan
Write-Host ""

# --- Locate Vencord source directory ---

$vencordDir = $null
$searchPaths = @(
    "$env:USERPROFILE\Vencord",
    "$env:USERPROFILE\Documents\Vencord",
    "$env:USERPROFILE\Desktop\Vencord",
    "$env:USERPROFILE\Downloads\Vencord",
    "C:\Vencord",
    "D:\Vencord"
)

foreach ($path in $searchPaths) {
    if (Test-Path (Join-Path $path "src")) {
        $vencordDir = $path
        break
    }
}

if ($vencordDir) {
    Write-Host "Found Vencord at: $vencordDir" -ForegroundColor Green
    $confirm = Read-Host "Use this path? (Y/n)"
    if ($confirm -eq "n" -or $confirm -eq "N") {
        $vencordDir = $null
    }
}

if (-not $vencordDir) {
    $vencordDir = Read-Host "Enter your Vencord source directory path"
    $vencordDir = $vencordDir.Trim('"').Trim("'")
}

if (-not (Test-Path (Join-Path $vencordDir "src"))) {
    Write-Host "ERROR: '$vencordDir' doesn't look like a Vencord source directory (no src/ folder)." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# --- Copy plugin files ---

$destDir = Join-Path $vencordDir "src\userplugins\$pluginName"

Write-Host ""
Write-Host "Installing to: $destDir" -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $vencordDir "src\userplugins"))) {
    New-Item -ItemType Directory -Path (Join-Path $vencordDir "src\userplugins") | Out-Null
}

if (Test-Path $destDir) {
    Remove-Item -Recurse -Force $destDir
}
New-Item -ItemType Directory -Path $destDir | Out-Null

$files = @("index.tsx", "cleverbot.ts", "native.ts")
foreach ($file in $files) {
    $src = Join-Path $scriptDir $file
    if (-not (Test-Path $src)) {
        Write-Host "ERROR: Missing $file in $scriptDir" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Copy-Item $src $destDir
    Write-Host "  Copied $file" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Files copied successfully!" -ForegroundColor Green

# --- Build Vencord ---

Write-Host ""
$doBuild = Read-Host "Build Vencord now? (Y/n)"

if ($doBuild -eq "n" -or $doBuild -eq "N") {
    Write-Host ""
    Write-Host "Skipped build. Run 'pnpm build' in $vencordDir when ready." -ForegroundColor Yellow
    Write-Host "Then restart Discord to load the plugin."
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "Building Vencord..." -ForegroundColor Yellow

Push-Location $vencordDir
try {
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" }
    Write-Host ""
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Restart Discord, then enable '$pluginName' in:" -ForegroundColor Cyan
    Write-Host "  Settings -> Vencord -> Plugins -> $pluginName" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Build failed: $_" -ForegroundColor Red
    Write-Host "Try running 'pnpm build' manually in $vencordDir" -ForegroundColor Yellow
} finally {
    Pop-Location
}

Write-Host ""
Read-Host "Press Enter to exit"
