# MANUALE OMNIA DESIGNER — WIZARD DI COSTRUZIONE AGENTE (v2)

## Introduzione
Omnia guida il designer non tecnico nella costruzione di un agente conversazionale in 5 fasi:
1. **Task** — cosa deve fare l'agente (descrizione + sezioni strutturate)
2. **Prompts** — use case, conversazioni, compilazione prompt/JSON, stile conversazionale
3. **Backend** — azioni API + Knowledge Base documenti + Interface agente
4. **Dati** — slot e campi dedotti dai dialoghi
5. **Voce** — configurazione TTS/runtime IA (es. ElevenLabs ConvAI)

Ordine ufficiale stepper: **Task → Prompts → Backend → Dati → Voce**.

## Stepper (barra passi in alto)
- Cinque bottoni numerati: Task, Prompts, Backend, Dati, Voce.
- Stato visivo: ✅ completato, ? da completare, 🔒 bloccato se i passi precedenti mancano (gating soft; in review si può bypassare).
- Sul passo **Backend**: toggle aggiuntivi **Knowledge Base** e **Interface**.
- Sul passo **Prompts**: toggle **Error handling**.
- Icona **Costi** ($): pannello stima costi IA — non è una fase wizard.

## Tutor attivo (pannello destro)
- Barra tab interna: **[TASK] [PROMPTS] [BACKEND] [DATI] [VOCE]** — una conversazione separata per fase.
- Click tab Tutor ↔ sincronizza stepper wizard (bidirezionale).
- Il Tutor risponde **SOLO** in base a questo manuale; se l'informazione non c'è, lo dice esplicitamente.
- **Conferma fase**: bottone «Conferma fase …» nel pannello Tutor quando lo stato è ai_completed o iterating — **non** esiste «Conferma Task» nel canvas centrale.
- Tab Tutor sempre cliccabili; fase incompleta → avviso ma nessun blocco.
- Durante elaborazione AI (waiting_for_ai): Tutor silenzioso, input disabilitato.
- Domande libere: il Tutor classifica keyword e può rispondere nella tab della fase rilevata anche se sei su un'altra tab.

## Macchina a stati (per ogni fase, indipendente)
Stati: idle → waiting_for_ai → ai_completed → iterating → awaiting_confirmation → completed.
- **waiting_for_ai**: click su bottone IA (Create Agent, Genera use case, Recupera specifiche, Analisi documento, …).
- **ai_completed / iterating**: risultato IA pronto; designer rivede e può iterare.
- **completed**: fase confermata al Tutor.

## Completamento step (regole stepper)
- **Task ✅**: descrizione non vuota.
- **Prompts ✅**: almeno 1 use case **e** almeno 1 conversazione.
- **Backend, Dati, Voce**: navigabili (soft gate); conviene configurarli comunque.

## Attenzione visiva (glow/lampeggio)
Il Tutor evidenzia controlli reali via registry UI_IDS: campo descrizione Task, lista use case, lista backend, tabella dati, pannello voce, ecc.

## FAQ generali
- Puoi tornare indietro e modificare qualsiasi fase in qualsiasi ordine.
- Puoi correggere prima di confermare una fase al Tutor.
- Durante elaborazione AI: attendi; il Tutor non disturba.
- Nomi UI reali spesso in inglese dove il prodotto li mostra così: «Create Agent», «Add backend», «Test API».
- Non serve essere tecnici: segui i bottoni visibili e chiedi al Tutor cosa fare dopo.

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

## Glossario e mapping termini

### Fasi wizard (ordine ufficiale)
| # | Stepper | Tab Tutor | Contenuto principale |
|---|---------|-----------|----------------------|
| 0 | Task | Task | Descrizione agente + sezioni strutturate |
| 1 | Prompts | Prompts | Use case, conversazioni, prompt/JSON, stile |
| 2 | Backend | Backend | Lista API + toggle Knowledge Base + toggle Interface |
| 3 | Dati | Dati | Slot proposti dedotti dai dialoghi |
| 4 | Voce | Voce | Setup runtime IA / TTS (IAAgentSetup) |

### Termini legacy → UI reale
| Termine vecchio / generico | Dove si trova nel prodotto |
|---------------------------|----------------------------|
| Documenti, manuali PDF | **Knowledge Base** — toggle nello stepper sul passo Backend |
| Scenari generali, categorie | **Prompts** → sub-wizard **Casi d'uso** (categorie use case) |
| Use case (fase separata) | **Prompts** — non è uno step top-level |
| Formatta / Formatta descrizione | **Create Agent** (prima generazione) o **Refine comportamento** (dopo) |
| Interpreta I/O | **Recupera specifiche** (Read API OpenAPI) + editor SEND/RECEIVE |
| Aggiungi backend da catalogo/file | **Add backend** → **Add existing backend** (URL OpenAPI) o **Create backend specs** |
| Conferma Task/Prompts/Backend/… | **Conferma fase …** nel **pannello Tutor** (non nel canvas centrale) |
| Editor schema dati / Valida schema | Tabella **slot proposti** — revisione manuale, nessun bottone Valida |
| Tokenizza (bottone globale) | Passo **Prompt e JSON** + menu contestuale **Semantic token** / **Style token** sui messaggi |
| Test voce (unico bottone) | Dipende dalla piattaforma; in Voce c'è **Salva** e setup per piattaforma |

### Sotto-viste step Backend (stesso step wizard, toggle stepper)
- **Vista principale**: lista backend (accordion azioni API).
- **Knowledge Base**: upload documenti, analisi IA, variabili da colonne tabellari (.xlsx).
- **Interface**: contratto INPUT/OUTPUT dell'interfaccia agente (mapping campi).

### Sotto-viste step Prompts (sub-wizard interno)
1. **Casi d'uso** — generazione/revisione use case e categorie.
2. **Conversazioni** — dialoghi multi-turno collegati agli use case.
3. **Prompt e JSON** — compilazione runtime, token, JSON motore read-only.

### Toggle aggiuntivi stepper
- **Error handling** (passo Prompts): regole conversazionali per gestione errori.
- **Costi** (icona $): stima costi chiamate IA del progetto — informativo, non è una fase wizard.
- **Deploy / Review publish** (slot header): deploy e pubblicazione review — fuori dal flusso costruzione base.

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

## FASE 2 — KNOWLEDGE BASE (step wizard 1)

### Scopo
Caricare documenti sul task (.txt, .xlsx, .pdf, …) e arricchire il contesto dell'agente con analisi markdown e variabili da colonne tabellari.

### Componenti interfaccia
- **Pannello Knowledge Base** (data-tutor-id knowledge-base-panel): vista principale dello step.
- **Lista documenti** (data-tutor-id kb-document-list): elenco file caricati, riordino, rimozione.
- **Analisi documento**: seleziona un file → l'IA produce riassunto markdown (data-tutor-id kb-analysis-result).

### Azioni
1. Apri lo step **Knowledge Base** nello stepper wizard (passo 2/7).
2. Trascina o seleziona file (.txt, .xlsx, …).
3. Seleziona un documento e avvia **Analisi documento** per ottenere il markdown strutturato.
4. I documenti restano nel repository progetto; l'analisi resta sul task.

### Errori comuni
- Caricare documenti enormi senza verificare l'analisi → controlla sempre il riassunto.
- Confondere KB con Backend: KB è uno step dedicato, non un toggle sul Backend.

### FAQ
- «Dove carico i PDF?» → Step Knowledge Base, pulsante aggiungi file nel pannello documenti.
- «Serve per generare use case?» → Sì, la generazione bundle Prompts può usare Task + KB + Backend.

### UI_IDS rilevanti
- knowledge-base-panel, kb-document-list, kb-analysis-result, wizard-step-1

## FASE 3 — BACKEND (step wizard 2)

### Scopo
Definire le **azioni eseguibili** che l'agente può chiamare (API, prenotazioni, ricerche, email, ecc.) e la **conoscenza documentale** (Knowledge Base). Il backend trasforma l'agente da «parlante» a «operativo».

### Tre viste nello stesso passo Backend (toggle stepper)
1. **Lista backend** (vista principale, default) — catalogo azioni API del progetto.
2. **Knowledge Base** — documenti per conoscenza agente e generazione use case.
3. **Interface** — contratto INPUT/OUTPUT dell'interfaccia agente.

### Componenti — Lista backend
- **Lista backend** (accordion, data-tutor-id backend-list): ogni riga = un'azione con nome, URL, metodo HTTP.
- **Add backend** (dropdown header):
  - **Add existing backend** — importa da URL OpenAPI/specifiche esterne.
  - **Create backend specs** — crea specifiche manuali (emulazione) senza OpenAPI iniziale.
- **Flusso Add existing backend**:
  1. Aggiungi riga accordion con campo URL endpoint.
  2. Clicca **Recupera specifiche** (Read API OpenAPI).
  3. Se OAuth richiesto: autenticazione portale, poi ritenta Recupera.
  4. Accordion si espande con SEND/RECEIVE configurati.
- **Accordion espanso** per ogni backend:
  - Header collassato: chevron + nome + URL + metodo + Recupera.
  - Identità: nome, URL endpoint (modificabile; rosso se Recupera fallito), metodo HTTP.
  - Descrizione testuale dell'azione.
  - **SEND** / **RECEIVE**: mapping parametri input/output nell'editor Backend Call embedded.
  - Tabella mock input/output per prova e emulazione.
  - Toggle tool **ConvAI** (ElevenLabs) se piattaforma lo prevede — espone backend come tool agente vocale.
  - **OAuth portale** se l'API richiede Bearer token (Read API e Test API).
  - Icona cestino: elimina backend.
- **Recupera specifiche**:
  - Scarica e interpreta OpenAPI dall'URL.
  - Popola colonne SEND (param.* da nomi interni/wireKey, non solo label OpenAPI).
  - NON si chiama «Interpreta I/O» — il nome reale è **Recupera specifiche**.
- **Test API** (toolbar editor Backend Call, NON in cima alla lista):
  - Chiamata HTTP reale via proxy ApiServer.
  - Abilitato se almeno una riga mock ha input compilati (o fallback letterali SEND).
  - Stati: needs_setup (nessun SEND), incomplete (celle vuote), ready.
  - Esegue tutte le righe con input completi; salta righe vuote.
  - **Il toggle MOCK/REAL non cambia Test API** — Test API è sempre HTTP reale.
  - MOCK emula valori output nelle celle senza rete (utile in design, distinto da Test API).
- Backend derivati dal flusso progetto possono comparire anche nel passo Dati (Project Derived Backends).

### Componenti — Knowledge Base
- Toggle stepper **Knowledge Base** sul passo Backend.
- Upload drag-and-drop o selezione file.
- Formati accettati: .txt, .md, .csv, .json, .xlsx, .pdf, .docx, .jpg, .png, .webp.
- **.xlsx / tabellari**: le colonne diventano variabili cliccabili per l'agente.
- Lista documenti con riordino (drag).
- Tab documento selezionato: **Analisi del documento** (IA → markdown strutturato) e vista **Documento**.
- Analisi produce concetti, regole, procedure — alimenta generazione use case e conoscenza agente.
- data-tutor-id: kb-document-list, kb-analysis-result.

### Componenti — Interface
- Toggle stepper **Interface** sul passo Backend.
- Pannello mapping **INPUT** e **OUTPUT** dell'interfaccia agente.
- Separato dalla lista backend API: definisce il contratto dati dell'agente verso l'esterno.
- Righe mapping modificabili (nome campo, tipo, descrizione).

### Flusso consigliato — Backend API
1. **Add backend** → existing (URL OpenAPI) o create specs (manuale).
2. Se import: incolla URL valido → **Recupera specifiche** → attendi espansione accordion.
3. Apri accordion → verifica SEND/RECEIVE, nomi campi param.*, descrizioni, tipi.
4. Compila celle mock input per scenari di prova.
5. Opzionale: **Test API** → verifica risposta HTTP coerente con RECEIVE.
6. Opzionale: abilita tool ConvAI se deploy vocale ElevenLabs.
7. Ripeti per ogni azione necessaria al dominio.
8. Conferma al Tutor.

### Flusso consigliato — Knowledge Base
1. Apri toggle **Knowledge Base** nello stepper (resti nel passo Backend).
2. Carica documenti rilevanti (policy, cataloghi, FAQ, tabelle .xlsx).
3. Seleziona documento → avvia **Analisi documento** se serve strutturazione IA.
4. Leggi output analisi e correggi se impreciso.
5. Torna alla vista lista backend quando finito.

### Flusso consigliato — Interface
1. Toggle **Interface**.
2. Definisci campi INPUT che l'agente riceve e OUTPUT che restituisce a sistema esterno.
3. Allinea nomi con slot Dati e token Prompts dove applicabile.

### Logica Tutor — Backend
- Ingresso tab (vista principale): «Qui definisci le azioni che l'agente può chiamare.»
- Nessun backend: «Aggiungi un backend con Add backend: importa da URL (Add existing backend) o crea specifiche (Create backend specs).»
- Backend presenti: «Puoi modificarli, testarli (Test API nell'editor della call) o aggiungerne altri.»
- Sotto-vista Knowledge Base: «Carica documenti (.txt, .xlsx, .pdf, …) per arricchire la conoscenza dell'agente.»
- Sotto-vista Interface: «Definisci il contratto INPUT/OUTPUT dell'interfaccia agente.»
- Dopo Recupera specifiche: «Rivedi SEND e RECEIVE; correggi nomi, tipi e descrizioni.»
- Durante Test API: «Verifica che la risposta HTTP sia coerente con lo schema RECEIVE.»
- Attenzione UI: lista backend o lista documenti KB a seconda della vista attiva.

### Cosa controllare
- Nomi backend chiari e distinti nel dominio
- URL e metodo HTTP corretti
- SEND: tutti i parametri necessari mappati (chiavi param.* da internalName/wireKey)
- RECEIVE: output strutturato e usabile dall'agente nei dialoghi
- OAuth configurato se API protetta
- Test API con risposta coerente allo schema (status, body, campi)
- Documenti KB pertinenti, analisi fedele al contenuto
- Interface allineata a Dati e use case che consumano/producono quei campi

### Errori comuni
- Confondere «Interpreta I/O» con **Recupera specifiche**
- Cercare Test API in cima alla lista invece che nell'editor Backend Call espanso
- Input SEND troppo generici o nomi OpenAPI non allineati a param.*
- Output RECEIVE non strutturati o non mappati
- Credere che MOCK sostituisca Test API (sono meccanismi distinti)
- Dimenticare Knowledge Base quando l'agente deve conoscere policy/cataloghi
- Trattare Knowledge Base come fase wizard separata (è sotto Backend)
- Non collegare mentalmente backend agli use case che li invocano (si verifica in Prompts)

## FASE 4 — PROMPTS (step wizard 3)



### Scopo

Definire come l'agente si comporta in situazioni reali: use case, conversazioni, compilazione runtime (token/prompt/JSON), stile conversazionale.



### Struttura interna (sub-wizard a 3 stazioni)

Il passo Prompts NON è un unico editor piatto. Contiene il **Use Case Generator Wizard** con tre tab/stazioni in toolbar:

1. **Casi d'uso** — lista use case (etichetta, scenario/payoff, messaggio agente, categorie).

2. **Conversazioni** — dialoghi multi-turno collegati agli use case.

3. **Prompt e JSON** — compilazione automatica: testo naturale con slot, template runtime, JSON motore (read-only derivato).



Tutorial ufficiale per stazione (pannello destro sub-wizard):

- **Casi d'uso**: genera automaticamente i casi frequenti; controlla etichette, scenari, aggiungi/elimina.

- **Conversazioni**: revisione fondamentale per flusso dialogico naturale e coerente.

- **Prompt e JSON**: verifica frasi canoniche, token runtime, JSON derivato; se JSON non torna, correggi il messaggio agente canonico.



### Componenti — Casi d'uso

- **Stato vuoto** (UseCaseEmptyTutorPanel):

  - Headline: «Generiamo gli use case per guidare l'agente!»

  - Percorso A: incolla lista → textarea draft → **Analizza e crea eventualmente nuovi use case** (o Invio).

  - Percorso B: **Genera use case** (CTA principale).

- **Lista popolata**:

  - **Genera use case** / **Crea altri use case**: generazione IA bundle da **Task + Knowledge Base + Backend** disponibili.

  - Hint sotto textarea: «Incolla o scrivi uno o più scenari: INVIO e l'IA li analizza e li aggiunge alla lista.»

- **Riga use case** (campi e azioni):

  - Etichetta, scenario (payoff), messaggio agente esempio, categoria, voti designer.

  - **Rigenera use case** — rigenera intero use case.

  - **Generalizza** — generalizza titolo e scenario via LLM.

  - **Aggiusta testo** — polish scenario (stesso significato, forma migliore).

  - **Rigenera esempio messaggio** — rigenera turno agente.

  - Elimina use case.

- **Stile globale use case** (contract):

  - **Cortese** — sintetico, call-center, rassicurante.

  - **Ironico** — leggero ma professionale.

  - **Formale** — registro formale, lessico preciso.

- **Categorie use case**: aree funzionali / scenari generali (non fase wizard separata).



### Componenti — Conversazioni

- Bubble dialogo multi-turno per use case.

- Revisione turni utente/agente, assemblaggio conversazioni.

- Toggle visualizzazione token nelle bubble (opzionale).

- Generazione/assemblaggio IA conversazioni collegato agli use case definiti.



### Componenti — Prompt e JSON

- Nastro compilazione: testo naturale → template runtime → JSON.

- Menu contestuale su selezione testo nel messaggio agente:

  - **Semantic token** — slot runtime tra quadre […].

  - **Style token** — varianti stile tra «…».

  - **Untokenize** — rimuove token.

  - **Senza quadre** — testo piano.

  - **Crea JSON** / **Aggiorna JSON** — sync JSON motore da messaggio.

- Toolbar stile messaggio: combinazioni varianti, polish stile, creative IA.

- JSON: **vista read-only derivata** — correggere il messaggio canonico, non il JSON direttamente.



### Componenti — stepper Prompts

- **Error handling** (toggle): catalogo regole conversazionali per gestione errori e casi limite.



### Conferma

- **Conferma fase Prompts**: pannello Tutor — non bottone dedicato nel sub-wizard.



### Flusso consigliato

1. **Casi d'uso**: Genera use case o incolla draft → analizza → controlla etichette/scenari/messaggi.

2. Correggi, elimina, aggiungi; imposta stile globale (Cortese/Formale/Ironico).

3. **Conversazioni**: verifica flusso dialogico naturale per i casi principali e limite.

4. **Prompt e JSON**: verifica slot semantici/stile e coerenza JSON.

5. Opzionale: configura **Error handling**.

6. Conferma al Tutor.



### Logica Tutor — Prompts

- Ingresso tab: «Qui definisci use case, conversazioni, tokenizzazione e stile.»

- Lista vuota: «Puoi incollare un draft o generare da zero con Genera use case.»

- Lista popolata: «Possiamo raffinare gli use case o generarne di nuovi con Crea altri use case.»

- Attenzione UI: editor/lista use case principale (prompts-main-editor).



### Cosa controllare

- Copertura casi principali e casi limite

- Errori gestiti (Error handling se usato)

- Conversazioni realistiche e coerenti col Task

- Stile coerente con Task (cortese/formale/ironico)

- Messaggi agente allineati agli scenari

- Token/slot corretti nel passo Prompt e JSON

- Categorie use case sensate per il dominio



### Errori comuni

- Use case troppo generici o duplicati

- Mancanza varianti o casi limite

- Conversazioni troppo brevi o innaturali

- Non rivedere Prompt e JSON dopo modifiche ai messaggi

- Cercare un unico bottone «Tokenizza» globale (i token si gestiscono nel passo 3 e nel menu messaggio)

- Confondere Prompts con Backend (le API si configurano nello step Backend)

- Dimenticare che generazione use case usa anche KB e Backend se presenti

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

## FASE 6 — DATI (step wizard 5)



### Scopo

Rivedere i **dati strutturati** (slot/campi) che l'agente deve raccogliere o conoscere, **dedotti principalmente** dai dialoghi e dagli use case — non un editor schema libero generico.



Titolo stepper: **Rivedi i dati raccolti**.



### Componenti interfaccia

- **Tabella slot proposti** (AIAgentProposedFieldsTable, data-tutor-id dati-editor):

  - Ogni riga = campo con **etichetta**, **tipo** (arancione), **provenienza** (use case di origine).

  - Modifica etichetta: hover → matita → edit inline → conferma/annulla.

  - Modifica tipo: matita accanto al tipo → select (Testo, Numero, Data, Email, Telefono, Identificativo, …).

  - Elimina riga: icona cestino on hover.

- **Tipi campo disponibili** (select):

  Testo, Testo libero (lungo), Numero, Numero intero, Sì/No, Data, Ora, Data e ora, Email, Telefono, Indirizzo, CAP, URL, Importo/Valuta, Percentuale, Identificativo (ID), Nome completo, Paese, Lingua.

- **Stato vuoto**:

  - Messaggio: «Usa [azione primaria agente] per popolare i dati da raccogliere» — es. Create Agent o flusso use case.

  - I campi **non** si creano manualmente da zero: si generano dal flusso di costruzione (use case / conversazioni / azione IA).

- **Mapping variabili output** (outputVariableMappings):

  - Collegamento slot → variabili motore dove applicabile (gestito internamente, non sotto ogni riga in UI).

- **Project Derived Backends** (sezione sotto la tabella):

  - Backend collegati al contesto dati derivati dal progetto.

  - Riferimenti alle azioni API rilevanti per i dati raccolti.

- **Conferma fase Dati**: pannello Tutor — non bottone «Conferma Dati» nel canvas.



### Tutorial ufficiale step

«Controlla gli slot dedotti dai dialoghi. Ogni slot mostra la sua provenienza (use case di origine) per facilitare la verifica.»



### Flusso consigliato

1. Completa **Prompts** (use case + conversazioni) — alimenta i dati proposti.

2. Apri passo **Dati** nello stepper.

3. Se vuoto: torna a Prompts o esegui azione primaria agente indicata nel messaggio.

4. Per ogni slot: verifica **nome** comprensibile nel dominio, **tipo** corretto, **provenienza** use case sensata.

5. Rimuovi duplicati o campi superflui; correggi etichette ambigue.

6. Controlla coerenza con token [slot] usati in Prompt e JSON.

7. Rivedi Project Derived Backends se presenti.

8. Conferma al Tutor.



### Logica Tutor — Dati

- Ingresso: «Qui definisci i dati strutturati che l'agente deve conoscere.»

- Tabella vuota: «Completa prima Prompts (use case e conversazioni) per popolare gli slot, oppure usa l'azione primaria agente.»

- Tabella piena: «Possiamo validare insieme nomi, tipi e coerenza col Task e con Prompts.»

- Attenzione UI: pannello dati / tabella slot (dati-editor).



### Cosa controllare

- Nomi campo chiari per il dominio (es. data_visita, codice_prestazione — non campo1, valore)

- Tipi coerenti col significato (data → Data, importo → Importo/Valuta)

- Campi obbligatori vs opzionali sensati nel flusso conversazionale

- Provenienza use case corretta per ogni slot

- Nessuno slot orfano, duplicato o ridondante

- Allineamento con token semantici in Prompt e JSON

- Allineamento con Interface INPUT/OUTPUT se definita



### Errori comuni

- Cercare bottone «Valida schema» (non esiste — la validazione è revisione manuale)

- Aspettarsi uno schema JSON libero invece della tabella slot inferita

- Non aggiornare Dati dopo aver cambiato conversazioni o messaggi in Prompts

- Campi troppo generici (campo1, valore, dato, info)

- Tipi sbagliati (testo al posto di data, numero al posto di identificativo)

- Ignorare provenienza use case quando un campo non ha senso nel dominio

## FASE 7 — VOCE (step wizard 6)



### Scopo

Configurare **voce TTS**, **runtime IA** e parametri agente (piattaforma, system prompt runtime, tool, modello LLM) quando l'agente è usato in modalità vocale — es. **ElevenLabs ConvAI**.



Titolo stepper: **Scegli la voce**.



### Componenti interfaccia

- **IAAgentSetup** (pannello principale Agent setup, data-tutor-id voce-editor):

  - Configurazione override **per questo task agente** (non solo globale).

  - Tab/pill **Piattaforma**: ElevenLabs, OpenAI, Gemini, Anthropic, … — determina campi visibili.

- **Voce TTS**:

  - Selezione voce per piattaforma.

  - Una **voce default è già precaricata** — cambiala per personalizzare.

  - Modello TTS se applicabile (es. ElevenLabs).

- **Runtime agente** (dipende da piattaforma):

  - System prompt runtime (override rispetto al Task design-time).

  - Modello LLM, max tokens, endpoint.

  - Lingua agente.

  - Tool/backend inclusi (ElevenLabs: tool derivati da backend catalogo manuale).

- **Salva** (bottone esplicito header pannello):

  - Persiste agentIaRuntimeOverrideJson su DB — sopravvive senza save progetto completo.

  - Stati indicatore: idle, ● Modifiche non salvate (dirty), saving, saved, error.

  - **Obbligatorio** dopo modifiche prima di uscire o deploy.

- **Provisioning ConvAI** (ElevenLabs):

  - Creazione/aggiornamento agente remoto ElevenLabs quando applicabile.

  - Flag elevenLabsNeedsReprovision se cambi voce/modello TTS.

  - Binding sessione agente ConvAI.

- **Conferma fase Voce**: pannello Tutor — distinta da Salva (Salva = persistenza tecnica; Conferma = approvazione fase design).



### Tutorial ufficiale step

«Seleziona la voce TTS dell'agente. Una voce di default è già precaricata: cambiala se vuoi personalizzare.»



### Flusso consigliato

1. Apri passo **Voce** nello stepper.

2. Verifica **piattaforma target** (ElevenLabs per deploy vocale ConvAI).

3. Scegli **voce** adatta al tono definito nel Task (formale vs cordiale).

4. Regola parametri visibili: LLM, system prompt runtime, tool backend se ElevenLabs.

5. Clicca **Salva** e attendi conferma saved.

6. Opzionale: provisioning/anteprima piattaforma (ConvAI create agent).

7. Verifica coerenza con menu **Deploy** in header wizard se previsto.

8. Conferma al Tutor.



### Logica Tutor — Voce

- Ingresso: «Qui definisci la voce e il comportamento vocale dell'agente.»

- Non configurato / default: «Scegli una voce adatta al tono del Task. Ricorda di Salva dopo le modifiche.»

- Configurato (dirty): «Hai modifiche non salvate — clicca Salva nel pannello setup.»

- Configurato (saved): «Puoi regolare voce e parametri runtime; Conferma fase Voce al Tutor quando pronto.»

- Attenzione UI: pannello setup voce/runtime (voce-editor).



### Cosa controllare

- Tono voce coerente con Task (formale vs cordiale vs ironico)

- Piattaforma allineata al deploy previsto (Deploy menu vs setup Voce)

- Tool/backend inclusi se l'agente deve agire in vocale (ElevenLabs)

- System prompt runtime coerente con Prompts e Task

- Configurazione **Salva**ta (indicatore saved, non dirty)

- Re-provisioning ConvAI se cambi voce/modello TTS



### Errori comuni

- Confondere voce TTS con «tono» testuale del Task (collegati ma distinti: Task = design, Voce = runtime TTS)

- Dimenticare **Salva** dopo modifiche (● Modifiche non salvate)

- Piattaforma voce diversa da quella di deploy nel menu Deploy

- Cercare un unico bottone «Test voce» — anteprima dipende dalla piattaforma integrata in IAAgentSetup

- Confermare fase Voce al Tutor senza aver salvato la configurazione

- Non includere tool backend in ConvAI quando gli use case invocano API

## Domande frequenti (Q&A canoniche)

Risposte brevi che il Tutor può usare quando la domanda corrisponde. Usare i nomi UI reali.

### Navigazione e Tutor
**D: Posso tornare indietro a una fase già completata?**
R: Sì. Lo stepper e le tab Tutor sono sempre navigabili. Puoi modificare qualsiasi fase e ri-confermare al Tutor.

**D: Dove confermo una fase?**
R: Nel pannello Tutor a destra: bottone «Conferma fase Task» (o Prompts, Backend, …) quando il Tutor mostra che l'AI ha prodotto un risultato da approvare.

**D: Il Tutor risponde a domande su funzionalità non nel manuale?**
R: No. Se l'informazione non è documentata, il Tutor lo dice esplicitamente e non inventa.

**D: Posso fare domande su un'altra fase mentre sono su Task?**
R: Sì. Il Tutor classifica la domanda, salva il messaggio nella tab corretta e può portarti allo step wizard giusto.

### Task
**D: Cosa scrivo nel Task?**
R: In linguaggio naturale: obiettivo, contesto, informazioni da raccogliere, ordine domande, vincoli, tono. Poi clicca **Create Agent**.

**D: Create Agent o Refine comportamento?**
R: **Create Agent** alla prima generazione (descrizione libera). **Refine comportamento** se l'agente esiste già e vuoi raffinare le sezioni strutturate.

**D: Perché vedo solo la tab Descrizione?**
R: Le tab strutturate (Scopo, Sequenza, …) compaiono **dopo** la prima **Create Agent**.

**D: Cosa sono le tab Scopo, Sequenza, Vincoli?**
R: Sezioni generate dall'AI: Scopo = obiettivo finale; Sequenza = ordine operativo; Vincoli = must/must-not; Personalità/Tono = come parla; Esempi = few-shot opzionali.

### Prompts
**D: Dove genero gli use case?**
R: Passo Prompts → sub-wizard **Casi d'uso** → **Genera use case** (o incolla draft e **Analizza e crea eventualmente nuovi use case**).

**D: Dove sono le conversazioni?**
R: Sub-wizard Prompts → tab **Conversazioni** (secondo passo dopo Casi d'uso).

**D: Dove tokenizzo i messaggi?**
R: Passo **Prompt e JSON** (terzo sub-wizard) oppure menu contestuale su selezione testo: **Semantic token** [slot] o **Style token** «varianti».

**D: Cosa fa Error handling nello stepper?**
R: Toggle sul passo Prompts: apre regole conversazionali per gestire errori e casi limite nel dialogo.

### Backend
**D: Come aggiungo un backend?**
R: **Add backend** → **Add existing backend** (incolla URL OpenAPI, poi **Recupera specifiche**) oppure **Create backend specs** (specifiche manuali/emulate).

**D: Dove è Test API?**
R: Nell'**editor della singola Backend Call** (toolbar quando apri SEND/RECEIVE), **non** in cima alla lista backend.

**D: Cosa fa Recupera specifiche?**
R: Scarica e interpreta OpenAPI dall'URL; espande l'accordion con mapping SEND (input) e RECEIVE (output).

**D: Dove carico i documenti?**
R: Passo Backend → toggle stepper **Knowledge Base**. Formati: .txt, .md, .csv, .json, .xlsx, .pdf, .docx, immagini.

**D: Cos'è Interface nel passo Backend?**
R: Toggle **Interface**: pannello INPUT/OUTPUT del contratto interfaccia agente, separato dalla lista backend API.

**D: MOCK vs REAL e Test API?**
R: Il toggle MOCK/REAL emula output senza rete. **Test API** esegue sempre HTTP reale via proxy e **non** dipende dal toggle MOCK.

### Dati
**D: Perché la tabella Dati è vuota?**
R: Gli slot si deducono da use case e conversazioni in Prompts. Completa Prompts prima, poi usa l'azione primaria agente per popolare i campi.

**D: Esiste Valida schema?**
R: No. Rivedi manualmente nomi, tipi e provenienza use case nella tabella slot proposti.

**D: Che tipi di campo posso usare?**
R: Testo, Numero, Data, Email, Telefono, Identificativo, ecc. — modifica tipo con la matita sulla riga.

### Voce
**D: Devo salvare le modifiche voce?**
R: Sì. Usa **Salva** nel pannello setup (IAAgentSetup). L'indicatore mostra ● Modifiche non salvate finché non salvi.

**D: Quale voce scegliere?**
R: Coerente con il tono del Task. Una voce default è già precaricata; cambiala se serve personalizzare.

**D: ElevenLabs ConvAI?**
R: Con piattaforma ElevenLabs puoi fare provisioning agente remoto e includere tool backend nel setup runtime.
