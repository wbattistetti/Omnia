# 🧪 Guida Test Manuali - Passo Passo

## ✅ FASE 0: Test Automatici (COMPLETATI)

I test automatici sono stati creati e passano tutti:

```bash
# Test eseguiti con successo:
✓ contractLoader.test.ts (12 tests passed)
✓ contractExtraction.regression.test.ts (4 tests passed)
```

**✅ Risultato:** Tutti i test automatici passano.

---

## 🖱️ FASE 1: Test Manuali sull'Interfaccia

### 📋 STEP 1: Verificare Wizard - Generazione Template

#### Cosa fare:

1. **Apri l'applicazione**
   - Avvia il frontend (se non è già avviato)
   - Vai alla sezione **Wizard DDT**

2. **Crea un nuovo template**
   - Clicca su "Nuovo Template" o "Crea DDT"
   - Inserisci un nome (es. "Email" o "Data di Nascita")
   - Completa il wizard:
     - ✅ Inserisci struttura dati
     - ✅ Genera constraints
     - ✅ Genera contracts/parsers
     - ✅ Genera messaggi

3. **Verifica la struttura nel Database**

   **Come verificare:**
   - Apri **DevTools** (F12)
   - Vai a **Application** → **IndexedDB** (o **MongoDB** se usi MongoDB)
   - Trova il template appena creato
   - Apri l'oggetto `dataContract`

   **✅ Cosa deve essere presente:**
   ```json
   {
     "templateName": "Email",
     "templateId": "abc-123-...",
     "subDataMapping": {...},
     "testCases": ["test1", "test2"],  // ✅ QUI (livello contract)
     "contracts": [
       {
         "type": "regex",
         "enabled": true,
         "patterns": ["..."],
         "examples": []
         // ❌ NON deve avere "testCases" qui
       },
       {
         "type": "llm",
         "enabled": true,
         "systemPrompt": "...",
         "aiPrompt": "...",  // ✅ DEVE essere "aiPrompt"
         "responseSchema": {...}
         // ❌ NON deve avere "userPromptTemplate"
       }
     ]
   }
   ```

   **❌ Cosa NON deve essere presente:**
   - `testCases` dentro gli engine (es. `contracts[0].testCases`)
   - `userPromptTemplate` (deve essere `aiPrompt`)

4. **Segnala eventuali problemi:**
   - Se vedi `testCases` negli engine → **PROBLEMA**
   - Se vedi `userPromptTemplate` → **PROBLEMA**
   - Se `testCases` manca a livello contract (e il wizard li genera) → **PROBLEMA**

---

### 📋 STEP 2: Verificare Response Editor - Modifica Contract

#### Cosa fare:

1. **Apri Response Editor**
   - Seleziona un nodo che ha un contract
   - Clicca sull'icona **ingranaggio** o "Edit Contract"

2. **Modifica test cases**
   - Trova la sezione "Test Cases" o "Test Values"
   - Aggiungi un nuovo test case (es. "test@example.com")
   - Salva

3. **Verifica salvataggio**
   - Apri **DevTools** → **Application** → **IndexedDB**
   - Trova il template modificato
   - Verifica che `testCases` sia salvato a **livello contract** (non negli engine)

   **✅ Verifica:**
   ```json
   {
     "testCases": ["test@example.com", ...],  // ✅ QUI
     "contracts": [
       {
         "type": "regex",
         // ❌ NON deve avere "testCases" qui
       }
     ]
   }
   ```

4. **Segnala eventuali problemi:**
   - Test cases salvati negli engine → **PROBLEMA**
   - Test cases non salvati → **PROBLEMA**
   - UI non mostra test cases → **PROBLEMA**

---

### 📋 STEP 3: Verificare LLM Escalation (se implementato)

#### Cosa fare:

1. **Prepara un contract con escalation LLM**
   - Crea/modifica un contract con:
     - Regex che fallisce (pattern invalido o input che non matcha)
     - LLM abilitato come fallback

2. **Testa estrazione**
   - Apri il **tester** nel Response Editor
   - Inserisci un input che non matcha il regex (es. "my email is test@example.com" con regex invalido)
   - Clicca "Test" o "Run"

3. **Verifica escalation**
   - Apri **DevTools** → **Network**
   - Cerca chiamate a `/api/nlp/llm-extract` o simile
   - Verifica che il prompt contenga il contenuto di `aiPrompt`

   **✅ Verifica nel Network Tab:**
   - Request body deve contenere `prompt` con il contenuto di `aiPrompt`
   - NON deve contenere `userPromptTemplate`

4. **Segnala eventuali problemi:**
   - Escalation LLM non funziona → **PROBLEMA**
   - Errore "userPromptTemplate is not defined" → **PROBLEMA**
   - Prompt non contiene il contenuto corretto → **PROBLEMA**

---

### 📋 STEP 4: Verificare Compilazione Backend

#### Cosa fare:

1. **Compila il backend**
   ```bash
   cd VBNET
   dotnet build
   ```

2. **Verifica output**
   - ✅ Deve compilare senza errori
   - ✅ Nessun warning relativo a `testCases` o `userPromptTemplate`

3. **Segnala eventuali problemi:**
   - Errori di compilazione → **PROBLEMA**
   - Warning su proprietà mancanti → **PROBLEMA**

---

### 📋 STEP 5: Verificare Runtime Backend

#### Cosa fare:

1. **Avvia il backend**
   - Avvia **ApiServer** (se non è già avviato)
   - Verifica che si avvii senza errori

2. **Testa estrazione**
   - Usa il frontend per testare estrazione dati
   - Oppure usa un endpoint di test (se disponibile)

3. **Verifica log**
   - Controlla i log del backend
   - Verifica che non ci siano errori di deserializzazione

4. **Segnala eventuali problemi:**
   - Backend non si avvia → **PROBLEMA**
   - Errore "testCases is not defined" → **PROBLEMA**
   - Errore di deserializzazione JSON → **PROBLEMA**
   - Estrazione non funziona → **PROBLEMA**

---

## 📝 Checklist Completa

### Pre-test
- [ ] Test automatici passano (✅ GIÀ FATTO)
- [ ] Backend compila senza errori
- [ ] Frontend compila senza errori

### Test Wizard
- [ ] Template generato ha `testCases` a livello contract
- [ ] Template generato NON ha `testCases` negli engine
- [ ] Template generato ha `aiPrompt` (non `userPromptTemplate`) per LLM

### Test Response Editor
- [ ] Modifica test cases funziona
- [ ] Salvataggio test cases corretto (a livello contract)
- [ ] UI mostra test cases correttamente

### Test Escalation LLM (se implementato)
- [ ] Escalation LLM funziona
- [ ] Prompt contiene `aiPrompt`
- [ ] Nessun errore in console

### Test Backend
- [ ] Backend si avvia senza errori
- [ ] Estrazione dati funziona
- [ ] Deserializzazione JSON corretta

---

## 🐛 Come Segnalare Problemi

Se trovi problemi, fornisci:

1. **Descrizione**
   - Cosa stavi facendo
   - Cosa ti aspettavi
   - Cosa è successo invece

2. **Dettagli tecnici**
   - Screenshot dell'errore
   - Log dalla console (F12 → Console)
   - Log dal backend (se disponibile)
   - Struttura JSON del template (se rilevante)

3. **Dati di test**
   - Nome del template
   - Input testato
   - Passi per riprodurre

---

## ✅ Criteri di Successo

Il refactoring è riuscito se:

1. ✅ Tutti i test automatici passano (✅ GIÀ FATTO)
2. ✅ Wizard genera template con struttura corretta
3. ✅ Response Editor salva/carica correttamente
4. ✅ Escalation LLM funziona con `aiPrompt` (se implementato)
5. ✅ Backend compila e funziona correttamente
6. ✅ Nessuna regressione nelle funzionalità esistenti

---

## 🎯 Prossimi Passi

Dopo aver completato i test manuali:

1. **Se tutti i test passano** → Refactoring completato con successo! ✅
2. **Se ci sono problemi** → Segnala e correggiamo insieme
3. **Se serve compatibilità retroattiva** → Implementiamo migrazione automatica

---

## 📞 Supporto

Se hai dubbi o problemi durante i test, segnala:
- Quale step stai eseguendo
- Cosa non funziona
- Screenshot/log se disponibili
