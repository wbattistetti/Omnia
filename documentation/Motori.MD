# Motori - DDT Engine e Flow Orchestrator

## Indice
1. [Panoramica](#panoramica)
2. [Architettura e Separazione](#architettura-e-separazione)
3. [Flusso Architetturale](#flusso-architetturale)
4. [Scalabilità e Cloud](#scalabilità-e-cloud)
5. [Session Management e Recovery](#session-management-e-recovery)
6. [DDT Engine - Logica Semplificata](#ddt-engine---logica-semplificata)
7. [Pseudo-Codice Completo](#pseudo-codice-completo)
8. [Funzioni Principali](#funzioni-principali)
9. [Decisioni di Design](#decisioni-di-design)

---

## Panoramica

Questo documento descrive la logica del **DDT Engine** e del **Flow Orchestrator**.

### Principi Fondamentali

1. **Separazione Completa**: Frontend (React), Compilatore, DDT Engine e Flow Orchestrator sono completamente separati.
2. **Logica Deterministica**: Il DDT Engine segue una logica lineare e deterministica
3. **Macchina a Stati**: Ogni nodo (main data o sub-data) ha uno stato che determina quale response mostrare
4. **Memory Centralizzata**: Tutti i valori raccolti sono salvati in un contesto globale (memory)
5. **Multi Layer Data Retireval**: L'estrazione dei dati avviene utilizzando pareser determinstici e/o sistmei statistici (regex/rules/NER/LLM)

---

## Architettura e Separazione

### Separazione Completa

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
│  │  │  Flow Compiler (VB.NET)   │  │ │
│  │  └───────────────────────────┘  │ │
│  │  ┌───────────────────────────┐  │ │
│  │  │  DDT Engine (VB.NET)       │  │ │
│  │  └───────────────────────────┘  │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
DOMANDA: PERCHE IL FLOW COMPILER L'HIA MESSO DENTRO IL FLOW ORCHESTRATOR? PERCHE' L'HAI CHAIAMTO FLOW COMPILER? E' UN COMPILER GENERALE PERCHE ANCHE IL DDT VIENE COMPILATO VEDREMO COME.
```

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
2. Flow Compiler (offline, una volta)
   ↓
3. Struttura Dati Compilata (lista di Task, condizioni, DDT references)
   ↓
4. Flow Orchestrator (runtime, per ogni sessione)
   ├─ Legge struttura compilata
   ├─ Esegue Task in sequenza
   ├─ Valuta condizioni
   └─ Chiama DDT Engine quando necessario (GetData task) DDT STA PER DATADIALOGUETEMPLATE E CONTIENE LE REGOLE E I PROMPT NECESSARI PER GESTIRE UN DIALOGO CHE HA LO SCOPO DI ACQUISIRE DEI DATI CHIESIT ALL'UTENTE
       ↓
5. DDT Engine
   ├─ Esegue dialogo per raccogliere dati
   └─ Ritorna dati raccolti al Flow Orchestrator
```

### Compilazione vs Runtime

**Compilazione (offline)**:
- Compila dati progetto in struttura ottimizzata
- Output: lista piatta di Task con condizioni pre-valutate
- Fatto una volta per progetto
- Struttura cachata per performance

**Runtime (per sessione)**:
- Orchestrator legge struttura compilata
- Esegue Task in sequenza
- Chiama DDT Engine solo per GetData
- Stato session in memoria/Redis

### Implementazione

```pseudocode
// 1. COMPILAZIONE (offline, una volta)
compiledStructure = FlowCompiler.compile(projectData)
// Salva in DB/cache

// 2. RUNTIME (per ogni sessione utente)
orchestrator = new FlowOrchestrator(compiledStructure)
orchestrator.setDDTEngine(ddtEngine)  // inietta DDT Engine 'COSA VUOL DIRE CHE INIETTA IL DDTENGINE?

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
- **DDT Engine isolato**: componente riutilizzabile: LEGGE UNA STRUTTURA DATI + PROMPT E EL ESEGUE CON UNA LOGICA FISSA DETERMINSITCA.
- **Struttura compilata**: può essere cachata e condivisa

INIZIO DOCUMENTO DI ARCHITETTURA ====================================================================================================


## Scalabilità e Cloud

### Architettura Cloud-Native per Alto Traffico

Per migliaia di conversazioni simultanee, usa architettura cloud-native scalabile:
ù
MI DEVI SPIEGARE MOLTO PIU IN DETTALGIO IN MODO SEMPLICE QUESTA ARCHITTETTURA PERCHE' IO NON SO NULLA DI ARCHIETTURA MA VOGLIO CAPIRE CON PAROLE NON TECNICHE: COS0è UN LAYER, UN GATEWAY, KOAD BALANCER, CONTAINER (AUTO SCALE) , REDIS CLUSTER , POOL
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

```pseudocode
┌─────────────────────────────────────────────────────────┐
│ 1. Richiesta Utente → API Gateway                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 2. API Layer (Stateless)                                │
│    - Valida richiesta                                   │
│    - Recupera sessionId da header/cookie                │
│    - Carica stato da Redis (se esiste)                  │ 'CAARICA LO STATO PER RIPRENDERE LA SESISONE EVENTUALEMTNE INTERROTTA?
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 3. Flow Orchestrator (Stateless)                        │
│    - Carica compiled structure da cache                 │
│    - Carica session state da Redis                      │
│    - Esegue task corrente                               │  'RIPRENDE DAL PUNTO INTERROTTO?
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│ Task:        │  │ Task:      │  │ Task:      │  QUI IN REALTA' OCCORRONO ALTRI ESECUTORI SI TASKS COME AD ESEMSPIO: CHIUDI LA
│ SayMessage   │  │ GetData    │  │ BackendCall│  TELEFOANTA, TRASFERISCI AD OPERATORE, INVIA EMAIL, INVIA SMS, ECC
│ (Sync)       │  │ (Async)    │  │ (Async)    │
└───────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 4. DDT Engine (Pool)                                    │
│    - Chiamato solo per GetData task                     │
│    - Può essere servizio separato                       │
│    - Pool di worker per parallelizzazione               │ COSA E' UN POOL DI WORKER?
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ 5. Salvataggio Stato (Async)                            │
│    - Aggiorna Redis (fast)                              │
│    - Pubblica evento su Message Queue                   │  COSA E' MESSAGE QUEUE A COSA A SERVE
│    - Worker asincrono salva su DB                       │
└─────────────────────────────────────────────────────────┘
```

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

```
SPIEGA IN DETTAGLIO SOTTO IN PAROLE POVERE E NON TECNICHE
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

FINE DOCUMENTO DI ARCHITETTURA ======================================================================================================

## DDT Engine - Logica Semplificata

### Flusso Principale

Il DDT Engine segue un flusso DETERMINSTICO

1. **Execute**: Funzione principale che coordina il processo
2. **retrieveData**: Recupera un dato singolo (main o sub)
3. **confirmData**: Chiede conferma se necessario
4. **validateData**: Valida il dato con le condizioni definite

### Stati Disponibili
POSSIAMO CHIAMARLI DIALOGUE STATES?

| Stato | Descrizione | Quando si attiva |
|-------|-------------|------------------|
| **start** | Stato iniziale, è LA RICHESTA INIZIALE DEL dato | Quando il nodo diventa attivo |
| **noMatch** | Input non riconosciuto | ESTRATTORE ritorna `noMatch` |
| **absoluteNoMatch** | Match assoluto non riconosciuto | Variante di noMatch | C'E' GIA' NO MATCH NO? ASOLUTE NO MATCH NON SERVE
| **irrelevantMatch**  Match su altro nodo |
| **noInput** | Input vuoto | Utente non inserisce nulla |
| **confirmation** | Chiede conferma del dato | Dato recuperato e confirmation prevista |
| **notConfirmed** | Dato non confermato | Utente risponde "no" alla confirmation |
| **retrieved** | Dato recuperato | Dopo match o confirmation |
| **validated** | Dato validato | Dopo tutte le validazioni passate |
| **success** | Dato completato | Dopo validated (se success response esiste) |

---
LA LOGICA DI BASE è QUESTA:
IO DEVO PROCEDERE A FARE DOMANDE FINO A CHE HO TUTI I DATI RIEMPITI , CONFERMATI (OPZIONALE)  E VALIDATI (OPZIONALE).
MI FERMO, OVVERO ESCO DAL EXECUTE(DATAINSTANCE), O QUANDO HO TUTTO (SUCCESS) OPPURE QUANDO HO TERMINATO TUTTI I TENTATIVI DI RECOVERY.
QUI OVVIAMENTE SI POTREBBE ANCHE APRIRE LA POSSIBILITà DI NON USCIRE DEL TUTTO DAL DDT MA SOLO DAL MAINDATA CEH NO NSI RIESCE A COMPRENDERE.
PER ESEMPIO POREI NON COMPRENDERE NOME E COGNOME MA PRIMA DI TRASFERIE A OPERATORE CHEIDERE TELEFONO, INDIRIZZIO ECC (STUDIARE QUESTA POSSIBILITA') AL MOMENTO ESCE AL PRIMO "ESAURIMENTO" DI TENTATIVI.

QUIN SI TRATTA DI ITERARE DOMANDA (REPSONSE) - ACQUSIZIONE. IL RESPONSE DIPENDE DALLA STATO DEL DIALOGO) IN CUI VADO A TROVARMI: START, NOMATCH, DA CONFERMARE, NON VALIDO, ECC.

QUINDI UN CICLO DEL TIPO:

DO
  DE HAI ESTRATTO TUTTO O HAI TERMINATO I TENTATIVI DI RECOVERY ESCI
  ESEGUI IL RESPONSE IL DIALOGUE STATE CORRENTE
  ESTRAI DATI DALLA RISPOSTA DELL'UTENTE
LOOP

OVVIAMENTE QUANDO SONO IN CONFERMA QUELLO CHE DEVO ESTARRE DALLA RISPOSTA DELL'UTENTE E' ANCHE IL CONTENUTO DELLA RISPOSTA SI'/NO

QUESTE OSSERVAZIONI TI DOVREBBERO GUIDARE A RAFFINARE IL PSEUDO CODICE.

DOBBIAMO TROVARE ANCEH UN NOME APPROPRIATO PER DDT (DATADIALOGUETEMPLATE) IN REALà NEL DDT RACCOLGI TANTE INFORMAZIONI.
1) LA STRUTUTRA DI DATI CHE DEVO RACCOGLIERE (ie dATI PERSONALE = NOMINATIVO (NOME, COGNOME) , INDIRIZZO (TIPO VIA, NOME VIA, NUMERICO CIVICO ECC )
2) I PROMPT TEMAPLTE CHE DEVO USARE PER CHEIDERE I VARI DATI / SOTTODATI
3) EVENTUALI REGOLE DI VALIDAZIONE E MESSAGGI INFORMATIVI RELATIVI
4) MESSAGGI PER IL NOMATCH E IL NO INPUT E IL SUCCESS

POTREI CHIAMARLO DATA DIALOGUE TEMPLATE NON MI PARE MALE COME NOME IN EFFETTI.
MA ALLORA NODE POSSIAMO CHAIMARLO COME DATANODE (CHE DA' L'IDEA CHE LA STRUTTURA DATI POTREBBE ESSERE UN ALBERO CON PIU MAINDADATA CIASCUN MAINDA CON SOTTODATI ) COSA NE PENSI?


## Pseudo-Codice Completo

### Funzione Principale: Execute  IL DDT INSTANCE

```pseudocode
FUNZIONE Execute(DDTInstance):
    state = 'start'

    SE DDTInstance.isAggregate E DDTInstance.introduction ESISTE:
        executeResponse(DDTInstance.introduction)  'PER ESEMPIO: " Ora avrei bisogno dei dati personali del paziente"

    MENTRE true:  'qui parte un loop
        dataToRetrieve = GetNextData(DDTInstance)  // primo maindata vuoto o non valido o primo subdata vuoto o non valido

        SE dataToRetrieve === null:
            // Tutti i dati completati: i dati sono già nel contesto globale
            // Non ritorna nulla, l'esecuzione termina naturalmente
            INTERROMPI

        // 1. Retrieve
        retrieveData(dataToRetrieve, state)  'RETRIEVEDATA SOSTANZAILMENTE FA UNA RICHIESTA (PROMPT) E INTERPRETA LA RISPOSTA E AL SUO INTERNO GESTISCE IL NO MATCH, L'IRRELEVANT MATCH, E IL NOINPUT.

        QUI OVVIAMENTE POTREI ANCHE AVERE ESAURITO TUTTI I TENTAVI DI RECOVERY E QUIN POTREI VOLER USCIRE. UNA SOLUZIONE POTREBBE ESSERE CHE DATA RETRIVE RESTIUISCA DEI VALORI: SUCCESS, FAILED (FAILED VUOL DIRE CHE LA CONVERSAZIONE CON IL BOT è TERMINATA: O TRASFERITA ALL'OPERATORE O CHIUSA)
        IF FAILED THEN INTERROMPI TUTTO.

        // 2. Confirm (se necessario) SE ARRIVA QUEI è PERCHE' UN DATO "CANDIDATO" E' STATO ESTRATTO
        SE requiresConfirmation(dataToRetrieve):
            confirmData(dataToRetrieve, state) 'CONFIRM DATA GETISCE IL RICONSICMENTO DEL SI/NO QUINDI EVENTUALMENTE CON UNA SUA RECOVERY.

        QUI MANCA CHE SE IL DATO NON è CONFERMATO

        // 3. Validate
        SE NOT validateData(dataToRetrieve):
            state = 'invalid'  // getResponse sa quale response prendere
            // Loop continua: retrieveData riprenderà con state='invalid'
```

### Funzione: retrieveData

```pseudocode
FUNZIONE retrieveData(dataToRetrieve, state):
    MENTRE true:
        currResponse = getResponse(dataToRetrieve, state)

        SE currResponse === null:
            INTERROMPI  // nessun response disponibile

        executeResponse(currResponse, state)

        SE currResponse.hasExitCondition:
            INTERROMPI  // es. end call, transfer call

        inputResult = ProcessUserInput(dataToRetrieve)
        state = determineNextState(inputResult, state, dataToRetrieve)

        CASO state:
            'absoluteNoMatch', 'irrelevantMatch', 'noInput':
                CONTINUA  // riprova: getResponse prenderà escalation response

            'Match':
                RITORNA  // dato singolo recuperato (main o sub), esci
```

### Funzione: confirmData

```pseudocode
FUNZIONE confirmData(dataToRetrieve, state):
    MENTRE true:
        currResponse = getResponse(dataToRetrieve, 'confirmation')

        SE currResponse === null:
            RITORNA  // nessun confirmation response, salta conferma

        executeResponse(currResponse, state)

        inputResult = ProcessUserInput(dataToRetrieve)  // Confirmed/NotConfirmed/NoMatch  'QUI è SBAGLATO PERCHè NON C'è UNA DATATORETRIEVE MA IL RICONOSCIMENTO DI SI/NO ANCEH SE POTREBBE ESSERCI UNA CORREZIONE IMPLICITA: "NO, HO DETTO ROMA, NON MILANO!"
  LA GRAMMATICA è SEMPRE QUELLA PER TUTTI I DATI PERCHE SI TRATTA DI UNA GRAMMATICA DI CONFERMA
  IN PARALLELO DEVE ESSERE COMUQNUE ATTIVAL A GRAMATICA DI RICATTURA DEL DATO

        SE inputResult === 'Confirmed':
            markAsConfirmed(dataToRetrieve)
            RITORNA

        ALTRIMENTI SE inputResult === 'NotConfirmed':
        SE ESISTE UNO STEP DI NOT CONFIRMED (CI SONO RECOVERY DEFINITE) STATE=NOTCONFIRMED
        ALTRIMENTI SE ESISTE NOMATCH STATO= NOMATCH
           ALTRIMENTI
            state = 'start'  // riacquisizione
            RITORNA

        ALTRIMENTI:
            // NoMatch su yes/no - gestione errore standard
            CONTINUA  // riprova confirmation
```

### Funzione: validateData

```pseudocode
FUNZIONE validateData(dataToRetrieve):
    validationConditions = getValidationConditions(dataToRetrieve)

    PER OGNI condition IN validationConditions:
        SE NOT executeValidation(condition, dataToRetrieve):
            markAsInvalid(dataToRetrieve)
            RITORNA false  // non valido

    RITORNA true  // tutte le validazioni passate
```

### Funzione: getResponse (Semplificata)

```pseudocode
FUNZIONE getResponse(dataToRetrieve, state):

    NON CAPISCO QUESTA LOGICA: QUI DOVRESTI ANDARE A VEDERE NELLA STRUTURA DEI DATI CHE è AL MASSIMO UN AGGREGATO DI MAINDATA, NELLA SEQUENZA:
       IL PRIMO MAIN DATO RIEMPITO MA NON VALIDO 8VA CHIESTO DI NUOVO PERCHE' NON SI PROCEDE SOLO SE I DATRI SONO VALIDI
       SE NON ESISTE NESSUN MAINDATO NON VALIDO, VERIFICA IL PROMO DATO NON RIEMPITO. SE IL MAINDATO HA SOTTODATI, CERCA IL PRIMO SOTTODATO VUOTO
     OVVIAMENTE PER OGNI DATO DEVE ESSERCI UNO STATO: .EMPTY, .CONFIRMED, .VALID

    QUESTA ISTRUZIONE NON MI PARE ABBIA MOLTO SENSO: node = SE dataToRetrieve.isMain ALLORA dataToRetrieve.mainData ALTRIMENTI dataToRetrieve.subData

   IL RESPONSE DA ATTIVARE DIPENDE OVVIAMENTE DALLO STATO DEL DIALOGO, PER OGNI STATO VERIFICA SE CI SONO REPSONSE SPECIFICI, SE NO FA UNA FALLBACK A QUELLO CHE C'E'
    CASO state:
        'NoMatch', 'irrelevantMatch', 'noInput':
            SE node.responses(state).count === 0:
                state = 'start'  // fallback

        'confirmation', 'success':
            SE node.responses(state).count === 0:
                RITORNA null  'SE NON C'è NESSUN RESPONSE DI CONFIRAMTION VUOL DIRE CHE NON OCCORRE CONFERMARE IL DATO!

        'notConfirmed':
            SE node.responses(state).count === 0:
                state = 'start'  // fallback

    // Crop counter a maxRecovery e array length
    counter = counters(state) 'VEDE A QUALE CONTEGGIO E' ARRIVATO PER QUELLO STATO
    counter = min(counter, maxRecovery(state), node.responses(state).count - 1) ' E LO LIMITA AL MASSIMO INDICE (PER EVITARE LOOP INFINITO SI PUO METTERE UNA CONDIZIONE DI USCITA FORZATA ANCHE SE DA DESING DOVREBBE ESSERE ESPLICITAMENTE MESSA UNA CODIZIONE DI USCITA)

    RITORNA node.responses(state)[counter]
```

---

## Funzioni Principali

### GetNextData

Trova il prossimo dato vuoto o non valido da recuperare.

```pseudocode
FUNZIONE GetNextData(DDTInstance):
    PER OGNI mainData IN DDTInstance.mainData:
        SE isEmpty(mainData) OPPURE isInvalid(mainData):
            RITORNA { mainData, isMain: true, nodeId: mainData.id }

        SE requiresConfirmation(mainData) E NOT isConfirmed(mainData): IL DATO è DA RIACQUISIRE
            RITORNA { mainData, isMain: true, nodeId: mainData.id }

        SE mainData.hasSubData():
            missingSubs = findMissingRequiredSubs(mainData)
            SE missingSubs.length > 0:
                RITORNA { mainData, subData: missingSubs[0], isMain: false, nodeId: missingSubs[0].id }

    RITORNA null
```

### ProcessUserInput

Processa l'input utente e ritorna il risultato (Match/NoMatch/NoInput/Confirmed/NotConfirmed).

```pseudocode
FUNZIONE ProcessUserInput(dataToRetrieve):
    node = SE dataToRetrieve.isMain ALLORA dataToRetrieve.mainData ALTRIMENTI dataToRetrieve.subData 'NON HO CPAITO QUESTA ISTRUZIONE. IL DATA TO RETRIEVE PASSARTO NON è GIA' IL NODO DA ACQUISIRE? CHE SENSO HA DISTINBGUERE TRA NODE E DATATORTRIEVE NON E' FUROVIANTE UNA DUPLICAZIONE CONCETTUALE? DEVI VEDERE COME è DEFINTIO IL DDT TEMPLATE, FORSE è GIUSOT PARALARE DI NODE PERCHE OLTRE AL TIPO DI DATO HA ASSOCIATI ANCHE I RESPONSE REALTIVI. NON SO SE NODE SIA IL TERMINE PIU' GIUSTO. FORSE CHIAMARLO DIALOGUENODE? A CUI E' ASSOCIATA LA SERIE DEI REPSONSE E IL DATA DA ACQUISIIRE? COSA NE PENSI?

    contract = loadContract(node)  'QUI SE ABBIAMO LA INZIATIVA MISTA I CONTRACT CARICATI POTREBBE ESSERE IL CONTRACT IN PRIMO PIANO E I CONTRACTS DI BACKGROUND
    IL CONTRACT IN PRIMO PIANO E' QUELLO PER CUI SI E' FATTA LA RICHEISTA ESPLICITA
    I CONTRACTS IN SECONDO PIANO SONO QUELLI CAPACI DI CATTURARE INIZIATIVA MISTA, SIDETALKS, COMANDI, CAMBI DI CONTESTO, ECC

    userInput = waitForUserInput()

    SE userInput === null OPPURE userInput === '':
        RITORNA 'NoInput'

    extractionResult = contract.extract(userInput)

    CASO extractionResult.status:
        'match':
        'QUI DOBBIAMO DISITNGUIRE TRA MATCH DEL CONCTRAC IN PRIMO PAIANO O NO. SE E' QUELLO IN PRIMO PIANO ALLORA è UN MATCH "PIENO" ALTIRMENTI E' UN MATCH "IRRILEVANTE"

            // Salva valore in memory. GIUSTAMENTE I VALORI MATCHATI LI SALVA TTUTI IN MEMORY
            'QUI NON HO CAPITO COSA FAI IL PORBLEMA DI CAPIRE COSA CHIEDERE DOPO NON DIPENDE DAL GETDATATORETIREVE VISTO PRIMA ?
            SEI SICURO CHA VADA FATTO QUI ?  QUI DOVREBBE SOLO AGGIORNARE IL MEMORU CON QUELLO CHE MATTHCAT SE HA MATCHATO OPPURE DIRE SE NON HA MATCHATO PER NIENTE OPPURE SE HA FATTO UN IRRILEVANT MATCH
            O QUI STAI SOLO FACENDO IL CODICE CHE FA L'UPDATE IN MEMPRY NELLE CASELLE CORRETTE?
            SE dataToRetrieve.isMain E mainData.isComposite():
                PER OGNI (canonicalKey, value) IN extractionResult.value:
                    subId = getSubIdForCanonicalKey(contract, canonicalKey)
                    updateMemory(subId, value)
            ALTRIMENTI:
                updateMemory(dataToRetrieve.nodeId, extractionResult.value)

            SE extractionResult.matchedNodeId === dataToRetrieve.nodeId:
                RITORNA 'Match'
            ALTRIMENTI:
                RITORNA 'irrelevantMatch'

        'noMatch':
            RITORNA 'NoMatch'

        'noInput':
            RITORNA 'NoInput'

        DEFAULT:  'COS'E' QUESTO DEFAULT?
            RITORNA 'NoMatch'
```

### ProcessUserInput (per Confirmation)

Versione speciale per processare yes/no.

```pseudocode
FUNZIONE ProcessUserInput(dataToRetrieve) PER CONFIRMATION:
    userInput = waitForUserInput()

    SE isYes(userInput):
        RITORNA 'Confirmed'
    ALTRIMENTI SE isNo(userInput):
        RITORNA 'NotConfirmed'
    ALTRIMENTI:
        RITORNA 'NoMatch'
```

### determineNextState

Determina il prossimo stato in base al risultato dell'input.

```pseudocode
FUNZIONE determineNextState(inputResult, currentState, dataToRetrieve):
QUESTA FUNZIONE SIAMO SICURI CHE SIA CORRETTA COSI'? E SIAMO SICURI CHE SIA MNECESSARIA NON è LO STAOT GIà RISOLTA NELLE FUNZIONI PRECEDENTI? MAGARI MI SBALGIO, RAGIONIAMOCI!!
    CASO inputResult:
        'Match':
            SE dataToRetrieve.isMain:
                mainData = dataToRetrieve.mainData
                SE mainData.hasSubData():
                    missingSubs = findMissingRequiredSubs(mainData)
                    SE missingSubs.length > 0:
                        RITORNA { state: 'start', context: 'CollectingSub', nextDataId: missingSubs[0].id }
                RITORNA { state: 'retrieved' }
            ALTRIMENTI:
                mainData = dataToRetrieve.mainData
                missingSubs = findMissingRequiredSubs(mainData)
                SE missingSubs.length > 0:
                    RITORNA { state: 'start', context: 'CollectingSub', nextDataId: missingSubs[0].id }
                ALTRIMENTI:
                    RITORNA { state: 'retrieved' }

        'NoMatch':
            RITORNA { state: 'absoluteNoMatch' }

        'irrelevantMatch':
            RITORNA { state: 'irrelevantMatch' }

        'NoInput':
            RITORNA { state: 'noInput' }

        'Confirmed':
            RITORNA { state: 'retrieved' }

        'NotConfirmed':
            RITORNA { state: 'notConfirmed' }

        DEFAULT:
            RITORNA { state: 'absoluteNoMatch' }
```

### executeResponse

Esegue il response e incrementa il counter.

```pseudocode
QUI PRATICAMENTE DEVE ESEGUIRE TUTTA LA SERIE DI TASK CONTENUTI NEL REPSONSE ATTIVANTO L'EXECUTER OPPORTUNO A SECONDA DEL TASK, DICO BENE?
FUNZIONE executeResponse(response, state):
    SE response ESISTE:
        // Sostituisce placeholder {input} se presente
        SE response.hasPlaceholder('{input}'):
            inputValue = getFormattedValue(dataToRetrieve)
            response.message = replacePlaceholder(response.message, '{input}', inputValue)

        // Mostra messaggio
        showMessage(response.message)

        // Esegue azioni se presenti
        PER OGNI action IN response.actions:
            executeAction(action)

        // Incrementa counter per questo stato (crop incluso)
        recoveryCounter(state) = min(recoveryCounter(state) + 1, maxRecovery(state))

    RITORNA response.requiresUserInput
```

### Funzioni Helper

```pseudocode
FUNZIONE requiresConfirmation(dataToRetrieve):
    node = dataToRetrieve.mainData
    RITORNA node.responses('confirmation').count > 0

FUNZIONE markAsConfirmed(dataToRetrieve):
    updateMemory(dataToRetrieve.mainData.id, { confirmed: true })

FUNZIONE getValidationConditions(dataToRetrieve):
    mainData = dataToRetrieve.mainData
    RITORNA mainData.validationConditions

FUNZIONE executeValidation(condition, dataToRetrieve):
    mainData = dataToRetrieve.mainData
    values = getMemoryValues(mainData)
    result = evaluateCondition(condition.script, values, condition.variables)
    RITORNA result

FUNZIONE markAsInvalid(dataToRetrieve):
    mainData = dataToRetrieve.mainData
    setInvalid(mainData.id)

FUNZIONE findMissingRequiredSubs(mainData):
    missing = []
    PER OGNI subData IN mainData.subData:
        SE subData.required E isEmpty(subData.id):
            missing.push(subData)
    RITORNA missing

FUNZIONE isEmpty(nodeId):
    value = getMemoryValue(nodeId)
    RITORNA value === null OPPURE value === undefined OPPURE value === ''

FUNZIONE isInvalid(nodeId):
    memoryEntry = getMemoryValue(nodeId)
    RITORNA memoryEntry !== null E memoryEntry.invalid === true

FUNZIONE isConfirmed(nodeId):
    memoryEntry = getMemoryValue(nodeId)
    RITORNA memoryEntry !== null E memoryEntry.confirmed === true

FUNZIONE isYes(input):
    yesWords = ['sì', 'si', 'yes', 'ok', 'corretto', 'giusto', 'vero', 'esatto']
    RITORNA yesWords.includes(input.toLowerCase().trim())

FUNZIONE isNo(input):
    noWords = ['no', 'non', 'sbagliato', 'errato', 'falso', 'nope']
    RITORNA noWords.includes(input.toLowerCase().trim())

FUNZIONE counters(state):
    RITORNA recoveryCounter(state)

FUNZIONE maxRecovery(state):
    RITORNA maxRecoveryLimits(state)
```

---

## Decisioni di Design

### 1. Separazione delle Responsabilità

- **retrieveData**: Lavora su un singolo dato (main o sub) alla volta
- **confirmData**: Gestisce solo la conferma
- **validateData**: Gestisce solo la validazione
- **getResponse**: Gestisce escalation, counter, fallback in modo semplice

### 2. Counter Management

- Il counter viene incrementato in `executeResponse`, non in `getResponse`
- Il counter viene croppato automaticamente a `maxRecovery(state)`
- Non serve controllare `> maxRecovery` perché il crop è già fatto

### 3. Fallback Chain

- `irrelevantMatch` → `noMatch` → `start`
- `notConfirmed` → `start`
- `noMatch`/`noInput` → `start` (se non esiste response specifico)

### 4. Validazione

- Le validazioni vengono eseguite in sequenza
- Se una fallisce, il dato viene marcato come non valido e lo stato diventa `'invalid'` o `'conditionN'`
- `getResponse` sa quale response prendere per questi stati

### 5. Success

- Non serve gestire esplicitamente il success
- Quando lo stato è `'validated'`, `getResponse` prende automaticamente il success response se presente

### 6. Memory

- I dati sono salvati in un contesto globale (memory)
- Non serve ritornare i dati: sono già nel contesto
- Quando tutti i dati sono completati, l'esecuzione termina naturalmente

---

## Note Implementative

### Struttura Responses

Ogni nodo ha `node.responses(state)` che è un array di responses per quello stato:

```pseudocode
node.responses = {
    'start': [response1, response2, ...],
    'noMatch': [escalation1, escalation2, ...],
    'noInput': [escalation1, escalation2, ...],
    'confirmation': [response1],
    'notConfirmed': [escalation1, escalation2, ...],
    'success': [response1],
    'validation': [response1, response2, ...]  // per condition1, condition2, etc.
}
```

### Counter per Stato

Ogni stato ha il suo counter:
- `counters('noMatch')` → counter per noMatch
- `counters('noInput')` → counter per noInput
- `counters('notConfirmed')` → counter per notConfirmed
- `counters('start')` → counter per start (usato dopo fallback)

### Exit Conditions

Le exit conditions (end call, transfer call) sono gestite solo in `retrieveData`, non in `confirmData` o `validateData`.

---
