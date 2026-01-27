# Modifiche Applicate: Server Ruby come Unica Fonte di Verità

## 📋 Obiettivo

Far funzionare il **server Ruby (porta 3101)** come unica fonte di verità per interpretare i dialoghi. Gli altri server (Node.js 3100 e VB.NET diretto 5000) sono stati "parcheggiati" (lasciati nel codice ma non usati).

## ✅ Modifiche Applicate

### 1. `src/context/BackendTypeContext.tsx`

**Modificato**: `useBackendBaseUrl()`
- ⭐ **SEMPRE** ritorna `http://localhost:3101` (Ruby server)
- ❌ **POSTEGGIATO**: Logica switch backendType (commentata)

```typescript
export function useBackendBaseUrl(): string {
  // ⭐ SEMPRE RUBY - Unica fonte di verità
  return 'http://localhost:3101';

  // ❌ POSTEGGIATO: Logica switch backendType - non usata per ora
  // const { backendType } = useBackendType();
  // return backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';
}
```

### 2. `src/components/DialogueEngine/orchestratorAdapter.ts`

**Modificato**: `executeOrchestratorBackend()` e `provideOrchestratorInput()`
- ⭐ **SEMPRE** usa `http://localhost:3101` (Ruby server)
- ❌ **POSTEGGIATO**: Logica switch backendType (commentata in 3 punti)

**Punti modificati**:
- Inizio funzione `executeOrchestratorBackend()` - baseUrl sempre Ruby
- Funzione `stop()` - baseUrl sempre Ruby
- Funzione `provideOrchestratorInput()` - baseUrl sempre Ruby

### 3. `src/components/DialogueEngine/useDialogueEngine.ts`

**Modificato**: Metodo `start()`
- ⭐ **SEMPRE** usa `http://localhost:3101` (Ruby server)
- ❌ **POSTEGGIATO**: Logica switch backendType (commentata)

### 4. `src/components/DialogueEngine/ddt/ddtEngineAdapter.ts`

**Modificato**: `executeGetDataHierarchicalBackend()`
- ⭐ **SEMPRE** usa `http://localhost:3101` (Ruby server)
- ❌ **POSTEGGIATO**: Tutte le chiamate a `http://localhost:3100` sostituite

**Punti modificati**:
- Creazione sessione: `/api/runtime/ddt/session/start`
- Delete sessione: `/api/runtime/ddt/session/${sessionId}`
- SSE stream: `/api/runtime/ddt/session/${sessionId}/stream`
- Input utente: `/api/runtime/ddt/session/${sessionId}/input`

## 🎯 Risultato

Ora **tutte le chiamate API runtime** vanno sempre al server Ruby (porta 3101):

- ✅ `/api/runtime/compile` → Ruby (3101)
- ✅ `/api/runtime/orchestrator/session/*` → Ruby (3101)
- ✅ `/api/runtime/ddt/session/*` → Ruby (3101)

## 📝 Note

- I toggle UI (React/VB.NET) sono ancora presenti ma **non influenzano** le chiamate API
- Il codice degli altri server (Node.js 3100, VB.NET 5000) è ancora presente ma **non viene usato**
- Quando Ruby funziona completamente, possiamo rimuovere gli altri server

## 🚀 Prossimi Step

1. ✅ Verificare che il server Ruby sia avviato (`bundle exec rackup config.ru`)
2. ✅ Verificare che ApiServer.exe sia compilato e accessibile
3. ✅ Testare Chat Simulator con backend Ruby
4. ✅ Testare Flow Orchestrator con backend Ruby
5. ✅ Testare DDT Engine con backend Ruby

## ⚠️ Server Parcheggiati

- **Node.js (porta 3100)**: Codice presente ma non usato
- **VB.NET diretto (porta 5000)**: Codice presente ma non usato

Quando tutto funziona con Ruby, questi possono essere rimossi.
