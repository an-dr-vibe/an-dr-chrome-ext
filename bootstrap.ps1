# an-dr Chrome Extensions - Bootstrap
# Clones the repo to ~/.chrome-an-dr and runs the installer.
#
# One-liner to paste on a new machine:
#   irm https://raw.githubusercontent.com/YOUR_USER/an-dr-chrome-ext/main/bootstrap.ps1 | iex

param(
    [string]$RepoUrl = "https://github.com/YOUR_USER/an-dr-chrome-ext.git",
    [string]$InstallDir = "$HOME\.chrome-an-dr"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        an-dr Chrome Extensions - Bootstrap           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Git check ────────────────────────────────────────────────────────────────

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: git is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Install it from https://git-scm.com and re-run this script." -ForegroundColor Yellow
    exit 1
}

# ── Clone or update ───────────────────────────────────────────────────────────

if (Test-Path "$InstallDir\.git") {
    Write-Host "Repo already exists at $InstallDir — pulling latest..." -ForegroundColor Yellow
    git -C $InstallDir pull
} else {
    Write-Host "Cloning into $InstallDir ..." -ForegroundColor White
    git clone $RepoUrl $InstallDir
}

Write-Host ""

# ── Run installer ─────────────────────────────────────────────────────────────

& "$InstallDir\install.ps1"
