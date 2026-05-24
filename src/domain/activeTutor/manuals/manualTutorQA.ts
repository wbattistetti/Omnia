/**
 * Active Tutor — domande frequenti e risposte canoniche (per Q&A LLM vincolato).
 */

export const MANUAL_TUTOR_QA = `
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
`;
