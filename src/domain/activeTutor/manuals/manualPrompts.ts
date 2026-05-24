/**

 * Active Tutor — manuale fase Prompts (wizard step 1).

 */



export const MANUAL_PROMPTS = `

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

`;


