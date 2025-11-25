# Piano di Test - DDT Engine

## ✅ Step 1: Fix Completato

- [x] Integrato `executeStep` da `ddtSteps.ts` esistente
- [x] Integrato `getStep` e `getEscalationRecovery` esistenti
- [x] Rimosso codice duplicato
- [x] Test comparativi base creati

## 📋 Step 2: Test Comparativi (IN CORSO)

### Test Creati

1. **Test base: Start → Match → Success**
   - Verifica che il nuovo engine funzioni per flow semplice
   - File: `__tests__/ddtEngine.comparison.test.ts`

2. **Test escalation: NoMatch**
   - Verifica gestione escalation noMatch

3. **Test escalation: NoInput**
   - Verifica gestione escalation noInput

4. **Test comparativo diretto**
   - Confronta output vecchio vs nuovo con stesso input

### Come Eseguire i Test

```bash
# Esegui solo i test comparativi
npm test -- ddtEngine.comparison.test.ts

# Esegui tutti i test
npm test

# Esegui test in watch mode
npm test -- --watch
```

## 🔄 Step 3: Test per Tutti i Casi (PROSSIMO)

### Casi da Testare

- [ ] **Start**: Messaggio iniziale mostrato correttamente
- [ ] **NoMatch**: Escalation mostrata, counter incrementato
- [ ] **NoInput**: Escalation mostrata, counter incrementato
- [ ] **Confirmation**: Messaggio conferma mostrato
- [ ] **NotConfirmed**: Escalation mostrata dopo "no"
- [ ] **Success**: Step finale eseguito
- [ ] **CollectingSub**: Transizione a sub-data funziona
- [ ] **Multiple escalations**: Livelli escalation funzionano

### Test da Creare

```typescript
// Per ogni caso:
test('Caso X - NEW ENGINE', async () => {
  // Test nuovo engine
});

test('Caso X - OLD ENGINE', async () => {
  // Test vecchio engine
});

test('Caso X - COMPARISON', async () => {
  // Confronta risultati
});
```

## 🎯 Step 4: Edge Cases (DOPO)

- [ ] DDT senza steps
- [ ] DDT con subData
- [ ] DDT con multiple mainData
- [ ] Escalation oltre il limite
- [ ] Input vuoto
- [ ] Input invalido
- [ ] Confirmation con yes/no/altro

## 📊 Step 5: Validazione Completa

### Checklist Pre-Switch

- [ ] Tutti i test passano
- [ ] Nessuna regressione identificata
- [ ] Performance accettabile
- [ ] Logging adeguato
- [ ] Error handling completo

### Metriche da Monitorare

1. **Copertura test**: > 80%
2. **Test passati**: 100%
3. **Performance**: < 10% overhead vs vecchio
4. **Errori**: 0 regressioni

## 🚀 Step 6: Switch Graduale

1. **Feature flag**: Abilitare per subset utenti
2. **Monitoraggio**: 1-2 settimane
3. **Switch completo**: Solo dopo validazione
4. **Rimozione vecchio**: Solo dopo conferma

## 📝 Note

- I test comparativi garantiscono che il nuovo engine produca risultati compatibili
- Ogni test deve passare prima di procedere al successivo
- In caso di differenze, documentare e decidere se sono accettabili

