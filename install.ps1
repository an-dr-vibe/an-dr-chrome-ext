# an-dr Chrome Extensions - Installer
# Run with: powershell -ExecutionPolicy Bypass -File install.ps1

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$manifests = Get-ChildItem -Path $RepoDir -Recurse -Depth 2 -Filter "manifest.json"

if ($manifests.Count -eq 0) {
    Write-Host "No extensions found (no manifest.json in subdirectories)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          an-dr Chrome Extensions Installer           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Found $($manifests.Count) extension(s):" -ForegroundColor White
Write-Host ""

foreach ($manifest in $manifests) {
    $dir = $manifest.DirectoryName
    $json = Get-Content $manifest.FullName -Raw | ConvertFrom-Json
    $name = if ($json.name) { $json.name } else { Split-Path -Leaf $dir }

    Write-Host "  • $name" -ForegroundColor Yellow
    Write-Host "    Path: $dir" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Steps:" -ForegroundColor White
Write-Host "  1. Go to  chrome://extensions"
Write-Host "  2. Enable 'Developer mode' (toggle, top-right)"
Write-Host "  3. Click 'Load unpacked' and select the folder above"
Write-Host ""

# Try to open Chrome
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    Write-Host "Opening chrome://extensions..." -ForegroundColor Green
    Start-Process $chrome "chrome://extensions"
} else {
    Write-Host "(Chrome not found — open it manually)" -ForegroundColor DarkYellow
}
