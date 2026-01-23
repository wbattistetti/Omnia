# 📊 Analisi Database Factory - Template Structure

## Scopo

Questo script analizza tutti i template nel database Factory e genera un report completo che include:

1. **Classificazione** di ogni template (Atomic/CompositeData/Collection)
2. **Verifica coerenza** (subDataIds referenziati esistono)
3. **Identificazione problemi** (es. "atomic" invece di ID corretti)
4. **Proposta struttura corretta**
5. **Piano di migrazione dettagliato**

## Come Eseguire

```bash
# Esegui lo script e salva il report in un file markdown
node backend/analyze_factory_templates.js > report_factory_analysis.md

# Oppure visualizza direttamente nel terminale
node backend/analyze_factory_templates.js
```

## Output

Il report generato contiene:

### STEP 1: Caricamento Template
- Totale template trovati nel database

### STEP 2: Classificazione Template
- Statistiche per categoria (Atomic/CompositeData/Collection)

### STEP 3: Analisi Dettagliata
- Dettagli per ogni template CompositeData
- Verifica di ogni subDataId referenziato
- Identificazione di problemi (ID non validi, nomi invece di ID, ecc.)

### STEP 4: Riepilogo Problemi
- Lista completa di tutti i problemi trovati
- Classificazione per severità (HIGH/MEDIUM)
- Fix suggeriti per ogni problema

### STEP 5: Proposta Struttura Corretta
- Esempi di struttura corretta per Atomic e CompositeData
- Regole da seguire

### STEP 6: Piano di Migrazione
- Passi dettagliati per correggere i problemi
- Esempi concreti di correzione

### STEP 7: Template Atomic Necessari
- Lista di tutti i template atomic referenziati
- Verifica che esistano nel database

### STEP 8: Conclusione
- Riepilogo stato attuale
- Prossimi passi consigliati

## Prossimi Passi

1. ✅ **Eseguire lo script** e generare il report
2. ✅ **Mostrare il report a un esperto** per approvazione
3. ✅ **Dopo approvazione**, procedere con la migrazione
4. ✅ **Verificare post-migrazione** eseguendo nuovamente lo script

## Note

- Lo script è **read-only**: non modifica il database
- Richiede connessione a MongoDB Atlas
- Il report è in formato Markdown, pronto per essere condiviso
