/**
 * Active Tutor — manuale fase Error Handling (wizard step 4).
 */

export const MANUAL_ERROR_HANDLING = `
## FASE 5 — ERROR HANDLING (step wizard 4)

### Scopo
Definire **regole conversazionali trasversali** (fallback, escalation, handoff operatore, messaggi di errore uniformi) che valgono su più use case.

### Componenti interfaccia
- **Editor Error Handling** (data-tutor-id error-handling-editor): stesso composer use case ma catalogo \`conversational_rules\`.
- Lista regole con scenario, messaggi agente, condizioni di attivazione.

### Azioni
1. Apri lo step **Error Handling** nello stepper (passo 5/7).
2. Crea o modifica regole conversazionali come per gli use case, ma con scope trasversale.
3. Verifica che le regole coprano i casi critici (API down, dati mancanti, richiesta operatore).

### Errori comuni
- Duplicare use case normali invece di regole trasversali.
- Dimenticare regole per errori API già gestiti nel Backend.

### FAQ
- «Differenza da use case?» → Error handling = regole globali; use case = scenari operativi nel passo Prompts.

### UI_IDS rilevanti
- error-handling-editor, wizard-step-4
`;
