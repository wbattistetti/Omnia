# SubData Prompt Generation System

## Overview

Il sistema DDT Builder è stato esteso per supportare la generazione di prompt specifici per i subData, risolvendo il problema precedente dove i subData ereditavano i prompt del mainData.

## Problema Risolto

**Prima**: I subData (es. day, month, year per una data di nascita) usavano gli stessi prompt del mainData:
- MainData: "What is your birth date?"
- Day subData: "What is your birth date?" ❌
- Month subData: "What is your birth date?" ❌
- Year subData: "What is your birth date?" ❌

**Dopo**: Ogni subData ha i suoi prompt specifici e contestuali:
- MainData: "What is your birth date?"
- Day subData: "What day were you born?" ✅
- Month subData: "What month were you born?" ✅
- Year subData: "What year were you born?" ✅

## Architettura Implementata

### 1. Backend Enhancement

#### Nuovi Endpoint
- `POST /api/generateSubDataMessages` - Genera messaggi specifici per un subData
- `POST /api/generateSubDataScripts` - Genera script di validazione per un subData

#### Struttura delle Richieste
```json
{
  "name": "day",
  "label": "Day",
  "type": "number",
  "parentField": "birthDate",
  "constraints": [
    {"type": "range", "min": 1, "max": 31}
  ]
}
```

#### Struttura delle Risposte
```json
{
  "ai": {
    "start": ["What day were you born?"],
    "noMatch": ["Please enter a valid day between 1 and 31."],
    "noInput": ["You didn't enter a day. Please try again."],
    "confirmation": ["You said you were born on day {}."],
    "success": ["Got it! You were born on day {}."]
  }
}
```

### 2. Frontend Orchestration

#### Step Generator Enhancement
- Modificato `stepGenerator.ts` per generare step specifici per ogni subData
- Aggiunto supporto per `subDataInfo` e `subDataIndex` nei step
- Corretta inconsistenza tra `subData` e `subdata`

#### Nuovi Step Types
- `subDataMessages` - Genera messaggi per un subData specifico
- `subDataScripts` - Genera script di validazione per un subData specifico

### 3. Assembler Enhancement

#### Nuove Funzioni
- `buildStepsWithSubData()` - Processa stepMessages separati per mainData e subData
- `buildMainDataNodeWithSubData()` - Assembla DDT con prompt specifici per subData

#### Struttura Dati
```typescript
interface SubDataStepMessages {
  mainData: StepMessages;
  subData: Record<string, StepMessages>; // key: subData name, value: stepMessages
}
```

## Flusso di Esecuzione

### 1. Rilevamento Tipo
```
Input: "data di nascita"
→ Backend: detectType
→ Output: "date"
```

### 2. Generazione Struttura
```
Input: "date"
→ Backend: suggestStructureAndConstraints
→ Output: { name: "birthDate", subData: ["day", "month", "year"] }
```

### 3. Generazione Prompt MainData
```
Input: "birthDate"
→ Backend: startPrompt, noMatchPrompts, etc.
→ Output: ["What is your birth date?"]
```

### 4. Generazione Prompt SubData
```
Input: { name: "day", parentField: "birthDate", constraints: [...] }
→ Backend: generateSubDataMessages
→ Output: { start: ["What day were you born?"], ... }

Input: { name: "month", parentField: "birthDate", constraints: [...] }
→ Backend: generateSubDataMessages
→ Output: { start: ["What month were you born?"], ... }

Input: { name: "year", parentField: "birthDate", constraints: [...] }
→ Backend: generateSubDataMessages
→ Output: { start: ["What year were you born?"], ... }
```

### 5. Assemblaggio DDT
```
→ buildStepsWithSubData() separa mainData e subData stepMessages
→ buildMainDataNodeWithSubData() assembla con prompt specifici
→ DDT finale con struttura corretta
```

## Esempio di Output

### DDT Generato
```json
{
  "id": "birth-date-ddt",
  "label": "Birth Date",
  "mainData": {
    "steps": [
      {
        "type": "start",
        "escalations": [
          {
            "actions": [
              {
                "actionId": "askQuestion",
                "parameters": [
                  {
                    "value": "runtime.birth-date-ddt.start.askQuestion.xxx.text"
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "subData": [
      {
        "variable": "day",
        "steps": [
          {
            "type": "start",
            "escalations": [
              {
                "actions": [
                  {
                    "actionId": "askQuestion",
                    "parameters": [
                      {
                        "value": "runtime.birth-date-ddt.day.start.askQuestion.yyy.text"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "translations": {
    "runtime.birth-date-ddt.start.askQuestion.xxx.text": "What is your birth date?",
    "runtime.birth-date-ddt.day.start.askQuestion.yyy.text": "What day were you born?",
    "runtime.birth-date-ddt.month.start.askQuestion.zzz.text": "What month were you born?",
    "runtime.birth-date-ddt.year.start.askQuestion.www.text": "What year were you born?"
  }
}
```

## Testing

### Unit Tests
- `buildStepMessagesFromResults.test.ts` - Test per il processing dei stepMessages
- `DDTBuilder.test.ts` - Test per l'assemblaggio del DDT
- `stepGenerator.test.ts` - Test per la generazione dei step

### Integration Tests
- `integration_subdata.test.tsx` - Test di integrazione UI
- `end_to_end_subdata.test.ts` - Test end-to-end completo

### Manual Tests
- `test_subdata_prompts.py` - Test manuale per verificare i backend endpoints (archiviato in `tests/archive/`)

## Vantaggi

1. **Prompt Contestuali**: Ogni subData ha prompt specifici e appropriati
2. **Migliore UX**: L'utente riceve messaggi chiari e specifici
3. **Flessibilità**: Il sistema supporta qualsiasi numero di subData
4. **Estensibilità**: Facile aggiungere nuovi tipi di subData
5. **Manutenibilità**: Codice modulare e ben testato

## Compatibilità

- ✅ Backward compatible con DDT esistenti senza subData
- ✅ Supporta DDT con subData annidati
- ✅ Mantiene la struttura esistente dei step e escalations
- ✅ Compatibile con il sistema di traduzioni esistente

## Prossimi Passi

1. **Ottimizzazione Performance**: Caching delle risposte AI
2. **Validazione Avanzata**: Script di validazione più sofisticati
3. **Supporto Multilingua**: Traduzioni automatiche per i prompt
4. **Template Library**: Libreria di template predefiniti per subData comuni