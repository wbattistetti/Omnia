# Guida Test Manuali - Refactoring Contract Structure

## 📋 Obiettivo
Verificare che il refactoring di `testCases` (spostato a livello contract) e `aiPrompt` (rinominato da `userPromptTemplate`) non abbia introdotto regressioni.

---

## 🧪 FASE 1: Test Automatici (Prima di testare manualmente)

### Eseguire i test automatici

```bash
# Test TypeScript
npm test -- contractLoader.test.ts
npm test -- contractExtraction.regression.test.ts

# Verificare che tutti i test passino
npm test
```

**✅ Risultato atteso:** Tutti i test devono passare.

---

## 🖱️ FASE 2: Test Manuali sull'Interfaccia

### STEP 1: Verificare Wizard - Generazione Template

#### 1.1 Creare un nuovo template tramite Wizard

1. **Apri il Wizard DDT**
   - Vai alla sezione Wizard
   - Crea un nuovo template (es. "Email")

2. **Completa il wizard**
   - Inserisci struttura dati
   - Genera constraints
   - Genera contracts/parsers
   - Genera messaggi

3. **Verifica nel Database/JSON**
   - Apri DevTools → Application → IndexedDB (o MongoDB)
   - Trova il template appena creato
   - Verifica la struttura `dataContract`:

**✅ Cosa verificare:**
```json
{
  "templateName": "Email",
  "templateId": "...",
  "subDataMapping": {...},
  "testCases": ["test1", "test2"],  // ✅ DEVE essere qui (livello contract)
  "contracts": [
    {
      "type": "regex",
      "enabled": true,
      "patterns": [...],
      "examples": []
      // ❌ NON deve avere "testCases" qui
    },
    {
      "type": "llm",
      "enabled": true,
      "systemPrompt": "...",
      "aiPrompt": "...",  // ✅ DEVE essere "aiPrompt" (non "userPromptTemplate")
      "responseSchema": {...}
    }
  ]
}
```

**❌ Errori da segnalare:**
- `testCases` presente negli engine (dovrebbe essere solo a livello contract)
- `userPromptTemplate` presente (dovrebbe essere `aiPrompt`)
- `testCases` mancante a livello contract (se il wizard li genera)

---

### STEP 2: Verificare Response Editor - Modifica Contract

#### 2.1 Modificare un contract esistente

1. **Apri Response Editor**
   - Seleziona un nodo con contract
   - Apri il contract editor (icona ingranaggio o "Edit Contract")

2. **Modifica test cases**
   - Aggiungi/modifica test cases
   - Salva

3. **Verifica salvataggio**
   - Controlla nel database che `testCases` sia salvato a livello contract
   - Verifica che NON sia salvato negli engine

**✅ Cosa verificare:**
- Test cases salvati correttamente a livello contract
- Nessun test case duplicato negli engine
- UI mostra test cases correttamente

---

### STEP 3: Verificare LLM Escalation

#### 3.1 Test escalation LLM con aiPrompt

1. **Prepara un contract con escalation LLM**
   - Crea/modifica un contract con:
     - Regex che fallisce (pattern invalido)
     - LLM abilitato come fallback

2. **Testa estrazione**
   - Usa il tester nel Response Editor
   - Inserisci un input che non matcha il regex
   - Verifica che l'escalation LLM funzioni

3. **Verifica nel Network Tab**
   - Apri DevTools → Network
   - Cerca chiamate a `/api/nlp/llm-extract`
   - Verifica che il prompt contenga `aiPrompt` (non `userPromptTemplate`)

**✅ Cosa verificare:**
- Escalation LLM funziona correttamente
- Prompt contiene il contenuto di `aiPrompt`
- Nessun errore in console

**❌ Errori da segnalare:**
- Escalation LLM non funziona
- Errore "userPromptTemplate is not defined"
- Prompt non contiene il contenuto corretto

---

### STEP 4: Verificare Compilazione Backend

#### 4.1 Test compilazione VB.NET

1. **Compila il backend**
   ```bash
   cd VBNET
   dotnet build
   ```

2. **Verifica che compili senza errori**
   - Nessun errore di compilazione
   - Nessun warning relativo a `testCases` o `userPromptTemplate`

**✅ Cosa verificare:**
- Compilazione successo
- Nessun errore di deserializzazione

---

### STEP 5: Verificare Runtime Backend

#### 5.1 Test estrazione dati runtime

1. **Avvia il backend**
   - Avvia ApiServer
   - Verifica che si avvii senza errori

2. **Testa estrazione con contract**
   - Usa un endpoint di test (se disponibile)
   - Oppure usa il frontend per testare estrazione

3. **Verifica log backend**
   - Controlla che non ci siano errori di deserializzazione
   - Verifica che `testCases` sia letto correttamente a livello contract

**✅ Cosa verificare:**
- Backend si avvia correttamente
- Estrazione dati funziona
- Nessun errore nei log

**❌ Errori da segnalare:**
- Errore "testCases is not defined" (se backend cerca testCases negli engine)
- Errore di deserializzazione JSON
- Estrazione non funziona

---

### STEP 6: Verificare Compatibilità Retroattiva

#### 6.1 Test con template vecchi (se supportato)

1. **Carica un template vecchio**
   - Se hai template esistenti con `testCases` negli engine
   - Caricali e verifica che funzionino

2. **Verifica migrazione automatica**
   - Se implementata, verifica che `testCases` venga migrato automaticamente
   - Verifica che il template funzioni correttamente dopo la migrazione

**✅ Cosa verificare:**
- Template vecchi funzionano ancora
- Migrazione automatica (se implementata) funziona
- Nessun dato perso durante la migrazione

---

## 📝 Checklist Test Manuali

### Pre-test
- [ ] Test automatici passano tutti
- [ ] Backend compila senza errori
- [ ] Frontend compila senza errori

### Test Wizard
- [ ] Template generato ha `testCases` a livello contract
- [ ] Template generato NON ha `testCases` negli engine
- [ ] Template generato ha `aiPrompt` (non `userPromptTemplate`) per LLM

### Test Response Editor
- [ ] Modifica test cases funziona
- [ ] Salvataggio test cases corretto
- [ ] UI mostra test cases correttamente

### Test Escalation LLM
- [ ] Escalation LLM funziona
- [ ] Prompt contiene `aiPrompt`
- [ ] Nessun errore in console

### Test Backend
- [ ] Backend si avvia senza errori
- [ ] Estrazione dati funziona
- [ ] Deserializzazione JSON corretta

### Test Compatibilità
- [ ] Template vecchi funzionano (se supportato)
- [ ] Migrazione automatica funziona (se implementata)

---

## 🐛 Cosa Segnalare

Se trovi problemi, segnala:

1. **Descrizione del problema**
   - Cosa stavi facendo
   - Cosa ti aspettavi
   - Cosa è successo invece

2. **Screenshot/Log**
   - Screenshot dell'errore
   - Log dalla console (F12)
   - Log dal backend (se disponibile)

3. **Dati di test**
   - Template/contract usato
   - Input testato
   - Struttura JSON (se rilevante)

---

## ✅ Criteri di Successo

Il refactoring è riuscito se:

1. ✅ Tutti i test automatici passano
2. ✅ Wizard genera template con struttura corretta
3. ✅ Response Editor salva/carica correttamente
4. ✅ Escalation LLM funziona con `aiPrompt`
5. ✅ Backend compila e funziona correttamente
6. ✅ Nessuna regressione nelle funzionalità esistenti

---

## 🔄 Prossimi Passi

Dopo aver completato i test manuali:

1. Se tutti i test passano → **Refactoring completato con successo**
2. Se ci sono problemi → Segnala e correggiamo
3. Se serve compatibilità retroattiva → Implementiamo migrazione automatica
