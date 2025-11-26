# NLP Contract Generators

Sistema per generare contract NLP completi (Regex, Rules, NER, LLM) per template di dati, leggendo costanti dal database Factory.

## Principi

- **Niente hardcoded**: tutte le costanti (mesi, titoli, separatori) sono nel database Factory
- **Modularità**: pattern regex composti dinamicamente dalle costanti
- **Escalation**: Regex → Rules → NER → LLM
- **Versioning**: costanti versionate per tracciare cambiamenti

## Struttura

```
backend/
  generators/
    base-contract-generator.ts    # Classe base con logica comune
    date-contract-generator.ts    # Generator per template DATE
    # TODO: name-contract-generator.ts, email-contract-generator.ts, ecc.

  postProcess/
    dateNormalizer.ts             # Normalizzazione date (anni 2 cifre, mesi testuali)

scripts/
  populate-constants.js           # Popola Constants nel DB Factory
  generate-nlp-contracts.js       # Genera contract per template
```

## Database Structure

### Collezione: `Constants`

Contiene costanti multilingua:

```json
{
  "_id": "months_IT",
  "type": "months",
  "locale": "IT",
  "scope": "global",
  "version": "1.0",
  "values": {
    "full": ["gennaio", "febbraio", ...],
    "abbr": ["gen", "feb", ...],
    "abbrWithDot": ["gen.", "feb.", ...]
  },
  "mapping": {
    "gennaio": 1, "gen": 1, "gen.": 1,
    ...
  }
}
```

### Collezione: `Task_Templates`

Ogni template può avere un campo `nlpContract`:

```json
{
  "_id": "date",
  "name": "date",
  "label": "Date of birth",
  "nlpContract": {
    "templateName": "date",
    "subDataMapping": { ... },
    "regex": { "patterns": [...], ... },
    "rules": { "extractorCode": "...", ... },
    "ner": { ... },
    "llm": { ... }
  }
}
```

## Setup

### 1. Popola le costanti nel DB

```bash
node scripts/populate-constants.js
```

Questo crea/popola la collezione `Constants` con:
- `months_IT`, `months_EN`, `months_PT`
- `separators_date`
- `titles_IT`, `titles_EN`, `titles_PT`

### 2. Genera contract per template

```bash
node scripts/generate-nlp-contracts.js
```

Questo:
- Legge template DATE da `Task_Templates`
- Legge costanti da `Constants`
- Genera contract completo
- Salva in `Task_Templates[].nlpContract`

## Contract Structure

Ogni contract contiene:

### `subDataMapping`
Mapping ID sub-dato → chiave canonica:
```json
{
  "sub-id-123": {
    "canonicalKey": "day",
    "label": "Giorno",
    "type": "number"
  }
}
```

### `regex`
Pattern regex con gruppi nominati opzionali:
```json
{
  "patterns": [
    "(?<day>\\d{1,2})?[\\s/\\-\\.]+(?<month>...)[\\s/\\-\\.]+(?<year>\\d{2,4})?"
  ],
  "examples": ["16/12/1980", "dicembre 1980"],
  "testCases": ["16/12/1980", "dic. 80", "pizza margherita"]
}
```

### `rules`
ExtractorCode TypeScript con costanti inline:
```json
{
  "extractorCode": "const MONTHS_MAPPING = {...}; function extractDate(...) {...}",
  "validators": [
    { "type": "range", "field": "day", "min": 1, "max": 31 }
  ]
}
```

### `ner`
Configurazione NER (se abilitato):
```json
{
  "entityTypes": ["DATE", "BIRTHDATE"],
  "confidence": 0.7,
  "enabled": true
}
```

### `llm`
Prompt parametrico con schema JSON:
```json
{
  "systemPrompt": "You are a date extraction assistant...",
  "userPromptTemplate": "Extract date from: {text}. Sub-data: {subData}",
  "responseSchema": { ... },
  "enabled": true
}
```

## Test Cases

Ogni contract include test cases per:
- **Completo**: "16/12/1980" → day, month, year
- **Parziale**: "dicembre 1980" → month, year
- **Conflitto**: "dic. 80" → abbreviazione + anno 2 cifre
- **Negativo**: "pizza margherita" → no match

## Prossimi Passi

1. ✅ DATE contract generator
2. ⏳ NAME contract generator (con titoli opzionali)
3. ⏳ EMAIL contract generator
4. ⏳ PHONE contract generator
5. ⏳ Integrazione nel DDT Engine
6. ⏳ Aggiornamento RegexEditor per validare gruppi nominati opzionali










