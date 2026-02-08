# CleverReply - Full Vencord + Plugin Installer
# Run: Right-click -> "Run with PowerShell"  (or execute in a terminal)

$ErrorActionPreference = "Stop"
$pluginName  = "CleverReply"
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$vencordDir  = Join-Path $env:USERPROFILE "Vencord"

function Write-Step  { param($msg) Write-Host ""  ; Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "    $msg" -ForegroundColor Red }

function Test-Command { param($cmd) $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) }

function Install-IfMissing {
    param($Name, $Cmd, $WingetId)
    if (Test-Command $Cmd) {
        Write-Ok "$Name is already installed."
        return
    }
    Write-Warn "$Name not found. Installing via winget..."
    & winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { throw "Failed to install $Name. Install it manually and re-run this script." }
    # Refresh PATH so the new binary is visible in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Test-Command $Cmd)) {
        throw "$Name was installed but '$Cmd' is still not on PATH. Close and reopen PowerShell, then re-run."
    }
    Write-Ok "$Name installed."
}

# ──────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   $pluginName  -  Full Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will:"
Write-Host "  1. Install Git, Node.js & pnpm (if missing)"
Write-Host "  2. Clone Vencord to $vencordDir"
Write-Host "  3. Install Vencord dependencies"
Write-Host "  4. Copy CleverReply plugin files"
Write-Host "  5. Build Vencord"
Write-Host "  6. Inject Vencord into Discord"
Write-Host ""
$go = Read-Host "Continue? (Y/n)"
if ($go -eq "n" -or $go -eq "N") { exit 0 }

# ── 1. Prerequisites ─────────────────────────────────────────────────────────

Write-Step "Checking prerequisites..."

if (-not (Test-Command "winget")) {
    Write-Err "winget is not available. Please install App Installer from the Microsoft Store."
    Read-Host "Press Enter to exit"
    exit 1
}

Install-IfMissing "Git"     "git"  "Git.Git"
Install-IfMissing "Node.js" "node" "OpenJS.NodeJS.LTS"

if (-not (Test-Command "pnpm")) {
    Write-Warn "pnpm not found. Installing..."
    & npm install -g pnpm
    if ($LASTEXITCODE -ne 0) { throw "Failed to install pnpm." }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}
Write-Ok "pnpm is ready."

# ── 2. Clone Vencord ─────────────────────────────────────────────────────────

Write-Step "Setting up Vencord..."

if (Test-Path (Join-Path $vencordDir "src")) {
    Write-Ok "Vencord already exists at $vencordDir, pulling latest..."
    Push-Location $vencordDir
    & git pull --ff-only 2>$null
    Pop-Location
} else {
    Write-Warn "Cloning Vencord to $vencordDir..."
    & git clone "https://github.com/Vendicated/Vencord.git" $vencordDir
    if ($LASTEXITCODE -ne 0) { throw "git clone failed." }
    Write-Ok "Cloned."
}

# ── 3. Install dependencies ──────────────────────────────────────────────────

Write-Step "Installing Vencord dependencies (pnpm install)..."

Push-Location $vencordDir
try {
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Frozen lockfile failed, trying regular install..."
        & pnpm install
        if ($LASTEXITCODE -ne 0) { throw "pnpm install failed." }
    }
    Write-Ok "Dependencies installed."
} finally { Pop-Location }

# ── 4. Copy plugin files ─────────────────────────────────────────────────────

Write-Step "Copying $pluginName plugin files..."

$userplugins = Join-Path $vencordDir "src\userplugins"
$destDir     = Join-Path $userplugins $pluginName

if (-not (Test-Path $userplugins)) {
    New-Item -ItemType Directory -Path $userplugins | Out-Null
}
if (Test-Path $destDir) {
    Remove-Item -Recurse -Force $destDir
}
New-Item -ItemType Directory -Path $destDir | Out-Null

$files = @("index.tsx", "cleverbot.ts", "native.ts")
foreach ($file in $files) {
    $src = Join-Path $scriptDir $file
    if (-not (Test-Path $src)) {
        throw "Missing $file in $scriptDir"
    }
    Copy-Item $src $destDir
    Write-Ok "Copied $file"
}

# ── 5. Build ─────────────────────────────────────────────────────────────────

Write-Step "Building Vencord..."

Push-Location $vencordDir
try {
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Build failed." }
    Write-Ok "Build complete."
} finally { Pop-Location }

# ── 6. Inject into Discord ───────────────────────────────────────────────────

Write-Step "Injecting Vencord into Discord..."
Write-Warn "CLOSE DISCORD COMPLETELY before continuing."
Write-Host ""
$ready = Read-Host "Is Discord fully closed? (Y/n)"
if ($ready -eq "n" -or $ready -eq "N") {
    Write-Warn "Please close Discord, then run 'pnpm inject' in $vencordDir"
} else {
    # Kill any lingering Discord processes
    Get-Process -Name "Discord*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Push-Location $vencordDir
    try {
        & pnpm inject
        if ($LASTEXITCODE -ne 0) { throw "Inject failed." }
        Write-Ok "Injection complete."
    } finally { Pop-Location }
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   All done!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Open Discord"
Write-Host "  2. Go to Settings -> Vencord -> Plugins"
Write-Host "  3. Search for '$pluginName' and enable it"
Write-Host "  4. Hover any message -> click the robot button"
Write-Host ""
Read-Host "Press Enter to exit"
