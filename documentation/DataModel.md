# DataModel.md

## 1. Overview

Questo documento definisce la struttura dati, le convenzioni di naming e la separazione tra **definizione** (schema/structure) e **valori** (values) per la gestione degli Agent Act, delle azioni e dei parametri multilingua/multistile in un sistema low-code/no-code internazionale.

---

## 1.1. Concetto di Act Template e Istanza

- **Act Template**: è il modello di base di un Agent Act, definito come file separato (es: `AA071.definition.json`). Il template rappresenta la "versione zero" dell'act, cioè la struttura e i parametri di default che possono essere riutilizzati e istanziati più volte nei flussi.
- **Istanza di Act**: quando un template viene aggiunto a un flusso, ne viene creata una istanza. Ogni istanza eredita la struttura dal template, ma può avere valori specifici (es: testi, parametri) e un identificatore univoco nel contesto del flusso.
- **Separazione in file**: ogni template e ogni istanza (se persistente) sono rappresentati da file separati per garantire modularità, riuso e versionamento. Tuttavia, l'editor sarà unico e gestirà sia la modifica dei template che delle istanze, garantendo coerenza e prevenendo errori di allineamento tra struttura e valori.
- **Modello editoriale**: anche se i dati sono divisi in molti file per motivi di manutenibilità e scalabilità, l'utente lavorerà sempre tramite un unico editor visuale che presenterà template e istanze in modo uniforme, evitando confusione e disallineamenti.

---

## 2. Concetti chiave

- **Catalogo delle azioni (Action Catalog):**  
  Contiene la definizione globale di ogni tipo di azione (es: sayMessage, askQuestion), con la struttura dei parametri, label/description multilingua per l’IDE, e metadati (icona, colore, ecc.).

- **Definition di AgentAct:**  
  Ogni AgentAct ha un file che descrive la struttura dell’act, le azioni usate (con ID di istanza), i tipi di response (Normal, NoInput, ecc.), e i riferimenti alle azioni del catalogo.

- **Values per AgentAct:**  
  Ogni istanza di AgentAct ha i propri valori (testi, prompt, ecc.) per ogni parametro delle azioni, organizzati per lingua e stile, e collegati tramite una chiave composta.

- **Dizionario IDE:**  
  File separato che contiene tutte le label, description, tooltip, ecc. multilingua per l’IDE/editor, referenziate tramite chiavi parlanti.

---

## 3. Struttura delle cartelle

```
AgentsActs/
  Definitions/
    AA001.definition.json
    AA002.definition.json
    ...
  Values/
    AA001.sayMessage1.text.json
    AA002.askQuestion1.text.json
    ...
ActionCatalog/
  actionsCatalog.json
IDE/
  ActionsDictionary.json
```

---

## 4. Catalogo delle azioni (Action Catalog)

**Esempio:**
```json
{
  "id": "sayMessage",
  "label": "Message", // ID parlante, label inglese di default
  "description": "Sends a text message to the user.",
  "icon": "MessageCircle",
  "color": "text-blue-500",
  "params": {
    "text": {
      "label": "Text",
      "description": "The message to show to the user.",
      "type": "string",
      "multilang": true,
      "multistyle": true,
      "required": true
    }
  }
}
```
- **Nota:** label/description sono chiavi, la traduzione è nel dizionario IDE.

---

## 5. Definition di AgentAct

**Esempio:**
```json
{
  "id": "AA071",
  "type": "informative",
  "label": "Agent presents current campaign",
  "description": "Agent presents current campaign",
  "category": "Agent provides general or miscellaneous information",
  "responses": {
    "Normal": {
      "action": "sayMessage1",
      "actionType": "sayMessage"
    }
  },
  "tags": ["general information"]
}
```
- **Nota:** Nessuna sezione `params` qui, la struttura dei parametri è presa dal catalogo delle azioni.

---

## 6. Dizionario IDE (ActionsDictionary.json)

**Esempio:**
```json
{
  "sayMessage.Label": {
    "en": "Message",
    "it": "Messaggio",
    "pt": "Mensagem"
  },
  "sayMessage.Description": {
    "en": "Sends a text message to the user.",
    "it": "Invia un messaggio testuale all'utente.",
    "pt": "Envia uma mensagem de texto para o usuário."
  },
  "sayMessage.Params.Text.IDELabel": {
    "en": "Text",
    "it": "Testo",
    "pt": "Texto"
  },
  "sayMessage.Params.Text.IDEDescription": {
    "en": "The message to show to the user.",
    "it": "Il messaggio da mostrare all'utente.",
    "pt": "A mensagem a ser mostrada ao usuário."
  }
}
```

---

## 7. Values per AgentAct (esempio per AA071)

**Esempio:**

**File:** `AgentsActs/Values/AA071.sayMessage1.text.json`
```json
{
  "Formal": {
    "en": "Would you like to join the campaign active until the end of the month?",
    "it": "Vuoi aderire alla campagna attiva fino alla fine del mese?",
    "pt": "Gostaria di partecipare alla campagna attiva fino alla fine del mese?"
  }
}
```
- **Nota:** La chiave del file segue la convenzione `ActID.ActionInstanceID.ParamName.json`.

---

## 8. Convenzioni di naming

- **ActID**: identificatore univoco dell’act (es: AA071)
- **ActionInstanceID**: identificatore univoco dell’azione all’interno dell’act (es: sayMessage1)
- **ParamName**: nome del parametro (es: text)
- **Chiave completa**: `ActID.ActionInstanceID.ParamName` (es: AA071.sayMessage1.text)
- **File dei valori**: `AA071.sayMessage1.text.json`

---

## 9. Best practice

- **Separazione netta** tra struttura (definition/catalogo) e valori (values/dizionario)
- **Tutte le label/description per l’IDE** sono multilingua e centralizzate nel dizionario
- **Tutti i valori runtime** sono multilingua/multistile e referenziati tramite chiavi composte
- **Nessuna ridondanza**: la struttura dei parametri è definita una volta sola nel catalogo delle azioni
- **Scalabilità**: aggiungere nuove lingue, stili, azioni o act è semplice e ordinato

---

## 10. Esempio di lookup

- L’IDE mostra la label di un parametro cercando `sayMessage.Params.Text.IDELabel` nel dizionario, nella lingua selezionata
- Il motore runtime carica il valore effettivo cercando il file `AA071.sayMessage1.text.json` e selezionando la lingua/stile richiesto

---

**Questo modello dati garantisce chiarezza, manutenibilità, internazionalizzazione e scalabilità per sistemi di dialogo e automazione avanzati.** 

---

## 11. Specializzazione dinamica degli act tramite labelSeed e owner

- **Act acquisitivi generici** (es: acquisizione di una data, di un numero, di un testo) sono definiti come template riutilizzabili.
- **La specializzazione** avviene a design time (o runtime) tramite la combinazione di:
  - `labelSeed`: un ID parlante che rappresenta il “seme” della label della variabile (es: "DateOfBirth", "MeterReading")
  - `owner`: il contesto in cui l’act viene usato (es: "Patient", "Contract", "Device")
- **A design time**, la UI/editor (o una IA) può generare label e descrizioni specifiche combinando `labelSeed` e `owner`, e risolvendo la traduzione tramite un dizionario multilingua.

**Esempio di definition per un act acquisitivo generico:**
```json
{
  "id": "AA010",
  "responses": {
    "Normal": {
      "action": "askQuestion1",
      "actionType": "askQuestion"
    }
  },
  "data": {
    "type": "date",
    "constraints": [
      { "type": "pastOnly", "message": "La data deve essere nel passato" }
    ]
  },
  "variable": {
    "labelSeed": "DateOfBirth",
    "description": "The variable that stores the value of the date of birth"
  }
}
```

**A design time, se owner = “Patient”:**
- Label generata:  
  - Italiano: "Data di nascita del paziente"
  - Inglese: "Patient's date of birth"
- Descrizione generata:  
  - Italiano: "La variabile che memorizza la data di nascita del paziente"
  - Inglese: "The variable that stores the patient's date of birth"

**Questa logica permette di riutilizzare lo stesso act template in contesti diversi, generando label e descrizioni contestuali e multilingua in modo automatico e centralizzato.** 

---

## Nota sulle label e descrizioni nei template

- Nei template (es: DialogueTemplate), per i campi descrittivi come `label`, `description`, ecc. si usa **solo il testo inglese** come valore di default/ID parlante.
- Le traduzioni multilingua di questi campi sono gestite **solo nel file di translations** tramite chiavi verbose dedotte dal path.
- La struttura multilingua/multistile viene mantenuta **solo per i prompt di dialogo** (es: responses, events), dove serve mostrare output in più lingue e stili all’utente finale.
- Questo approccio rende i template più compatti, leggibili e facilmente manutenibili, centralizzando la localizzazione in un unico punto.

--- 

---

## 12. DataDialogueTemplate: architettura avanzata e gestione dati generici

### Concetto

Un **DataDialogueTemplate (DDT)** è uno schema dichiarativo e modulare che descrive il flusso di acquisizione di un dato generico (es: data, email, codice fiscale, ecc.), gestendo:
- la saturazione del dato (parziale/completo)
- la granularità (es: Date = DayOfMonth, Month, Year)
- la validazione tramite constraint con script
- la gestione di tutti i rami di dialogo (normal, noInput, noMatch, explicitConfirmation, conditionalConfirmation, ecc.)
- la risposta custom per ogni violazione di constraint
- la separazione tra definizione (schema/azioni) e valori (prompt/traduzioni)

### Struttura

```json
{
  "id": "DDT_DateOfBirth",
  "label": "Acquire date of birth",
  "description": "Flow to acquire the user's date of birth, handling partial input and validation.",
  "dataType": {
    "type": "Date",
    "fields": ["DayOfMonth", "Month", "Year"]
  },
  "variable": "dateOfBirth",
  "constraints": [
    { "name": "date_format", "script": "isValidDate(dateOfBirth)" },
    { "name": "past", "script": "dateOfBirth < now" },
    { "name": "age_min", "script": "getAge(dateOfBirth) >= 18" }
  ],
  "steps": {
    "normal": [
      { "action": "askQuestion", "params": { "textKey": "dialogue.DDT_DateOfBirth.ask" } }
    ],
    "noInput": [
      { "action": "sayMessage", "params": { "textKey": "dialogue.DDT_DateOfBirth.noInput" } }
    ],
    "noMatch": [
      { "action": "sayMessage", "params": { "textKey": "dialogue.DDT_DateOfBirth.noMatch" } }
    ],
    "explicitConfirmation": [
      { "action": "askConfirmation", "params": { "textKey": "dialogue.DDT_DateOfBirth.confirm" } }
    ],
    "conditionalConfirmation": [
      {
        "condition": "getAge(dateOfBirth) < 25",
        "actions": [
          { "action": "askConfirmation", "params": { "textKey": "dialogue.DDT_DateOfBirth.confirmYoung" } }
        ]
      }
    ]
  },
  "constraintViolations": {
    "date_format": [
      { "action": "sayMessage", "params": { "textKey": "dialogue.DDT_DateOfBirth.invalidFormat" } }
    ],
    "past": [
      { "action": "sayMessage", "params": { "textKey": "dialogue.DDT_DateOfBirth.mustBePast" } }
    ],
    "age_min": [
      { "action": "sayMessage", "params": { "textKey": "dialogue.DDT_DateOfBirth.tooYoung" } }
    ]
  }
}
```

### Spiegazione dei campi
- **dataType**: struttura del dato e granularità (utile per parsing/saturazione automatica)
- **constraints**: ogni constraint ha un nome e uno script di validazione
- **steps**: mappa di rami di dialogo, ognuno con una sequenza di azioni modulari (mai prompt hardcoded)
- **constraintViolations**: per ogni constraint, una sequenza di azioni da eseguire in caso di violazione
- **Tutti i testi** sono referenziati tramite chiavi verbose e gestiti in file di traduzioni separati

### Gestione della saturazione del dato
Se la variabile (es: dateOfBirth) è parzialmente saturata (es: solo mese e anno), il motore runtime può:
- capire quali "pezzi" mancano (es: DayOfMonth)
- lanciare il DDT specifico per acquisire solo il dato mancante (es: DDT_DayOfMonth)
- aggiornare la variabile fino a saturazione

### Confronto con schemi classici
- **Classico**: sequenza lineare di step, prompt hardcoded, gestione errori generica, validazione poco modulare, poca riusabilità
- **Questo modello**: dichiarativo, modulare, ogni ramo esplicito, constraint con script, azioni referenziate, gestione avanzata di errori/eventi, massima riusabilità e multilingua

### Vantaggi
- Massima chiarezza e scalabilità
- Gestione avanzata di ogni eccezione e condizione
- Perfetto per sistemi multi-tenant, multilingua, enterprise
- Facilmente estendibile e versionabile

### Best practice
- Separare sempre definizione (schema, azioni, constraints) e valori (prompt, traduzioni)
- Usare chiavi verbose per ogni testo
- Definire i constraint come oggetti con nome e script
- Gestire ogni ramo di dialogo come array di azioni
- Centralizzare le traduzioni in file separati

--- 