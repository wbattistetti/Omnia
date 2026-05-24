/**
 * Active Tutor — manualetto generale: mappa del wizard e orientamento meta.
 */

export const MANUAL_OVERVIEW = `
# MANUALETTO GENERALE — COME SI COSTRUISCE UN AGENTE IN OMNIA

## Scopo del manuale
Dare al designer una visione chiara e lineare dell'intero processo di creazione di un agente:
- cosa fare per primo e cosa fare dopo;
- come funziona ogni fase (in sintesi);
- come capire se si sta procedendo bene;
- come usare l'AI in ogni passaggio;
- come chiedere aiuto al Tutor.

Questo capitolo è la **mappa** del wizard. Per i dettagli operativi (bottoni, pannelli, flussi UI) consulta i capitoli FASE 1–5 e il Glossario.

## 1. Panoramica del flusso
La creazione di un agente segue **5 passi** nello stepper:

| Passo | Nome | Cosa definisci |
|-------|------|----------------|
| 1 | **Task** | Cosa deve fare l'agente (obiettivo, regole, tono) |
| 2 | **Prompts** | Come si comporta (use case, conversazioni, prompt/JSON, stile) |
| 3 | **Backend** | Cosa può fare operativamente (API) + documenti (Knowledge Base) + contratto Interface |
| 4 | **Dati** | Quali dati strutturati raccogliere (slot dedotti dai dialoghi) |
| 5 | **Voce** | Come parla in modalità vocale (TTS, runtime IA, es. ElevenLabs) |

Ordine consigliato: **Task → Prompts → Backend → Dati → Voce**. Puoi navigare liberamente, ma Prompts prima di Dati ha senso (gli slot si inferiscono dai dialoghi).

### Cosa ha ogni passo (in generale)
- un **obiettivo** chiaro;
- **contenuti da compilare o rivedere** (non sempre un unico campo: Prompts ha un sub-wizard, Backend ha 3 viste);
- **azioni IA** dove previsto (Create Agent, Genera use case, Recupera specifiche, …);
- una **fase di revisione** umana (leggi, correggi, elimina, affina);
- opzionalmente **conferma al Tutor** («Conferma fase …» nel pannello destro) quando hai approvato un risultato IA.

### Due tipi di «completamento» (non confonderli)
1. **Check ✅ sullo stepper** — regole minime automatiche:
   - Task: descrizione non vuota.
   - Prompts: almeno 1 use case **e** almeno 1 conversazione.
   - Backend, Dati, Voce: oggi navigabili con gate soft (✅ anche senza lavoro sostanziale).
2. **Qualità / best practice** — obiettivo, limiti chiari, 3–5 use case solidi, API testate, slot coerenti, voce adatta al tono. Il Tutor può guidarti anche se lo stepper è già verde.

## 2. Come funziona il wizard
- **Ogni scheda è indipendente**: puoi entrare e uscire liberamente dallo stepper e dalle tab Tutor.
- **Ogni scheda ha la sua conversazione** nel TutorPanel (tab Task, Prompts, Backend, Dati, Voce).
- **Il Tutor ti guida in modo contestuale** per la fase attiva; puoi fare domande anche su altre fasi (routing automatico).
- **Puoi sempre tornare indietro** e modificare; il Tutor aggiorna intro e messaggi al cambio fase.
- **Conferma fase**: nel pannello Tutor a destra, non nel canvas centrale.
- **Durante elaborazione IA**: attendi; il Tutor non disturba.

## 3. Cosa fare adesso? (Guida passo-passo)

### Passo 1 — Task
1. Scrivi in linguaggio naturale cosa deve fare l'agente (obiettivo, ordine domande, vincoli, tono).
2. Se il campo è vuoto → inizia a scrivere; se già compilato → il Tutor suggerisce **Create Agent**.
3. Clicca **Create Agent** → l'AI genera le tab strutturate (Scopo, Sequenza, Vincoli, Tono, …).
4. Leggi e correggi ciò che non ti convince; opzionale **Refine comportamento**.
5. Conferma al Tutor quando soddisfatto.

**Quando è «fatto bene»?** Obiettivo, limiti, tono e regole espliciti; niente ambiguità su cosa l'agente NON deve fare.
**Check stepper ✅:** descrizione non vuota.

### Passo 2 — Prompts
1. Apri il sub-wizard: **Casi d'uso → Conversazioni → Prompt e JSON**.
2. **Genera use case** (o incolla draft → Analizza e crea) partendo da Task + KB + Backend se presenti.
3. Rivedi etichette, scenari, messaggi agente; aggiungi casi limite.
4. Passo **Conversazioni**: verifica dialoghi realistici.
5. Passo **Prompt e JSON**: verifica token/slot e JSON derivato.
6. Opzionale: toggle **Error handling** per regole su errori conversazionali.
7. Conferma al Tutor.

**Quando è «fatto bene»?** Copertura casi principali e limite; conversazioni naturali; stile coerente col Task. Consiglio: 3–5 use case solidi (non è un gate tecnico obbligatorio).
**Check stepper ✅:** ≥1 use case e ≥1 conversazione.

### Passo 3 — Backend
1. Vista principale: **Add backend** → **Add existing backend** (URL OpenAPI) o **Create backend specs** (manuale).
2. **Recupera specifiche** → rivedi SEND/RECEIVE nell'editor della call.
3. Compila input mock → **Test API** (nell'editor, non in cima alla lista).
4. Toggle **Knowledge Base**: carica documenti (.txt, .xlsx, .pdf, …) se l'agente deve conoscere policy/cataloghi.
5. Toggle **Interface**: definisci contratto INPUT/OUTPUT agente se serve.
6. Conferma al Tutor.

**Quando è «fatto bene»?** Ogni backend necessario ha input/output chiari e, se possibile, testato con Test API.
**Check stepper ✅:** oggi sempre navigabile (soft); conviene comunque configurare le azioni reali.

### Passo 4 — Dati
1. Completa Prompts (use case + conversazioni) — alimenta gli slot.
2. Apri passo Dati: tabella **slot proposti** (etichetta, tipo, provenienza use case).
3. Correggi nomi e tipi; elimina duplicati o campi superflui.
4. Rivedi sezione **Project Derived Backends** se presente.
5. Conferma al Tutor.

**Quando è «fatto bene»?** Nomi chiari nel dominio, tipi corretti, coerenza con token in Prompts.
**Check stepper ✅:** oggi sempre navigabile (soft). **Non esiste «Valida schema»** — la revisione è manuale.

### Passo 5 — Voce
1. Apri passo Voce (IAAgentSetup / Agent setup).
2. Scegli **piattaforma** (es. ElevenLabs) e **voce TTS** coerente col tono del Task (default già precaricata).
3. Regola parametri runtime visibili (LLM, tool backend se ConvAI).
4. Clicca **Salva** — obbligatorio per persistere su DB.
5. Opzionale: provisioning ConvAI.
6. Conferma al Tutor.

**Quando è «fatto bene»?** Voce adatta al Task; configurazione salvata (non ● Modifiche non salvate).
**Check stepper ✅:** oggi sempre navigabile (voce default precaricata).

## 4. Come usare l'AI in ogni fase

| Fase | Azioni IA principali (nomi UI reali) |
|------|--------------------------------------|
| **Task** | **Create Agent** (prima generazione), **Refine comportamento** (raffina), Polish descrizione (solo formattazione testo libero) |
| **Prompts** | **Genera use case** / **Crea altri use case**, analisi draft, rigenera/generalizza use case, assemblaggio conversazioni, compilazione **Prompt e JSON**, token semantici/stile sui messaggi |
| **Backend** | **Recupera specifiche** (OpenAPI → SEND/RECEIVE), **Analisi documento** in Knowledge Base |
| **Dati** | Slot **inferiti** dal flusso (use case/conversazioni) — non c'è IA «Valida schema» |
| **Voce** | Setup runtime per piattaforma; **Salva** persiste; provisioning ConvAI se ElevenLabs |

## 5. Come capire se sei bloccato
Il Tutor può aiutarti se:
- non sai cosa scrivere nel Task;
- non sai cosa fare dopo o qual è il prossimo passo;
- non capisci un campo o un bottone;
- non sai se una fase è completa (stepper vs qualità);
- vuoi un esempio o un controllo di qualità;
- hai confuso termini (documenti, tokenizza, interpreta I/O, valida schema).

Chiedi nella chat Tutor: il routing ti porta alla tab giusta se la domanda riguarda un'altra fase.

## 6. Domande generali che il Tutor deve gestire
Risposte basate su questo manualetto + capitoli di fase:
- «Cosa devo fare adesso?»
- «Qual è il prossimo passo?»
- «Come si completa questa fase?»
- «Cosa devo controllare?»
- «Come funziona il wizard?»
- «Come si crea un agente da zero?»
- «Come faccio a sapere se ho fatto bene?»
- «Dove confermo?» → pannello Tutor, «Conferma fase …».
- «Dove carico i documenti?» → Backend, toggle Knowledge Base.

Se l'informazione non è nel manuale, il Tutor lo dichiara e non inventa.

## 7. Errori comuni nel flusso generale
- Saltare ai backend senza Task chiaro.
- Non generare use case / conversazioni in Prompts.
- Non testare i backend (Test API nell'editor della call).
- Non definire limiti e vincoli nel Task.
- Cercare «Valida schema» in Dati (non esiste).
- Dimenticare **Salva** in Voce dopo modifiche.
- Non confermare le fasi al Tutor quando hai approvato un risultato IA.
- Confondere Knowledge Base con una fase wizard separata (è sotto Backend).
- Cercare Test API in cima alla lista backend (è nell'editor SEND/RECEIVE).

## 8. Obiettivo finale
Alla fine del percorso avrai:
- un **Task** chiaro e strutturato;
- **use case e conversazioni** solidi;
- **backend** (e opzionalmente documenti KB) funzionanti;
- **dati strutturati** (slot) coerenti col dialogo;
- **voce e runtime** allineati al deploy previsto.

Un agente pronto per essere usato o deployato — con revisione umana in ogni passaggio, non solo generazione automatica.
`;
