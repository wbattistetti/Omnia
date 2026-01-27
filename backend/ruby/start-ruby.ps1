# PowerShell script per avviare il server Ruby con gestione errori
# Verifica se Ruby e bundle sono disponibili

$ErrorActionPreference = "Continue"

Write-Host "[RUBY] Verifica installazione Ruby..." -ForegroundColor Cyan

# Verifica se Ruby è disponibile
$rubyPath = Get-Command ruby -ErrorAction SilentlyContinue
if (-not $rubyPath) {
    Write-Host "[RUBY] ⚠️  Ruby non trovato nel PATH" -ForegroundColor Yellow
    Write-Host "[RUBY] Il server Ruby non verrà avviato" -ForegroundColor Yellow
    Write-Host "[RUBY] Per installare Ruby: https://rubyinstaller.org/" -ForegroundColor Yellow
    Write-Host "[RUBY] Dopo l'installazione, esegui: cd backend/ruby && bundle install" -ForegroundColor Yellow
    exit 0
}

Write-Host "[RUBY] ✅ Ruby trovato: $($rubyPath.Source)" -ForegroundColor Green

# Verifica se bundle è disponibile
$bundlePath = Get-Command bundle -ErrorAction SilentlyContinue
if (-not $bundlePath) {
    Write-Host "[RUBY] ⚠️  Bundle non trovato. Installazione..." -ForegroundColor Yellow
    gem install bundler
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[RUBY] ❌ Errore durante l'installazione di bundler" -ForegroundColor Red
        exit 1
    }
}

# Cambia directory alla directory dello script
$scriptPath = $MyInvocation.MyCommand.Path
if (-not $scriptPath) {
    # Se eseguito da npm, usa il percorso relativo
    $scriptPath = Join-Path $PSScriptRoot "start-ruby.ps1"
}
$scriptDir = Split-Path -Parent $scriptPath
if (Test-Path $scriptDir) {
    Set-Location $scriptDir
} else {
    # Fallback: usa la directory corrente se siamo già in backend/ruby
    if (Test-Path "Gemfile") {
        Write-Host "[RUBY] ✅ Directory corretta" -ForegroundColor Green
    } else {
        Write-Host "[RUBY] ⚠️  Directory non trovata: $scriptDir" -ForegroundColor Yellow
        Write-Host "[RUBY] Tentativo con directory corrente..." -ForegroundColor Yellow
    }
}

# Verifica se le gemme sono installate
if (-not (Test-Path "Gemfile.lock")) {
    Write-Host "[RUBY] Installazione gemme..." -ForegroundColor Cyan
    bundle install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[RUBY] ❌ Errore durante l'installazione delle gemme" -ForegroundColor Red
        exit 1
    }
}

# Avvia il server Sinatra direttamente (non Puma!)
# Sinatra rispetterà set :port, 3101 in app.rb
Write-Host "[RUBY] 🚀 Avvio server Sinatra su porta 3101..." -ForegroundColor Green
ruby app.rb
