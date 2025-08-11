Documento tecnico
Parsing incrementale e mixed-initiative con Compromise.js
1. Obiettivo
Permettere al Chat Simulator di:

Analizzare ogni input utente, anche quando il DDT sta aspettando un solo campo specifico.

Saturare più campi contemporaneamente se l’utente fornisce informazioni extra non richieste.

Gestire input parziali e completamenti successivi in modo naturale.

Esempio:

yaml
Copia
Modifica
Utente: Sono nato a dicembre...
→ Stato: data_di_nascita = { month: "December", day: null, year: null } (partial)

Utente: Mi chiamo Mario Rossi e sono nato il giorno 14 del 1980
→ Stato: data_di_nascita = { month: "December", day: 14, year: 1980 } (complete)
         nome = "Mario Rossi" (complete)
2. Architettura logica
2.1 Stato del DDT
Ogni step del DDT mantiene:

js
Copia
Modifica
expectedFields: [
  { id: "birthDate", subfields: { day: null, month: null, year: null }, status: "empty" },
  { id: "fullName", value: null, status: "empty" },
  ...
]
status può essere:

empty → nessun valore presente

partial → alcuni subcampi valorizzati

complete → tutti i subcampi presenti

2.2 Ciclo di elaborazione input
Ogni volta che arriva un input utente:

Parsing NLP

Usare compromise.js per estrarre:

Date (anche parziali → solo mese, o mese+anno, ecc.)

Nomi propri

Numeri

Email, telefoni (via regex o plugin)

Output: un oggetto con tutti i valori rilevati, anche se non richiesti al momento.

Merge dello stato

Confrontare i valori estratti con quelli già presenti in expectedFields.

Aggiornare i campi:

Se era null → scrivere il nuovo valore

Se esiste già → decidere se ignorare o sovrascrivere (logica a scelta)

Aggiornare status (empty → partial → complete).

Logica di dialogo

Se il campo target corrente è complete, passare al prossimo campo empty.

Se tutti i campi sono complete, passare allo step successivo del DDT.

3. Pseudocodice
js
Copia
Modifica
function processUserInput(inputText, state) {
  // 1. Parsing NLP
  const nlpResult = parseWithCompromise(inputText);

  // 2. Merge dei campi
  state.expectedFields.forEach(field => {
    if (field.id === "birthDate") {
      const extracted = nlpResult.birthDate; // { day, month, year }
      if (extracted) {
        Object.keys(extracted).forEach(k => {
          if (!field.subfields[k] && extracted[k]) {
            field.subfields[k] = extracted[k];
          }
        });
        field.status = checkDateCompletion(field.subfields);
      }
    } else if (field.id === "fullName") {
      if (!field.value && nlpResult.fullName) {
        field.value = nlpResult.fullName;
        field.status = "complete";
      }
    }
    // altri campi...
  });

  // 3. Logica di navigazione
  if (allFieldsComplete(state.expectedFields)) {
    moveToNextStep();
  } else {
    askForNextMissingField();
  }
}
4. Parsing con compromise.js
Esempio di estrazione:

js
Copia
Modifica
function parseWithCompromise(text) {
  const doc = nlp(text);

  // Nome
  const names = doc.match('#Person+').out('array');
  const fullName = names.length > 0 ? names.join(' ') : null;

  // Date (anche parziali)
  const dates = doc.dates().json({ partial: true });
  let birthDate = null;
  if (dates.length > 0) {
    const parts = dates[0].parts || {};
    birthDate = {
      day: parts.day || null,
      month: parts.month || null,
      year: parts.year || null
    };
  }

  return { fullName, birthDate };
}
5. Mixed-initiative
La chiave è:

Non filtrare l’output NLP solo in base al campo atteso

Accettare e salvare qualsiasi campo trovato

Aggiornare lo stato globale del DDT a ogni turno

6. Benefici
Conversazione più naturale

L’utente non deve “aspettare” di essere interrogato per dare un’informazione

Riduzione degli step totali

Migliore gestione di input lunghi o contenenti più dati

Se vuoi, nel prossimo passo posso produrre un diagramma di flusso che rappresenta l’intero ciclo "input → parsing → merge → navigazione" così puoi passarlo diretto a Cursor per implementazione senza ambiguità. Vuoi che lo faccia?







Chiedi a ChatGPT
