# Setup Ruby Server - Guida Rapida

## Situazione Attuale

Il server Ruby è **opzionale**. Se Ruby non è installato, gli altri server (Node.js e FastAPI) funzioneranno comunque.

## Installazione Ruby (Opzionale)

### Se vuoi usare il compilatore VB.NET:

1. **Scarica Ruby Installer**
   - Vai su: https://rubyinstaller.org/
   - Scarica **Ruby+Devkit** (versione x64)

2. **Installa Ruby**
   - Durante l'installazione, seleziona: ✅ "Add Ruby executables to your PATH"
   - Completa l'installazione

3. **Installa le gemme**
   ```powershell
   cd backend/ruby
   bundle install
   ```

4. **Riavvia il terminale** e riprova:
   ```bash
   npm run dev:beNew
   ```

## Test Senza Ruby

Puoi testare le **traduzioni in memoria** usando solo il server Node.js:

1. Avvia solo Express e FastAPI:
   ```bash
   npm run be:express
   npm run be:apiNew
   ```

2. Il server Node.js (porta 3100) gestisce `/api/runtime/compile` con supporto traduzioni

## Verifica Installazione

```powershell
ruby --version
bundle --version
```

Se vedi le versioni, Ruby è installato correttamente.

## Troubleshooting

### "bundle non è riconosciuto"
- Riavvia il terminale dopo l'installazione
- Verifica PATH: `echo $env:Path` (dovrebbe contenere il percorso di Ruby)

### Il server Ruby non si avvia
- Controlla i log: vedrai `[RUBY] ⚠️ Ruby non trovato nel PATH`
- Gli altri server continueranno a funzionare normalmente

## Note

- **Node.js (porta 3100)**: ✅ Funziona sempre, supporta traduzioni
- **FastAPI (porta 8000)**: ✅ Funziona sempre
- **Ruby (porta 3101)**: ⚠️ Opzionale, necessario solo per VB.NET compiler
