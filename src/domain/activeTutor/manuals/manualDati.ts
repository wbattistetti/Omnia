/**

 * Active Tutor — manuale fase Dati (wizard step 3).

 */



export const MANUAL_DATI = `

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

`;


