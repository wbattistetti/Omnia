# PowerShell script to disable Visual Studio debugger property evaluation
# Run this script as Administrator or with appropriate permissions

Write-Host "Disabling Visual Studio debugger property evaluation..." -ForegroundColor Yellow

# Path to Visual Studio settings (adjust version number as needed)
$vsSettingsPath = "$env:APPDATA\Microsoft\VisualStudio\17.0\Settings\CurrentSettings.vssettings"

if (Test-Path $vsSettingsPath) {
    Write-Host "Found Visual Studio settings file: $vsSettingsPath" -ForegroundColor Green

    # Backup original settings
    $backupPath = "$vsSettingsPath.backup"
    Copy-Item $vsSettingsPath $backupPath -Force
    Write-Host "Backup created: $backupPath" -ForegroundColor Green

    # Read settings file
    [xml]$settings = Get-Content $vsSettingsPath

    # Note: This is a simplified approach. The actual settings structure is complex.
    # The recommended approach is to use Visual Studio's UI:
    # Tools → Options → Debugging → General → Uncheck "Enable property evaluation and other implicit function calls"

    Write-Host "`nIMPORTANT: This script cannot directly modify Visual Studio settings." -ForegroundColor Red
    Write-Host "Please use Visual Studio's UI instead:" -ForegroundColor Yellow
    Write-Host "1. Open Visual Studio" -ForegroundColor Cyan
    Write-Host "2. Go to Tools → Options" -ForegroundColor Cyan
    Write-Host "3. Navigate to Debugging → General" -ForegroundColor Cyan
    Write-Host "4. Uncheck 'Enable property evaluation and other implicit function calls'" -ForegroundColor Cyan
    Write-Host "5. Click OK and restart Visual Studio" -ForegroundColor Cyan

} else {
    Write-Host "Visual Studio settings file not found at: $vsSettingsPath" -ForegroundColor Red
    Write-Host "Please manually configure Visual Studio settings." -ForegroundColor Yellow
}

Write-Host "`nAlternatively, you can:" -ForegroundColor Yellow
Write-Host "- Run without debugger: Press Ctrl+F5 instead of F5" -ForegroundColor Cyan
Write-Host "- Or disable first-chance exceptions in Debug → Windows → Exception Settings" -ForegroundColor Cyan
