# Checklist Esecutiva: Migrazione a Stateless

## 📋 Quick Reference

**Tempo totale stimato**: 3-5 giorni lavorativi (24-35 ore)
**Difficoltà**: Media-Alta
**Rischio**: Alto (modifica core logic)

---

## ✅ FASE 1: Preparazione Redis (1-2 ore)

### Step 1.1: Aggiungere Package
- [ ] `cd VBNET/ApiServer`
- [ ] `dotnet add package StackExchange.Redis --version 2.7.10`
- [ ] Verificare che il package sia aggiunto in `.vbproj`
- [ ] `dotnet restore`

**Tempo**: 5 minuti

---

### Step 1.2: Configurazione
- [ ] Creare `appsettings.json` (se non esiste)
- [ ] Aggiungere sezione `Redis` con connection string
- [ ] Modificare `Program.vb` per leggere configurazione
- [ ] Testare lettura configurazione

**Tempo**: 15 minuti

---

### Step 1.3: RedisConnectionManager
- [ ] Creare cartella `VBNET/ApiServer/Infrastructure/`
- [ ] Creare `RedisConnectionManager.vb`
- [ ] Implementare singleton pattern
- [ ] Gestire eventi connection failed/restored
- [ ] Aggiungere file al progetto `.vbproj`

**Tempo**: 30 minuti

---

## ✅ FASE 2: RedisSessionStorage (4-6 ore)

### Step 2.1: SessionSerializer
- [ ] Creare `VBNET/ApiServer/SessionStorage/SessionSerializer.vb`
- [ ] Implementare `SerializeTaskSession()`
- [ ] Implementare `DeserializeTaskSession()`
- [ ] Implementare `SerializeOrchestratorSession()`
- [ ] Implementare `DeserializeOrchestratorSession()`
- [ ] Gestire oggetti non serializzabili (FlowOrchestrator, Motore)
- [ ] Test serializzazione/deserializzazione

**Tempo**: 2-3 ore ⚠️ COMPLESSO

---

### Step 2.2: RedisSessionStorage Completo
- [ ] Aprire `RedisSessionStorage.vb`
- [ ] Sostituire tutto lo stub con implementazione reale
- [ ] Implementare `GetTaskSession()` con Redis
- [ ] Implementare `SaveTaskSession()` con Redis
- [ ] Implementare `DeleteTaskSession()` con Redis
- [ ] Implementare `GetOrchestratorSession()` con Redis
- [ ] Implementare `SaveOrchestratorSession()` con Redis
- [ ] Implementare `DeleteOrchestratorSession()` con Redis
- [ ] Gestire TTL (Time To Live)
- [ ] Gestire fallback a InMemory se Redis non disponibile
- [ ] Test con Redis locale

**Tempo**: 2-3 ore

---

## ✅ FASE 3: Stato FlowOrchestrator (3-4 ore)

### Step 3.1: IExecutionStateStorage Interface
- [ ] Creare `VBNET/ApiServer/Interfaces/IExecutionStateStorage.vb`
- [ ] Definire metodi: Get, Save, Delete
- [ ] Aggiungere file al progetto

**Tempo**: 15 minuti

---

### Step 3.2: RedisExecutionStateStorage
- [ ] Creare `VBNET/ApiServer/SessionStorage/RedisExecutionStateStorage.vb`
- [ ] Implementare `IExecutionStateStorage`
- [ ] Implementare serializzazione `ExecutionState`
- [ ] Gestire TTL
- [ ] Test serializzazione/deserializzazione

**Tempo**: 1 ora

---

### Step 3.3: Modificare FlowOrchestrator
- [ ] Aprire `VBNET/Orchestrator/FlowOrchestrator.vb`
- [ ] Aggiungere campo `_executionStateStorage`
- [ ] Aggiungere campo `_sessionId`
- [ ] Modificare costruttore per accettare storage e sessionId
- [ ] Caricare stato da Redis al costruttore
- [ ] Creare metodo `SaveState()`
- [ ] Chiamare `SaveState()` dopo ogni modifica a `_state`
- [ ] Trovare tutti i punti che modificano `_state`:
  - [ ] `ExecuteDialogueAsync()`
  - [ ] `ExecuteTask()`
  - [ ] `OnTaskCompleted()`
  - [ ] Altri metodi che modificano stato
- [ ] Test che lo stato venga salvato/caricato correttamente

**Tempo**: 2-3 ore ⚠️ MODIFICA CORE LOGIC

---

## ✅ FASE 4: Stato TaskEngine (4-5 ore)

### Step 4.1: ITaskStateStorage Interface
- [ ] Creare `VBNET/ApiServer/Interfaces/ITaskStateStorage.vb`
- [ ] Creare classe `TaskNodeState`
- [ ] Definire metodi: Get, Save, Delete
- [ ] Aggiungere file al progetto

**Tempo**: 30 minuti

---

### Step 4.2: RedisTaskStateStorage
- [ ] Creare `VBNET/ApiServer/SessionStorage/RedisTaskStateStorage.vb`
- [ ] Implementare `ITaskStateStorage`
- [ ] Key format: `"state:task:{sessionId}:{taskId}"`
- [ ] Implementare serializzazione `TaskNodeState`
- [ ] Gestire TTL
- [ ] Test serializzazione/deserializzazione

**Tempo**: 1 ora

---

### Step 4.3: Modificare Motore
- [ ] Aprire `VBNET/DDTEngine/Engine/Motore.vb`
- [ ] Aggiungere campo `_taskStateStorage`
- [ ] Aggiungere campo `_sessionId`
- [ ] Modificare costruttore per accettare storage e sessionId
- [ ] Caricare stato da Redis per ogni task
- [ ] Salvare stato dopo ogni modifica a `TaskNode.State`
- [ ] Salvare `_counters` e `_maxRecovery` in Redis
- [ ] Trovare tutti i punti che modificano stato:
  - [ ] `ExecuteTask()`
  - [ ] `ExecuteResponse()`
  - [ ] `IncrementCounter()`
  - [ ] `MarkAsAcquisitionFailed()`
  - [ ] Altri metodi che modificano stato
- [ ] Test che lo stato venga salvato/caricato correttamente

**Tempo**: 3-4 ore ⚠️ MODIFICA CORE LOGIC

---

## ✅ FASE 5: Rimuovere In-Memory (1-2 ore)

### Step 5.1: SessionManager
- [ ] Aprire `VBNET/ApiServer/SessionManager.vb`
- [ ] Cercare tutti gli usi di `_sessions` e `_taskSessions`
- [ ] Sostituire con `_storage`
- [ ] Rimuovere righe:
  ```vb
  Private Shared ReadOnly _sessions As New Dictionary(...)
  Private Shared ReadOnly _taskSessions As New Dictionary(...)
  ```
- [ ] Verificare che tutto usi `_storage`
- [ ] Compilare e testare

**Tempo**: 1 ora

---

### Step 5.2: InMemorySessionStorage (opzionale)
- [ ] Decidere: mantenere come fallback o rimuovere?
- [ ] Se mantenere: OK, già fatto
- [ ] Se rimuovere: rimuovere file e riferimenti

**Tempo**: 30 minuti

---

## ✅ FASE 6: Testing (8-12 ore)

### Step 6.1: Setup Redis Locale
- [ ] Installare Docker (se non presente)
- [ ] `docker run -d -p 6379:6379 redis:latest`
- [ ] Verificare che Redis sia accessibile: `redis-cli ping`
- [ ] Configurare `appsettings.json` con `localhost:6379`

**Tempo**: 15 minuti

---

### Step 6.2: Unit Tests
- [ ] Creare progetto `VBNET/ApiServer.Tests/` (se non esiste)
- [ ] Test `RedisSessionStorage.GetTaskSession()`
- [ ] Test `RedisSessionStorage.SaveTaskSession()`
- [ ] Test `RedisSessionStorage.DeleteTaskSession()`
- [ ] Test `RedisExecutionStateStorage` completo
- [ ] Test `RedisTaskStateStorage` completo
- [ ] Test serializzazione/deserializzazione
- [ ] Test fallback a InMemory se Redis non disponibile

**Tempo**: 4-6 ore

---

### Step 6.3: Integration Tests
- [ ] Test creazione sessione → salvataggio in Redis
- [ ] Test recupero sessione da Redis
- [ ] Test modifica sessione → aggiornamento in Redis
- [ ] Test eliminazione sessione da Redis
- [ ] Test TTL (verificare che sessioni scadano)
- [ ] Test con Redis non disponibile (fallback)

**Tempo**: 2-3 ore

---

### Step 6.4: Multi-Instance Test
- [ ] Avviare 2 istanze ApiServer (porti diversi)
- [ ] Creare sessione su istanza 1
- [ ] Recuperare sessione su istanza 2 (stesso Redis)
- [ ] Verificare che funzioni
- [ ] Modificare sessione su istanza 2
- [ ] Verificare che istanza 1 veda le modifiche
- [ ] Test con Chat Simulator (2 istanze)

**Tempo**: 2-3 ore

---

## ✅ FASE 7: Deployment (3-4 ore)

### Step 7.1: Docker Compose
- [ ] Creare `docker-compose.yml` nella root
- [ ] Configurare servizio Redis
- [ ] Configurare servizio ApiServer
- [ ] Configurare variabili ambiente
- [ ] Test `docker-compose up`
- [ ] Verificare che ApiServer si connetta a Redis
- [ ] Test Chat Simulator con Docker

**Tempo**: 1-2 ore

---

### Step 7.2: Documentazione
- [ ] Aggiornare `ARCHITECTURE.md`
- [ ] Aggiornare `MIGRATION_GUIDE.md`
- [ ] Creare `DEPLOYMENT.md` con istruzioni Docker
- [ ] Documentare variabili ambiente
- [ ] Documentare troubleshooting

**Tempo**: 1-2 ore

---

## 🎯 Verifica Finale

### Checklist Funzionalità
- [ ] Chat Simulator funziona con Redis
- [ ] Sessioni create su istanza 1 visibili su istanza 2
- [ ] Modifiche a sessione su istanza 1 visibili su istanza 2
- [ ] TTL funziona (sessioni scadono dopo 1 ora)
- [ ] Fallback funziona (se Redis non disponibile)
- [ ] Performance accettabile (latency < 10ms per operazione Redis)
- [ ] Nessun memory leak
- [ ] Logs strutturati funzionano

### Checklist Architettura
- [ ] Nessun dizionario in-memory per sessioni
- [ ] Tutto lo stato è in Redis
- [ ] FlowOrchestrator carica/salva stato da Redis
- [ ] TaskEngine carica/salva stato da Redis
- [ ] Codice compila senza errori
- [ ] Nessun warning critico

---

## ⚠️ Rollback Plan

Se qualcosa va storto:

1. **Rollback immediato**: Cambiare `Program.vb`:
   ```vb
   ' Da Redis a InMemory
   Dim storage = New InMemorySessionStorage()
   ```

2. **Rollback graduale**: Mantenere entrambi, switch via config

3. **Rollback completo**: Git revert delle modifiche

---

## 📊 Progress Tracker

**Data inizio**: _______________
**Data fine prevista**: _______________

**Fase 1**: [ ] Completata
**Fase 2**: [ ] Completata
**Fase 3**: [ ] Completata
**Fase 4**: [ ] Completata
**Fase 5**: [ ] Completata
**Fase 6**: [ ] Completata
**Fase 7**: [ ] Completata

**Note**:
- _______________
- _______________
- _______________

---

**Ultimo aggiornamento**: Checklist creata
**Status**: Pronto per esecuzione
