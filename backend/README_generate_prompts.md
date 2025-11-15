# Generate All Prompts Script

Script completo per generare automaticamente tutti i messaggi dei prompt per i templates e sistemare completamente il database.

## Prerequisiti

1. **Node.js 18+** (per supporto nativo a `fetch`)
2. **Connessione MongoDB** configurata correttamente

**NOTA**: Lo script genera i messaggi direttamente senza chiamare AI, quindi **NON serve** il server FastAPI in esecuzione!

## Come eseguire

### Esegui lo script

```bash
cd backend
node generate_all_prompts.js
```

### Attendi il completamento

Lo script:
- Scansiona tutti i templates nella collection `Task_Templates` (template di dati DDT)
- Estrae tutti i `stepPrompts` (root, mainData, subData)
- Genera GUID coordinati per ogni chiave legacy
- **Genera i messaggi direttamente** basandosi sul tipo di campo e step type (start, noMatch, noInput, confirmation, notConfirmed, success)
- Crea le translations multilingua (en, it, pt) nella collection `Translations`
- Aggiorna i templates con i GUID
- Salva il mapping chiave→GUID in `key_to_guid_mapping.json`

**Tempo stimato**: Molto veloce! Con ~20 templates e ~100 prompt groups, circa 1-2 minuti (nessuna chiamata AI).

## Cosa fa lo script

### STEP 1: Scansione Templates
- Legge tutti i templates da `factory.Task_Templates` (template di dati DDT)
- Estrae `stepPrompts` da:
  - `template.stepPrompts` (root level)
  - `template.subData[].stepPrompts` (subData root - atomici)
  - `template.mainData[].stepPrompts` (mainData level)
  - `template.mainData[].subData[].stepPrompts` (subData dentro mainData)

### STEP 2: Generazione GUID
- Per ogni chiave legacy trovata, genera un GUID univoco
- Mantiene un mapping consistente (stessa chiave → stesso GUID)

### STEP 3: Generazione Messaggi Diretta
- Per ogni campo con `stepPrompts`:
  - **Genera i messaggi direttamente** basandosi su:
    - Tipo di campo (phone, email, date, name, address, day, month, year, time, hour, minute, second, number, generic)
    - Tipo di step (start, noMatch, noInput, confirmation, notConfirmed, success)
  - Nessuna chiamata AI necessaria - molto più veloce e affidabile!

### STEP 4: Creazione Translations
- Per ogni GUID, crea entries in `factory.Translations`:
  ```javascript
  {
    guid: "xxx-xxx-xxx",
    language: "en|it|pt",
    text: "message text",
    type: "Template",
    projectId: null,
    createdAt: Date,
    updatedAt: Date
  }
  ```
- Usa `bulkWrite` con `upsert` per evitare duplicati

### STEP 5: Aggiornamento Templates
- Sostituisce tutte le chiavi legacy con GUID nei templates
- Aggiorna tutti i livelli (root, mainData, subData)

### STEP 6: Salvataggio Mapping
- Salva il mapping `chiave → GUID` in `key_to_guid_mapping.json`
- Utile per tracciabilità e debug

## Output

Lo script mostra:
- Progress in tempo reale
- Statistiche finali:
  - Templates processati
  - Prompt groups trovati
  - Messaggi generati
  - Translations create
  - Templates aggiornati
  - Errori (se presenti)

## Gestione Errori

- Se una chiamata AI fallisce, usa messaggi fallback
- Se il server FastAPI non è raggiungibile, usa solo fallback
- Gli errori vengono loggati ma non bloccano l'esecuzione

## File Generati

- `key_to_guid_mapping.json`: Mapping completo chiave → GUID per tracciabilità

## Note

- **Traduzioni**: Attualmente le traduzioni IT e PT usano lo stesso testo inglese (placeholder). Per traduzioni reali, implementare un servizio di traduzione nella funzione `translateMessage()`.
- **Generazione Diretta**: I messaggi sono generati direttamente nello script basandosi sul tipo di campo e step type. Nessuna chiamata AI necessaria!
- **Velocità**: Lo script è molto veloce perché non fa chiamate di rete.

## Troubleshooting

### "fetch is not defined"
- Assicurati di usare Node.js 18+
- Oppure installa `node-fetch`: `npm install node-fetch` e importalo

### "Connection refused" o "ECONNREFUSED"
- **Non dovrebbe più verificarsi** - lo script non chiama più il server FastAPI!

### "MongoServerError"
- Verifica la connessione MongoDB
- Controlla le credenziali in `MONGODB_URI`

### Script troppo lento
- **Non dovrebbe essere lento** - lo script genera messaggi direttamente senza chiamate di rete
- Se è lento, probabilmente è un problema di connessione MongoDB

