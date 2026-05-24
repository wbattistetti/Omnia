/**
 * Active Tutor — manuale fase Task (wizard step 0).
 */

export const MANUAL_TASK = `
## FASE 1 — TASK (step wizard 0)

### Scopo
Definire cosa deve fare l'agente in modo chiaro e strutturato. Il Task è la base di tutto: obiettivo, dominio, limiti, tono, regole, esempi di richieste tipiche.

### Layout
- **Colonna sinistra / dock**: textarea descrizione libera (Monaco markdown) + dopo Create Agent le tab strutturate.
- **Pannello Tutor destro**: tab Task con guida e Q&A.

### Componenti interfaccia
- **Campo descrizione libera** (Monaco markdown, data-tutor-id task-description-input):
  - Scrivi in linguaggio naturale cosa deve fare l'agente, contesto, informazioni da raccogliere, regole, tono.
  - Placeholder guida con elenco: obiettivo, ordine domande, vincoli/formati, tono, esempio concreto.
  - Soglia Tutor «descrizione vuota»: meno di ~40 caratteri → guida a iniziare; altrimenti suggerisce Create Agent.
- **Create Agent** (toolbar/header, data-tutor-id create-agent-button):
  - Prima generazione — l'AI struttura la descrizione in sezioni.
  - Richiede descrizione sufficientemente lunga (minimo tecnico ~8 caratteri; in pratica scrivi almeno un paragrafo utile).
- **Refine comportamento**:
  - Se l'agente esiste già (hasAgentGeneration), raffina prompt/comportamento senza ripartire da zero.
  - Usa contenuto delle sezioni strutturate + descrizione (minimo caratteri come Create Agent).
- **Tab Descrizione** (sempre visibile): testo libero originale — unica tab prima della prima generazione.
- **Tab strutturate** (solo DOPO Create Agent), in ordine:
  - **Scopo** — cosa deve ottenere l'agente a fine conversazione.
  - **Sequenza** — ordine domande, raccolta dati, conferme, correzioni.
  - **Contesto** — tool, formato risposte API, vincoli misurabili.
  - **Vincoli** — must / must-not operativi (es. solo dati dal tool, niente invenzione).
  - **Personalità** — ruolo e atteggiamento dell'agente.
  - **Tono** — registro, brevità, chiarezza.
  - **Esempi** — few-shot opzionali (in IR ma tab dock opzionale).
  - **Prompt Finale** — anteprima prompt composto / bundle (read-only o preview).
- **Polish descrizione** (pillola offerta):
  - Compare se hai modificato significativamente il testo libero (~50+ caratteri diversi dalla baseline).
  - Offerta: «Vuoi che ti riscriva il testo in modo più formattato, senza cambiarne il contenuto?»
  - Non sostituisce Create Agent: solo riformattazione del testo libero.
- **Conferma fase Task**: pannello Tutor — «Conferma fase Task» — non un bottone nel canvas.

### Flusso consigliato
1. Scrivi la descrizione libera (dettagliata: obiettivo, ordine, vincoli, tono, esempio).
2. Clicca **Create Agent** e attendi.
3. Leggi le tab strutturate (Scopo, Sequenza, Vincoli, Tono, …) e correggi ciò che non torna.
4. Eventualmente **Refine comportamento** per aggiustamenti mirati.
5. Opzionale: accetta **Polish** sulla descrizione libera se serve solo formattazione.
6. Conferma al Tutor quando sei soddisfatto.

### Logica Tutor — Task
- Campo vuoto o molto breve (< ~40 caratteri): «Inizia descrivendo cosa deve fare il tuo agente.» → attenzione su textarea.
- Campo già compilato, agente non ancora generato: «Hai già una bozza. Completa o correggi la descrizione, poi usa Create Agent.»
- Campo compilato + agente già generato: «Hai già una descrizione. Possiamo raffinarla con Refine comportamento o correggere le sezioni.»
- Dopo Create Agent / Refine: «Leggi le sezioni generate (Scopo, Sequenza, …) e correggi ciò che non ti convince.»
- Attenzione UI: bordo glow del campo descrizione o pulsante Create Agent a seconda dello stato.

### Cosa controllare
- Obiettivo/scopo chiaro (tab Scopo)
- Sequenza operativa sensata (tab Sequenza)
- Limiti e vincoli espliciti (tab Vincoli: Must / Must not)
- Tono e personalità coerenti (tab Tono, Personalità)
- Esempi realistici se presenti (tab Esempi)
- Niente ambiguità su cosa l'agente NON deve fare
- Coerenza tra descrizione libera e sezioni strutturate

### Errori comuni
- Descrizione troppo breve per Create Agent
- Cliccare Create Agent senza aver descritto vincoli e tono
- Confondere tab Obiettivo/Dominio (legacy) con **Scopo/Sequenza/Contesto** (reali)
- Cercare «Conferma Task» nel canvas invece che nel Tutor
- Confondere Task con Prompts (use case) o Backend (API)
- Saltare la revisione delle sezioni strutturate dopo la prima generazione
`;
