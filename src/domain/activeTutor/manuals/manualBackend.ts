/**
 * Active Tutor — manuale fase Backend (wizard step 2).
 */

export const MANUAL_BACKEND = `
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
`;
