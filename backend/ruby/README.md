# VB.NET Runtime API Server (Ruby)

Server Ruby che espone API REST per chiamare il codice VB.NET compilato.

## Struttura

- `app.rb` - Applicazione Sinatra principale
- `lib/vbnet_client.rb` - Client per chiamare ApiServer.exe
- `routes/runtime.rb` - Route API per runtime (compile, ddt/run, ecc.)

## Installazione

```bash
cd backend/ruby
bundle install
```

## Avvio

```bash
bundle exec rackup config.ru
```

Il server sarà disponibile su `http://localhost:3101`

## API Endpoints

### POST /api/runtime/compile
Compila flowchart + DDT in lista piatta di task.

**Request:**
```json
{
  "nodes": [...],
  "edges": [...],
  "tasks": [...],
  "ddts": [...]
}
```

**Response:**
```json
{
  "tasks": [...],
  "entryTaskId": "...",
  "taskMap": {...},
  "compiledBy": "VB.NET_RUNTIME",
  "timestamp": "..."
}
```

### POST /api/runtime/ddt/run
Esegue un DDT usando il DDT Engine VB.NET.

**Request:**
```json
{
  "ddtInstance": {...},
  "userInputs": [...],
  "translations": {...},
  "limits": {...}
}
```

**Response:**
```json
{
  "success": true,
  "value": {...},
  "messages": [...],
  "executedBy": "VB.NET_RUNTIME",
  "timestamp": "..."
}
```

## Come funziona

1. Il server Ruby riceve una richiesta HTTP
2. Chiama `ApiServer.exe` (VB.NET) passando JSON via stdin
3. `ApiServer.exe` esegue il comando (compile-flow, run-ddt, ecc.)
4. `ApiServer.exe` scrive il risultato su stdout (JSON)
5. Il server Ruby legge stdout e risponde al client HTTP

## Note

- `ApiServer.exe` deve essere compilato prima di usare il server Ruby
- Il path a `ApiServer.exe` è configurato in `lib/vbnet_client.rb`
- Porta di default: 3101 (diversa da 3100 del server Node.js)


