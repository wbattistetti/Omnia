# ApiServer

Applicazione console VB.NET che espone funzionalità via stdin/stdout (JSON).

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

- Usato dal server Ruby per esporre API REST
- Tutta la comunicazione è via JSON (stdin/stdout)
- Gli errori vengono scritti su stdout come JSON con `success: false`


