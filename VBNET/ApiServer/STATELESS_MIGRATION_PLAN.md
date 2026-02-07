# Piano Dettagliato: Migrazione a Stateless Architecture

## 📋 Overview

Questo documento descrive il piano completo per trasformare il sistema da **stateful** (stato in-memory) a **stateless** (stato in Redis condiviso).

**Obiettivo**: Permettere scaling orizzontale con N istanze del servizio che condividono lo stesso stato.

---

## 🔍 FASE 0: Analisi dello Stato Attuale

### Componenti Stateful Identificati

#### 1. SessionManager (ApiServer)
**Stato attuale**:
```vb
Private Shared ReadOnly _sessions As New Dictionary(Of String, OrchestratorSession)
Private Shared ReadOnly _taskSessions As New Dictionary(Of String, TaskSession)
```

**Dati da migrare**:
- `OrchestratorSession` (intera sessione)
- `TaskSession` (intera sessione)

**Impatto**: ALTO - Core del sistema

---

#### 2. FlowOrchestrator (Orchestrator)
**Stato attuale**:
```vb
Private _executionState As ExecutionState
' ExecutionState contiene:
' - ExecutedTaskIds: HashSet(Of String)
' - VariableStore: Dictionary(Of String, Object)
' - CurrentNodeId: String
' - CurrentRowIndex: Integer
' - RetrievalState: String
```

**Dati da migrare**:
- `ExecutionState` completo

**Impatto**: ALTO - Stato di esecuzione del flow

---

#### 3. TaskEngine (DDTEngine)
**Stato attuale**:
```vb
' Per ogni TaskNode:
' - State: DialogueState (Success, Failed, InProgress, etc.)
' - Counters: Dictionary(Of DialogueState, Integer)
' - MaxRecovery: Dictionary(Of DialogueState, Integer)
```

**Dati da migrare**:
- `DialogueState` per ogni task
- `Counters` per ogni task
- `MaxRecovery` per ogni task

**Impatto**: ALTO - Stato del dialogo

---

#### 4. Motore (DDTEngine)
**Stato attuale**:
```vb
Private ReadOnly _counters As New Dictionary(Of DialogueState, Integer)()
Private ReadOnly _maxRecovery As New Dictionary(Of DialogueState, Integer)()
```

**Dati da migrare**:
- Counters globali
- MaxRecovery globali

**Impatto**: MEDIO - Contatori di recovery

---

## 🎯 FASE 1: Preparazione Infrastruttura Redis

### Step 1.1: Aggiungere Package NuGet
**File**: `VBNET/ApiServer/ApiServer.vbproj`

```xml
<ItemGroup>
  <PackageReference Include="StackExchange.Redis" Version="2.7.10" />
</ItemGroup>
```

**Comando**:
```bash
cd VBNET/ApiServer
dotnet add package StackExchange.Redis --version 2.7.10
```

**Tempo**: 5 minuti
**Rischio**: Basso

---

### Step 1.2: Configurare Connection String
**File**: `VBNET/ApiServer/appsettings.json` (creare se non esiste)

```json
{
  "Redis": {
    "ConnectionString": "localhost:6379",
    "Database": 0,
    "KeyPrefix": "omnia:",
    "SessionTTL": 3600,
    "StateTTL": 3600
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

**File**: `VBNET/ApiServer/Program.vb`
```vb
' Leggi configurazione Redis
Dim redisConnectionString = builder.Configuration.GetValue(Of String)("Redis:ConnectionString", "localhost:6379")
Dim redisKeyPrefix = builder.Configuration.GetValue(Of String)("Redis:KeyPrefix", "omnia:")
Dim sessionTTL = builder.Configuration.GetValue(Of Integer)("Redis:SessionTTL", 3600)
```

**Tempo**: 15 minuti
**Rischio**: Basso

---

### Step 1.3: Creare Redis Connection Manager
**File**: `VBNET/ApiServer/Infrastructure/RedisConnectionManager.vb` (NUOVO)

```vb
Option Strict On
Option Explicit On
Imports StackExchange.Redis
Imports Microsoft.Extensions.Configuration

Namespace ApiServer.Infrastructure
    ''' <summary>
    ''' Gestisce la connessione Redis (singleton)
    ''' </summary>
    Public Class RedisConnectionManager
        Private Shared _connection As IConnectionMultiplexer
        Private Shared _lock As New Object()
        Private Shared _isConnected As Boolean = False

        Public Shared Function GetConnection(connectionString As String) As IConnectionMultiplexer
            If _connection Is Nothing OrElse Not _isConnected Then
                SyncLock _lock
                    If _connection Is Nothing OrElse Not _isConnected Then
                        Try
                            _connection = ConnectionMultiplexer.Connect(connectionString)
                            _isConnected = _connection.IsConnected

                            ' Eventi per monitoraggio
                            AddHandler _connection.ConnectionFailed, Sub(sender, e)
                                                                          _isConnected = False
                                                                      End Sub
                            AddHandler _connection.ConnectionRestored, Sub(sender, e)
                                                                          _isConnected = True
                                                                      End Sub
                        Catch ex As Exception
                            _isConnected = False
                            Throw New Exception($"Failed to connect to Redis: {ex.Message}", ex)
                        End Try
                    End If
                End SyncLock
            End If

            Return _connection
        End Function

        Public Shared Function IsConnected() As Boolean
            Return _isConnected AndAlso _connection IsNot Nothing AndAlso _connection.IsConnected
        End Function

        Public Shared Sub Dispose()
            If _connection IsNot Nothing Then
                _connection.Dispose()
                _connection = Nothing
                _isConnected = False
            End If
        End Sub
    End Class
End Namespace
```

**Tempo**: 30 minuti
**Rischio**: Medio

---

## 🗄️ FASE 2: Implementare RedisSessionStorage Completo

### Step 2.1: Serializzazione TaskSession e OrchestratorSession

**Problema**: `TaskSession` e `OrchestratorSession` contengono oggetti complessi non serializzabili direttamente:
- `FlowOrchestrator` (ha eventi, stato interno)
- `Motore` (ha eventi, stato interno)
- `TaskInstance` (ha riferimenti circolari)

**Soluzione**: Serializzare solo i dati necessari, ricostruire oggetti runtime.

**File**: `VBNET/ApiServer/SessionStorage/SessionSerializer.vb` (NUOVO)

```vb
Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Compiler
Imports TaskEngine

Namespace ApiServer.SessionStorage
    ''' <summary>
    ''' Serializza/deserializza sessioni per Redis
    ''' </summary>
    Public Class SessionSerializer
        ''' <summary>
        ''' Serializza TaskSession (solo dati, non oggetti runtime)
        ''' </summary>
        Public Shared Function SerializeTaskSession(session As TaskSession) As String
            Dim data = New With {
                .SessionId = session.SessionId,
                .RuntimeTask = session.RuntimeTask,
                .Language = session.Language,
                .Translations = session.Translations,
                .Messages = session.Messages,
                .IsWaitingForInput = session.IsWaitingForInput,
                .WaitingForInputData = session.WaitingForInputData,
                .TaskInstanceData = If(session.TaskInstance IsNot Nothing, SerializeTaskInstance(session.TaskInstance), Nothing)
            }
            Return JsonConvert.SerializeObject(data, New JsonSerializerSettings With {
                .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                .NullValueHandling = NullValueHandling.Ignore
            })
        End Function

        ''' <summary>
        ''' Deserializza TaskSession e ricostruisce oggetti runtime
        ''' </summary>
        Public Shared Function DeserializeTaskSession(json As String) As TaskSession
            Dim data = JsonConvert.DeserializeObject(Of Object)(json)
            ' TODO: Implementare deserializzazione completa
            ' Per ora: struttura base
            Return Nothing ' Placeholder
        End Function

        ' Similar per OrchestratorSession...
    End Class
End Namespace
```

**Tempo**: 2-3 ore (complesso - oggetti con riferimenti circolari)
**Rischio**: Alto

---

### Step 2.2: Implementare RedisSessionStorage Completo

**File**: `VBNET/ApiServer/SessionStorage/RedisSessionStorage.vb` (MODIFICARE)

Sostituire tutto il codice stub con implementazione completa:

```vb
Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports ApiServer.Interfaces
Imports ApiServer.Infrastructure
Imports Compiler
Imports TaskEngine
Imports Newtonsoft.Json
Imports StackExchange.Redis

Namespace ApiServer.SessionStorage
    Public Class RedisSessionStorage
        Implements ApiServer.Interfaces.ISessionStorage

        Private ReadOnly _connection As IConnectionMultiplexer
        Private ReadOnly _database As IDatabase
        Private ReadOnly _keyPrefix As String
        Private ReadOnly _sessionTTL As TimeSpan
        Private ReadOnly _fallbackStorage As InMemorySessionStorage
        Private ReadOnly _isRedisAvailable As Boolean

        Public Sub New(connectionString As String, keyPrefix As String, sessionTTL As Integer)
            Try
                _connection = RedisConnectionManager.GetConnection(connectionString)
                _database = _connection.GetDatabase()
                _keyPrefix = keyPrefix
                _sessionTTL = TimeSpan.FromSeconds(sessionTTL)
                _isRedisAvailable = RedisConnectionManager.IsConnected()
                _fallbackStorage = New InMemorySessionStorage()
            Catch ex As Exception
                _isRedisAvailable = False
                _fallbackStorage = New InMemorySessionStorage()
                ' Log error
                Console.WriteLine($"[RedisSessionStorage] Failed to connect: {ex.Message}. Using fallback.")
            End Try
        End Sub

        Private Function GetTaskSessionKey(sessionId As String) As String
            Return $"{_keyPrefix}session:task:{sessionId}"
        End Function

        Private Function GetOrchestratorSessionKey(sessionId As String) As String
            Return $"{_keyPrefix}session:orchestrator:{sessionId}"
        End Function

        Public Function GetTaskSession(sessionId As String) As TaskSession Implements ApiServer.Interfaces.ISessionStorage.GetTaskSession
            If Not _isRedisAvailable Then
                Return _fallbackStorage.GetTaskSession(sessionId)
            End If

            Try
                Dim key = GetTaskSessionKey(sessionId)
                Dim json = _database.StringGet(key)

                If json.HasValue Then
                    Return SessionSerializer.DeserializeTaskSession(json)
                End If

                Return Nothing
            Catch ex As Exception
                ' Fallback on error
                Return _fallbackStorage.GetTaskSession(sessionId)
            End Try
        End Function

        Public Sub SaveTaskSession(session As TaskSession) Implements ApiServer.Interfaces.ISessionStorage.SaveTaskSession
            If Not _isRedisAvailable Then
                _fallbackStorage.SaveTaskSession(session)
                Return
            End If

            Try
                Dim key = GetTaskSessionKey(session.SessionId)
                Dim json = SessionSerializer.SerializeTaskSession(session)
                _database.StringSet(key, json, _sessionTTL)
            Catch ex As Exception
                _fallbackStorage.SaveTaskSession(session)
            End Try
        End Sub

        ' Similar per DeleteTaskSession, GetOrchestratorSession, SaveOrchestratorSession, DeleteOrchestratorSession
    End Class
End Namespace
```

**Tempo**: 2-3 ore
**Rischio**: Medio-Alto

---

## 🔄 FASE 3: Migrare Stato FlowOrchestrator

### Step 3.1: Creare ExecutionStateStorage Interface

**File**: `VBNET/ApiServer/Interfaces/IExecutionStateStorage.vb` (NUOVO)

```vb
Option Strict On
Option Explicit On
Imports TaskEngine.Orchestrator

Namespace ApiServer.Interfaces
    ''' <summary>
    ''' Interfaccia per storage dello stato di esecuzione
    ''' </summary>
    Public Interface IExecutionStateStorage
        Function GetExecutionState(sessionId As String) As ExecutionState
        Sub SaveExecutionState(sessionId As String, state As ExecutionState)
        Sub DeleteExecutionState(sessionId As String)
    End Interface
End Namespace
```

**Tempo**: 15 minuti
**Rischio**: Basso

---

### Step 3.2: Implementare RedisExecutionStateStorage

**File**: `VBNET/ApiServer/SessionStorage/RedisExecutionStateStorage.vb` (NUOVO)

```vb
Option Strict On
Option Explicit On
Imports ApiServer.Interfaces
Imports ApiServer.Infrastructure
Imports TaskEngine.Orchestrator
Imports StackExchange.Redis
Imports Newtonsoft.Json

Namespace ApiServer.SessionStorage
    Public Class RedisExecutionStateStorage
        Implements IExecutionStateStorage

        Private ReadOnly _database As IDatabase
        Private ReadOnly _keyPrefix As String
        Private ReadOnly _ttl As TimeSpan

        Public Sub New(connection As IConnectionMultiplexer, keyPrefix As String, ttl As Integer)
            _database = connection.GetDatabase()
            _keyPrefix = keyPrefix
            _ttl = TimeSpan.FromSeconds(ttl)
        End Sub

        Private Function GetStateKey(sessionId As String) As String
            Return $"{_keyPrefix}state:orchestrator:{sessionId}"
        End Function

        Public Function GetExecutionState(sessionId As String) As ExecutionState Implements IExecutionStateStorage.GetExecutionState
            Try
                Dim key = GetStateKey(sessionId)
                Dim json = _database.StringGet(key)

                If json.HasValue Then
                    Return JsonConvert.DeserializeObject(Of ExecutionState)(json)
                End If

                Return Nothing
            Catch ex As Exception
                Return Nothing
            End Try
        End Function

        Public Sub SaveExecutionState(sessionId As String, state As ExecutionState) Implements IExecutionStateStorage.SaveExecutionState
            Try
                Dim key = GetStateKey(sessionId)
                Dim json = JsonConvert.SerializeObject(state)
                _database.StringSet(key, json, _ttl)
            Catch ex As Exception
                ' Log error
            End Try
        End Sub

        Public Sub DeleteExecutionState(sessionId As String) Implements IExecutionStateStorage.DeleteExecutionState
            Try
                Dim key = GetStateKey(sessionId)
                _database.KeyDelete(key)
            Catch ex As Exception
                ' Log error
            End Try
        End Sub
    End Class
End Namespace
```

**Tempo**: 1 ora
**Rischio**: Medio

---

### Step 3.3: Modificare FlowOrchestrator per Usare Storage

**File**: `VBNET/Orchestrator/FlowOrchestrator.vb` (MODIFICARE)

**Prima**:
```vb
Private _executionState As ExecutionState = New ExecutionState()
```

**Dopo**:
```vb
Private _executionStateStorage As IExecutionStateStorage
Private _sessionId As String

Public Sub New(compilationResult As FlowCompilationResult, taskEngine As Motore, sessionId As String, stateStorage As IExecutionStateStorage)
    ' ... existing code ...
    _sessionId = sessionId
    _executionStateStorage = stateStorage
    ' Carica stato da Redis (o crea nuovo)
    _executionState = _executionStateStorage.GetExecutionState(sessionId)
    If _executionState Is Nothing Then
        _executionState = New ExecutionState()
    End If
End Sub

' Modificare tutti i metodi che cambiano _executionState per salvare in Redis
Private Sub SaveState()
    _executionStateStorage.SaveExecutionState(_sessionId, _executionState)
End Sub
```

**Tempo**: 2-3 ore
**Rischio**: Alto (modifica core logic)

---

## 🎯 FASE 4: Migrare Stato TaskEngine

### Step 4.1: Creare TaskStateStorage Interface

**File**: `VBNET/ApiServer/Interfaces/ITaskStateStorage.vb` (NUOVO)

```vb
Option Strict On
Option Explicit On
Imports TaskEngine

Namespace ApiServer.Interfaces
    ''' <summary>
    ''' Interfaccia per storage dello stato dei task
    ''' </summary>
    Public Interface ITaskStateStorage
        Function GetTaskState(sessionId As String, taskId As String) As TaskNodeState
        Sub SaveTaskState(sessionId As String, taskId As String, state As TaskNodeState)
        Sub DeleteTaskState(sessionId As String, taskId As String)
    End Interface

    Public Class TaskNodeState
        Public Property State As DialogueState
        Public Property Counters As Dictionary(Of DialogueState, Integer)
        Public Property MaxRecovery As Dictionary(Of DialogueState, Integer)
    End Class
End Namespace
```

**Tempo**: 30 minuti
**Rischio**: Basso

---

### Step 4.2: Implementare RedisTaskStateStorage

**File**: `VBNET/ApiServer/SessionStorage/RedisTaskStateStorage.vb` (NUOVO)

Simile a `RedisExecutionStateStorage`, ma per stato dei task.

**Tempo**: 1 ora
**Rischio**: Medio

---

### Step 4.3: Modificare TaskEngine per Usare Storage

**File**: `VBNET/DDTEngine/Engine/Motore.vb` (MODIFICARE)

Modificare per salvare/caricare stato da Redis invece che in-memory.

**Tempo**: 3-4 ore
**Rischio**: Alto (modifica core logic)

---

## 🧹 FASE 5: Rimuovere Dizionari In-Memory

### Step 5.1: Rimuovere da SessionManager

**File**: `VBNET/ApiServer/SessionManager.vb` (MODIFICARE)

**Rimuovere**:
```vb
' ⚠️ RIMUOVERE QUESTE RIGHE
Private Shared ReadOnly _sessions As New Dictionary(Of String, OrchestratorSession)
Private Shared ReadOnly _taskSessions As New Dictionary(Of String, TaskSession)
```

**Usare solo**:
```vb
Private Shared _storage As ISessionStorage
```

**Tempo**: 1 ora
**Rischio**: Medio (verificare che tutto usi _storage)

---

### Step 5.2: Rimuovere da InMemorySessionStorage (opzionale)

Se vogliamo mantenere solo Redis, possiamo rimuovere `InMemorySessionStorage` o mantenerlo come fallback.

**Tempo**: 30 minuti
**Rischio**: Basso

---

## 🧪 FASE 6: Testing

### Step 6.1: Unit Tests

**File**: `VBNET/ApiServer.Tests/` (NUOVO progetto)

Test per:
- RedisSessionStorage
- RedisExecutionStateStorage
- RedisTaskStateStorage
- Serializzazione/Deserializzazione

**Tempo**: 4-6 ore
**Rischio**: Medio

---

### Step 6.2: Integration Tests

Test con Redis locale:
1. Avviare Redis: `docker run -d -p 6379:6379 redis:latest`
2. Testare creazione sessione
3. Testare recupero sessione
4. Testare con più istanze ApiServer

**Tempo**: 2-3 ore
**Rischio**: Basso

---

### Step 6.3: Load Testing

Test con:
- 1 istanza ApiServer
- 2 istanze ApiServer (stesso Redis)
- Verificare che le sessioni siano condivise

**Tempo**: 2-3 ore
**Rischio**: Basso

---

## 🚀 FASE 7: Deployment

### Step 7.1: Docker Compose

**File**: `docker-compose.yml` (NUOVO)

```yaml
version: '3.8'
services:
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  apiserver:
    build: ./VBNET/ApiServer
    ports:
      - "5000:5000"
    environment:
      - Redis__ConnectionString=redis:6379
    depends_on:
      - redis

volumes:
  redis-data:
```

**Tempo**: 30 minuti
**Rischio**: Basso

---

### Step 7.2: Kubernetes (Opzionale)

Se si usa Kubernetes, creare:
- Deployment per ApiServer (N replicas)
- Service per ApiServer
- Deployment per Redis
- Service per Redis

**Tempo**: 2-3 ore
**Rischio**: Medio

---

## 📊 Timeline Totale

| Fase | Tempo Stimato | Rischio | Priorità |
|------|---------------|---------|----------|
| Fase 1: Preparazione Redis | 1-2 ore | Basso | Alta |
| Fase 2: RedisSessionStorage | 4-6 ore | Alto | Alta |
| Fase 3: Stato FlowOrchestrator | 3-4 ore | Alto | Alta |
| Fase 4: Stato TaskEngine | 4-5 ore | Alto | Alta |
| Fase 5: Rimuovere In-Memory | 1-2 ore | Medio | Media |
| Fase 6: Testing | 8-12 ore | Medio | Alta |
| Fase 7: Deployment | 3-4 ore | Basso | Media |
| **TOTALE** | **24-35 ore** | - | - |

**Tempo totale**: 3-5 giorni lavorativi

---

## ⚠️ Rischi e Mitigazioni

### Rischio 1: Serializzazione Oggetti Complessi
**Problema**: `TaskSession` e `OrchestratorSession` hanno oggetti non serializzabili
**Mitigazione**: Serializzare solo dati, ricostruire oggetti runtime

### Rischio 2: Performance Redis
**Problema**: Latency aggiuntiva vs in-memory
**Mitigazione**:
- Usare connection pooling
- Batch operations quando possibile
- Monitorare latency

### Rischio 3: Fallback
**Problema**: Se Redis va giù, sistema non funziona
**Mitigazione**: Mantenere fallback a InMemorySessionStorage

### Rischio 4: Migrazione Stato Esistente
**Problema**: Sessioni attive durante migrazione
**Mitigazione**:
- Migrazione graduale
- Supportare entrambi i modi temporaneamente
- Drain delle sessioni prima di switch completo

---

## ✅ Checklist Finale

- [ ] Redis package aggiunto
- [ ] RedisConnectionManager implementato
- [ ] RedisSessionStorage completo
- [ ] Serializzazione sessioni funzionante
- [ ] ExecutionStateStorage implementato
- [ ] FlowOrchestrator migrato
- [ ] TaskStateStorage implementato
- [ ] TaskEngine migrato
- [ ] Dizionari in-memory rimossi
- [ ] Unit tests passati
- [ ] Integration tests passati
- [ ] Load testing completato
- [ ] Docker Compose configurato
- [ ] Documentazione aggiornata

---

## 🎯 Success Criteria

Il sistema è stateless quando:
1. ✅ Nessun dizionario in-memory per sessioni
2. ✅ Tutto lo stato è in Redis
3. ✅ 2+ istanze ApiServer condividono lo stesso stato
4. ✅ Una richiesta può essere gestita da qualsiasi istanza
5. ✅ Se un'istanza cade, un'altra continua

---

**Ultimo aggiornamento**: Piano creato
**Status**: Pronto per implementazione
**Prossimo step**: Fase 1 - Preparazione Redis
