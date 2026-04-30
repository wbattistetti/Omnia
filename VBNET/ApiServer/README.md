# ApiServer

## Variabili d’ambiente ElevenLabs (avvio)

L’host risale le directory (fino a 20 livelli) da `cwd` e da `AppContext.BaseDirectory` e, **per ogni** cartella visitata, carica se esistono `.env` e `.env.local`, e se esiste la sottocartella `backend` anche `backend/.env` e `backend/.env.local` (allineato a `backend/server.js`). L’ultimo file caricato vince su chiavi duplicate. In alternativa: `OMNIA_DOTENV_PATH` verso un singolo file. **DotNetEnv** applica le variabili al processo.

All’avvio vengono salvate le variabili `ELEVENLABS_*` già presenti nel **processo** (es. impostate come variabili utente/sistema in Windows), poi si caricano i file `.env`; se un file contiene la stessa chiave **vuota**, il valore precedente viene ripristinato; infine, se serve, si rileggono User/Machine. La **chiave API** non blocca l’avvio: deve essere disponibile per le chiamate ElevenLabs (come prima), tipicamente da env o da `backend/.env`.

Obbligatorio per avviare il proxy HTTP ElevenLabs:

- `ELEVENLABS_API_BASE` — es. `https://api.eu.residency.elevenlabs.io/v1` (normalizzato senza doppio `/v1` nelle URL).

Vedi `backend/.env.example`.

---

Applicazione console VB.NET (legacy: documentazione sotto riferita a modalità stdin/stdout; l’eseguibile attuale espone soprattutto l’API HTTP Kestrel su `http://localhost:5000`).

## Funzionalità

- Riceve comandi JSON da stdin
- Esegue operazioni (compile-flow, compile-ddt, run-ddt)
- Scrive risultati JSON su stdout

## Comandi supportati

### compile-flow
Compila flowchart in lista piatta di task.

**Input:**
```json
{
  "command": "compile-flow",
  "data": {
    "nodes": [...],
    "edges": [...],
    "tasks": [...],
    "ddts": [...]
  }
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "tasks": [...],
    "entryTaskId": "...",
    "taskMap": {...}
  }
}
```

### compile-ddt
Compila un DDT da file JSON.

**Input:**
```json
{
  "command": "compile-ddt",
  "data": {
    "jsonFilePath": "path/to/ddt.json"
  }
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "validationErrors": [],
    "instance": {...}
  }
}
```

### run-ddt
Esegue un DDT usando il DDT Engine.

**Input:**
```json
{
  "command": "run-ddt",
  "data": {
    "ddtInstance": {...},
    "userInputs": [...],
    "translations": {...},
    "limits": {...}
  }
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "value": {...},
    "messages": [...]
  }
}
```

## Uso

```bash
# Esegui comando
echo '{"command":"compile-flow","data":{...}}' | ApiServer.exe

# Il risultato viene scritto su stdout
```

## Note

- Tutta la comunicazione è via JSON (stdin/stdout)
- Gli errori vengono scritti su stdout come JSON con `success: false`


