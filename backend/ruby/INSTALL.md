# Installazione Ruby per Omnia

## Requisiti

Il server Ruby è necessario solo se vuoi usare il compilatore VB.NET. Se usi solo il compilatore TypeScript (Node.js), puoi saltare questa installazione.

## Installazione su Windows

### 1. Scarica Ruby Installer

Vai su: https://rubyinstaller.org/

Scarica la versione **Ruby+Devkit** (raccomandata) per la tua architettura (x64).

### 2. Installa Ruby

1. Esegui l'installer scaricato
2. Durante l'installazione, seleziona:
   - ✅ "Add Ruby executables to your PATH"
   - ✅ "Associate .rb and .rbw files with this Ruby installation"
3. Completa l'installazione

### 3. Installa le gemme del progetto

Apri PowerShell o CMD nella directory del progetto e esegui:

```powershell
cd backend/ruby
bundle install
```

### 4. Verifica installazione

```powershell
ruby --version
bundle --version
```

Dovresti vedere le versioni di Ruby e Bundler.

## Avvio automatico

Dopo l'installazione, il server Ruby verrà avviato automaticamente quando esegui:

```bash
npm run dev:beNew
# o
npm run dev:allNew
```

## Avvio manuale

Se vuoi avviare solo il server Ruby:

```powershell
cd backend/ruby
bundle exec rackup config.ru
```

Il server sarà disponibile su `http://localhost:3101`

## Troubleshooting

### "bundle non è riconosciuto"

- Verifica che Ruby sia nel PATH: `where ruby`
- Riavvia il terminale dopo l'installazione
- Verifica che l'opzione "Add Ruby executables to your PATH" sia stata selezionata durante l'installazione

### "Gemfile.lock non trovato"

Esegui `bundle install` nella directory `backend/ruby`

### "ApiServer.exe not found"

Il server Ruby richiede che `ApiServer.exe` sia compilato. Vedi `VBNET/ISTRUZIONI_COMPILAZIONE.md`
