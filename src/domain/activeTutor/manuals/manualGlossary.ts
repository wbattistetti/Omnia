/**
 * Active Tutor — glossario termini (legacy, sinonimi, mapping UI).
 */

export const MANUAL_GLOSSARY = `
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
`;
