








const { MongoClient } = require('mongodb');

// CONFIGURA QUI
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'factory';
const collectionName = 'Translations';

// TUTTE LE TRANSLATIONS DEL TUO DDT:
const translations = {
  "DataDialogueTemplates.DDT_BirthOfDate.label": {
    "it": "Acquisisci data di nascita",
    "en": "Acquire date of birth"
  },
  "DataDialogueTemplates.DDT_BirthOfDate.description": {
    "it": "Flusso per acquisire la data di nascita dell'utente, gestendo input parziale, validazione e conferma.",
    "en": "Flow to acquire the user's date of birth, handling partial input, validation, and confirmation."
  },
  "DataDialogueTemplates.DDT_BirthOfDate.constraints.date_format.description": {
    "it": "Controlla che la data sia in un formato valido (YYYY-MM-DD).",
    "en": "Checks that the date is in a valid format (YYYY-MM-DD)."
  },
  "DataDialogueTemplates.DDT_BirthOfDate.constraints.past.description": {
    "it": "Controlla che la data sia nel passato.",
    "en": "Checks that the date is in the past."
  },
  "DataDialogueTemplates.DDT_BirthOfDate.constraints.age_min.description": {
    "it": "Controlla che l'utente abbia almeno 18 anni.",
    "en": "Checks that the user is at least 18 years old."
  },
  "Actions.askQuestion1.text": {
    "it": "Qual è la tua data di nascita?",
    "en": "What is your date of birth?"
  },
  "Actions.sayMessage1.text": {
    "it": "Per favore, inserisci la tua data di nascita.",
    "en": "Please enter your date of birth."
  },
  "Actions.sayMessage2.text": {
    "it": "Non ho capito la data. Puoi ripetere?",
    "en": "I didn't understand the date. Can you repeat?"
  },
  "Actions.askConfirmation1.text": {
    "it": "Confermi questa data di nascita?",
    "en": "Do you confirm this date of birth?"
  },
  "Actions.askConfirmation2.text": {
    "it": "Hai meno di 25 anni, confermi la data inserita?",
    "en": "You are under 25, do you confirm the entered date?"
  },
  "Actions.sayMessage3.text": {
    "it": "Il formato della data non è valido. Usa AAAA-MM-GG.",
    "en": "The date format is not valid. Use YYYY-MM-DD."
  },
  "Actions.sayMessage4.text": {
    "it": "La data deve essere nel passato.",
    "en": "The date must be in the past."
  },
  "Actions.sayMessage5.text": {
    "it": "Devi avere almeno 18 anni.",
    "en": "You must be at least 18 years old."
  },
  "Actions.sayMessageSuccess.text": {
    "it": "Data di nascita acquisita con successo.",
    "en": "Date of birth successfully acquired."
  }
};

async function importTranslations() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    let upserted = 0;
    for (const [key, value] of Object.entries(translations)) {
      const result = await collection.updateOne(
        { key }, // filtro per chiave
        { $set: { key, ...value } }, // aggiorna o inserisce
        { upsert: true }
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) upserted++;
    }
    console.log(`Upserted/updated ${upserted} translation records in ${collectionName}`);
  } catch (err) {
    console.error('Errore durante l\'importazione:', err);
  } finally {
    await client.close();
  }
}

importTranslations();