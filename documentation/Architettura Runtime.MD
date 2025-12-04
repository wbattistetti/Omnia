# Architettura Runtime - DDT Engine e Flow Orchestrator

## Indice
1. [Panoramica](#panoramica)
2. [Architettura e Separazione](#architettura-e-separazione)
3. [Flusso Architetturale](#flusso-architetturale)
4. [Scalabilità e Cloud](#scalabilità-e-cloud)
5. [Session Management e Recovery](#session-management-e-recovery)

---

## Panoramica

Questo documento descrive l'**architettura** del sistema DDT Engine e Flow Orchestrator.

Per l'implementazione dettagliata del DDT Engine, vedi [Motori.MD](./Motori.MD).

### Principi Fondamentali

1. **Separazione Completa**: Frontend (React), Compilatore, DDT Engine e Flow Orchestrator sono completamente separati.
2. **Logica Deterministica**: Il DDT Engine segue una logica lineare e deterministica
3. **Macchina a Stati**: Ogni DataNode (main data o sub-data) ha uno stato (Dialogue State) che determina quale response mostrare
4. **Memory Centralizzata**: Tutti i valori raccolti sono salvati in un contesto globale (memory)
5. **Multi Layer Data Retrieval**: L'estrazione dei dati avviene utilizzando parser deterministici e/o sistemi statistici (regex/rules/NER/LLM)

---

## Architettura e Separazione

### Separazione Completa

```
┌─────────────────┐
│  React Frontend │  (UI, rendering, user interaction)
└────────┬────────┘
         │ HTTP/WebSocket
         │
┌────────▼─────────────────────────────┐
│     API Gateway / Backend Service    │
│  ┌─────────────────────────────────┐ │
│  │  Flow Orchestrator (VB.NET)     │ │
│  │  ┌───────────────────────────┐  │ │
│  │  │  Project Compiler (VB.NET)│  │ │
│  │  │  (compila Flow + DDT)     │  │ │
│  │  └───────────────────────────┘  │ │
│  │  ┌───────────────────────────┐  │ │
│  │  │  DDT Engine (VB.NET)       │  │ │
│  │  └───────────────────────────┘  │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Nota**: Il Project Compiler è un componente separato che compila sia il Flow che il DDT. Non è dentro l'Orchestrator, ma viene chiamato durante la fase di compilazione offline.

### Vantaggi della Separazione

1. **Scalabilità**: Backend scalabile indipendentemente
2. **Riusabilità**: Logica utilizzabile da web, mobile, API
3. **Testabilità**: Test della logica senza UI
4. **Manutenibilità**: Cambi al frontend non impattano backend e viceversa
5. **Deployment**: Frontend e backend deployabili separatamente

---

## Flusso Architetturale

### Logica del Flusso

La logica architetturale segue questo flusso:

```
1. Dati Progetto (nodes, edges, DDT definitions)
   ↓
2. Project Compiler (offline, una volta)
   ├─ Compila Flow in lista di Task
   └─ Compila DDT in struttura ottimizzata
   ↓
3. Struttura Dati Compilata (lista di Task, condizioni, DDT references)
   ↓
4. Flow Orchestrator (runtime, per ogni sessione)
   ├─ Legge struttura compilata
   ├─ Esegue Task in sequenza
   ├─ Valuta condizioni
   └─ Chiama DDT Engine quando necessario (GetData task)
       ↓
5. DDT Engine
   ├─ Esegue dialogo per raccogliere dati
   └─ Ritorna dati raccolti al Flow Orchestrator
```

**DDT (DataDialogueTemplate)**: Contiene le regole e i prompt necessari per gestire un dialogo che ha lo scopo di acquisire dei dati richiesti all'utente.

### Compilazione vs Runtime

**Compilazione (offline)**:
- Compila dati progetto in struttura ottimizzata
- Output: lista piatta di Task con condizioni pre-valutate
- Fatto una volta per progetto
- Struttura cachata per performance

**Runtime (per ogni sessione)**:
- Orchestrator legge struttura compilata
- Esegue Task in sequenza
- Chiama DDT Engine solo per GetData
- Stato session in memoria/Redis

### Dependency Injection

**Cosa significa "inietta DDT Engine"?**

Significa che il DDT Engine viene passato come dipendenza all'Orchestrator (dependency injection), invece di essere creato direttamente dentro l'Orchestrator. Questo permette:
- **Testabilità**: Puoi passare un mock per i test
- **Modularità**: Il DDT Engine può essere sostituito o configurato facilmente
- **Separazione**: L'Orchestrator non deve sapere come creare il DDT Engine

```pseudocode
// 1. COMPILAZIONE (offline, una volta)
compiledStructure = ProjectCompiler.compile(projectData)
// Salva in DB/cache

// 2. RUNTIME (per ogni sessione utente)
orchestrator = new FlowOrchestrator(compiledStructure)
orchestrator.setDDTEngine(ddtEngine)  // Dependency Injection

// 3. ESECUZIONE
orchestrator.start()
// Internamente:
//   - Legge Task dalla struttura compilata
//   - Esegue Task
//   - Se Task è GetData → chiama ddtEngine.Execute(ddtInstance)
//   - Continua con prossimo Task
```

### Scalabilità del Flusso

Questa architettura è scalabile perché:
- **Compilazione offline**: riduce carico a runtime
- **Orchestrator leggero**: legge solo, non compila
- **DDT Engine isolato**: componente riutilizzabile che legge una struttura dati + prompt e li esegue con una logica fissa deterministica
- **Struttura compilata**: può essere cachata e condivisa

---

## Scalabilità e Cloud

### Architettura Cloud-Native per Alto Traffico

Per migliaia di conversazioni simultanee, usa architettura cloud-native scalabile.

### Spiegazione Componenti (Parole Semplici)

**Layer**: Uno strato/logica separata del sistema. Ad esempio, l'API Layer è la logica che riceve le richieste HTTP.

**Gateway**: Il punto di ingresso del sistema. È come un portiere che smista le richieste verso i server giusti.

**Load Balancer**: Distribuisce il carico di lavoro tra più server. Se hai 1000 richieste, le divide tra 10 server (100 ciascuno).

**Container**: Un pacchetto che contiene la tua applicazione e tutte le sue dipendenze. È come una scatola che funziona ovunque tu la metta.

**Auto-scale**: Il sistema crea automaticamente nuovi container quando c'è tanto lavoro, e li elimina quando non servono più. È come assumere più dipendenti quando c'è lavoro e licenziarli quando non servono.

**Redis Cluster**: Una memoria condivisa veloce dove salvi le sessioni degli utenti. È come un armadietto condiviso accessibile da tutti i server.

**Pool**: Un gruppo di "lavoratori" pronti a lavorare. Quando arriva un lavoro, uno dei lavoratori lo prende e lo esegue in parallelo con gli altri.

**Message Queue**: Una coda dove metti i lavori da fare in modo asincrono. Invece di salvare subito su database (lento), metti il lavoro in coda e un worker lo processa dopo. Il sistema resta reattivo.

### Architettura Diagramma

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer              │
│              (AWS ALB, Azure Front Door, GCP LB)            │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│   API Layer  │  │   API Layer│  │   API Layer│
│  (Container) │  │ (Container)│  │ (Container)│
│  Auto-scale  │  │  Auto-scale│  │  Auto-scale│
└───────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│   Redis      │  │  Message   │  │  Compiled  │
│  Cluster     │  │   Queue    │  │  Structure │
│  (Sessions)  │  │  (RabbitMQ/│  │  (Cache)   │
│              │  │   SQS)     │  │            │
└──────────────┘  └────────────┘  └────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│  Flow        │  │  DDT       │  │  Database  │
│  Orchestrator│  │  Engine    │  │  (NoSQL)    │
│  (Stateless) │  │  (Pool)    │  │  (MongoDB/ │
│              │  │            │  │   CosmosDB)│
└──────────────┘  └────────────┘  └────────────┘
```

### Componenti Cloud

**API Layer (Stateless, Auto-scaling)**:
- Container (Docker/Kubernetes)
- Min replicas: 3-5
- Max replicas: 100+
- CPU/Memory based scaling

**Redis Cluster (Session State)**:
- AWS ElastiCache / Azure Cache / GCP Memorystore
- Session state distribuito
- TTL automatico (1 hour)
- AOF enabled per persistenza

**Message Queue (Async Processing)**:
- AWS SQS / Azure Service Bus / GCP Pub/Sub
- Task asincroni
- Decoupling

**Database (Persistenza)**:
- AWS DynamoDB / Azure CosmosDB / GCP Firestore
- Session backup
- Audit e analytics

### Pattern: Event-Driven + Stateless

```
┌─────────────────────────────────────────────────────────┐
│ 1. Richiesta Utente → API Gateway                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 2. API Layer (Stateless)                                │
│    - Valida richiesta                                   │
│    - Recupera sessionId da header/cookie                │
│    - Carica stato da Redis (se esiste)                  │
│      (per riprendere la sessione eventualmente interrotta)
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 3. Flow Orchestrator (Stateless)                        │
│    - Carica compiled structure da cache                 │
│    - Carica session state da Redis                      │
│    - Esegue task corrente                               │
│      (riprende dal punto interrotto)                    │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│ Task:        │  │ Task:      │  │ Task:      │
│ SayMessage   │  │ GetData    │  │ BackendCall│
│ (Sync)       │  │ (Async)    │  │ (Async)    │
└───────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│ Task:        │  │ Task:       │  │ Task:      │
│ EndCall      │  │ TransferTo  │  │ SendEmail  │
│              │  │ Operator    │  │            │
└───────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 4. DDT Engine (Pool)                                    │
│    - Chiamato solo per GetData task                     │
│    - Può essere servizio separato                       │
│    - Pool di worker per parallelizzazione               │
│      (gruppo di processi pronti a lavorare in parallelo)│
└───────┬─────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────┐
│ 5. Salvataggio Stato (Async)                            │
│    - Aggiorna Redis (fast)                              │
│    - Pubblica evento su Message Queue                   │
│      (coda asincrona per lavori da processare dopo)     │
│    - Worker asincrono salva su DB                       │
└─────────────────────────────────────────────────────────┘
```

**Altri Task Executors necessari**:
- `EndCall`: Chiude la telefonata
- `TransferToOperator`: Trasferisce all'operatore
- `SendEmail`: Invia email
- `SendSMS`: Invia SMS
- Altri task custom

### Performance Targets

Per migliaia di conversazioni:
- Throughput: 10,000+ req/sec
- Latency: < 100ms (p95)
- Availability: 99.9%+
- Session Recovery: < 500ms
- Auto-scaling: < 2 min response time

---

## Session Management e Recovery

### Strategia Ibrida (Raccomandato)

Approccio bilanciato: in-memory + persistenza async + recovery.

### Spiegazione in Parole Semplici

**Come funziona il Recovery delle Sessioni:**

Immagina che un utente sta parlando con il bot. Ad ogni risposta, il sistema salva:
1. **Redis (Hot Cache)**: Salvataggio veloce in memoria. È come prendere appunti su un foglio velocemente.
2. **Database (Backup)**: Salvataggio più lento ma permanente. È come scrivere tutto su un quaderno.
3. **Replica (Failover)**: Una copia di backup di Redis. Se il primo Redis va giù, si usa la copia.

**Cosa succede se il sistema va giù?**
- Se Redis va giù, la replica prende il posto automaticamente (< 30 secondi)
- Se anche la replica va giù, si recupera dall'ultimo snapshot del database
- Gli eventi critici (come "dato confermato") sono sempre salvati subito sul database

```
┌─────────────────────────────────────────────────────────┐
│  Request Processing                                      │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│   Redis      │  │   DB       │  │   Replica  │
│  (Hot Cache) │  │  (Backup)  │  │  (Failover)│
│  TTL: 1h     │  │  (Async)   │  │  AOF       │
└───────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
            ┌───────────▼───────────┐
            │  Recovery Strategy:   │
            │  - Redis replica       │
            │  - DB backup          │
            │  - Eventi critici sync│
            └───────────────────────┘
```

### Gestione Sessioni

**Redis (Primary)**:
```pseudocode
session:{sessionId} = {
  state: {...},
  currentTask: 5,
  variables: {...},
  lastActivity: timestamp,
  ttl: 3600  // 1 hour
}
```

**Persistenza (Backup)**:
- Salvataggio ogni 30 secondi O evento critico
- Snapshot completo ogni 5 minuti
- Cold storage per sessioni completate

**Recovery (Se Redis va giù)**:
1. Redis replica: failover automatico (< 30s)
2. DB backup: recovery da ultimo snapshot
3. Eventi critici: sempre salvati sync

### Eventi Critici (Sync)

Questi eventi vengono salvati sincronamente:
- Task completion
- DDT step complete
- User confirmation
- Validation passed/failed

### Implementazione

```pseudocode
CLASSE SessionManager:
    redis: RedisCluster
    db: Database
    backupQueue: MessageQueue

    METODO saveState(sessionId, state, isCritical):
        // Sempre salva su Redis (fast)
        redis.set(sessionId, state, ttl=3600)

        SE isCritical:
            // Eventi critici: salva sync
            db.save(sessionId, state)
        ALTRIMENTI:
            // Altri eventi: salva async
            backupQueue.enqueue(sessionId, state)

    METODO recoverSession(sessionId):
        // Prova Redis prima
        state = redis.get(sessionId)
        SE state ESISTE:
            RITORNA state

        // Se Redis vuoto, recupera da DB
        state = db.load(sessionId)
        SE state ESISTE:
            // Ricrea in Redis
            redis.set(sessionId, state, ttl=3600)
            RITORNA state

        // Nessuna sessione trovata
        RITORNA null
```

### Risposta: Recovery Garantito?

**Con architettura proposta (solo Redis)**: NO - se Redis va giù, le sessioni attive si perdono.

**Con architettura migliorata (Redis + DB + Replica)**: SÌ - puoi riprendere:
- **Redis replica**: failover automatico (< 30s)
- **DB backup**: recovery da ultimo snapshot
- **Eventi critici**: sempre salvati sync

---
