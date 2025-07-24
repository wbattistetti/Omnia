



const { MongoClient } = require('mongodb');
// CONFIGURA QUI
const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

const DB_NAME = 'factory';
const COLLECTION = 'Translations';

// Dati delle translations da INSERIRE/AGGIORNARE (chiavi corrette!)
const newTranslations = {
  "runtime.DDT_BirthOfDate.askQuestion1.text": {
    "en": "What is the patient's date of birth?",
    "it": "Qual è la data di nascita del paziente?",
    "fr": "Quelle est la date de naissance du patient ?"
  },
  "runtime.DDT_BirthOfDate.sayMessage1.text": {
    "en": "Please provide the patient's date of birth.",
    "it": "Per favore, inserisci la data di nascita del paziente.",
    "fr": "Veuillez fournir la date de naissance du patient."
  },
  "runtime.DDT_BirthOfDate.sayMessage2.text": {
    "en": "I didn't understand. Could you provide the patient's date of birth?",
    "it": "Non ho capito. Puoi fornire la data di nascita del paziente?",
    "fr": "Je n'ai pas compris. Pouvez-vous fournir la date de naissance du patient ?"
  },
  "runtime.DDT_BirthOfDate.askConfirmation1.text": {
    "en": "Just to confirm, is your date of birth {dateOfBirth}?",
    "it": "Solo per confermare, la tua data di nascita è {dateOfBirth}?",
    "fr": "Juste pour confirmer, votre date de naissance est-elle {dateOfBirth} ?"
  },
  "runtime.DDT_BirthOfDate.askConfirmation2.text": {
    "en": "Since you are under 25, can you confirm your date of birth: {dateOfBirth}?",
    "it": "Poiché hai meno di 25 anni, puoi confermare la tua data di nascita: {dateOfBirth}?",
    "fr": "Puisque vous avez moins de 25 ans, pouvez-vous confirmer votre date de naissance : {dateOfBirth} ?"
  },
  "runtime.DDT_BirthOfDate.sayMessage3.text": {
    "en": "The date format is invalid. Please use YYYY-MM-DD.",
    "it": "Il formato della data non è valido. Usa AAAA-MM-GG.",
    "fr": "Le format de la date n'est pas valide. Utilisez AAAA-MM-JJ."
  },
  "runtime.DDT_BirthOfDate.sayMessage4.text": {
    "en": "The date of birth must be in the past.",
    "it": "La data di nascita deve essere nel passato.",
    "fr": "La date de naissance doit être dans le passé."
  },
  "runtime.DDT_BirthOfDate.sayMessage5.text": {
    "en": "You must be at least 18 years old.",
    "it": "Devi avere almeno 18 anni.",
    "fr": "Vous devez avoir au moins 18 ans."
  },
  "runtime.DDT_BirthOfDate.sayMessageSuccess.text": {
    "en": "Thank you! Your date of birth has been recorded.",
    "it": "Grazie! La tua data di nascita è stata registrata.",
    "fr": "Merci ! Votre date de naissance a été enregistrée."
  }
};

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    for (const [key, value] of Object.entries(newTranslations)) {
      const existing = await collection.findOne({ key });
      if (existing) {
        const updatedValue = { ...existing.value, ...value };
        if (JSON.stringify(existing.value) !== JSON.stringify(updatedValue)) {
          await collection.updateOne(
            { key },
            { $set: { value: updatedValue } }
          );
          console.log(`Aggiornato: ${key}`);
        } else {
          console.log(`Nessun cambiamento per: ${key}`);
        }
      } else {
        await collection.insertOne({ key, value });
        console.log(`Inserito: ${key}`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
