@echo off
REM Script per avviare il server Ruby - usa percorsi assoluti, non dipende dal PATH

cd /d "%~dp0"

REM Percorsi assoluti di Ruby (non dipendono dal PATH)
set "RUBY_PATH=C:\Ruby33-x64\bin\ruby.exe"
set "BUNDLE_PATH=C:\Ruby33-x64\bin\bundle.bat"

echo [RUBY] Verifica installazione Ruby...

REM Verifica che Ruby esista
if not exist "%RUBY_PATH%" (
    echo [RUBY] ⚠️  Ruby non trovato in %RUBY_PATH%
    echo [RUBY] Il server Ruby non verrà avviato
    echo [RUBY] Per installare Ruby: https://rubyinstaller.org/
    exit /b 0
)

echo [RUBY] ✅ Ruby trovato: %RUBY_PATH%

REM Verifica che bundle esista
if not exist "%BUNDLE_PATH%" (
    echo [RUBY] ⚠️  Bundle non trovato. Installazione...
    "%RUBY_PATH%" -S gem install bundler
    if %errorlevel% neq 0 (
        echo [RUBY] ❌ Errore durante l'installazione di bundler
        exit /b 1
    )
)

REM Verifica se le gemme sono installate
if not exist Gemfile.lock (
    echo [RUBY] Installazione gemme...
    "%BUNDLE_PATH%" install
    if %errorlevel% neq 0 (
        echo [RUBY] ❌ Errore durante l'installazione delle gemme
        exit /b 1
    )
)

REM Controlla se la porta 3101 è già occupata
echo [RUBY] Verifica porta 3101...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3101 ^| findstr LISTENING') do (
    echo [RUBY] ⚠️  Porta 3101 già occupata dal processo %%a
    echo [RUBY] Terminazione processo precedente...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo [RUBY] ✅ Porta liberata
)

REM Avvia il server Sinatra direttamente (non Puma!)
REM Sinatra rispetterà set :port, 3101 in app.rb
echo [RUBY] 🚀 Avvio server Sinatra su porta 3101...
"%RUBY_PATH%" app.rb
