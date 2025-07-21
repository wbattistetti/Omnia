// Script Node.js per importare Actions e Translations in MongoDB Atlas
// Uso: node crea_actions_factory.cjs
// Richiede: npm install mongodb

const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function main() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const factoryDb = client.db(dbFactory);

    // Importa Actions
    const actions = JSON.parse(fs.readFileSync('data/Actions.delete.json', 'utf8'));
    if (actions.length > 0) {
      await factoryDb.collection('Actions').deleteMany({}); // cancella tutto prima
      await factoryDb.collection('Actions').insertMany(actions);
      console.log(`Aggiunte ${actions.length} actions in factory.Actions`);
    } else {
      console.log('Nessuna action trovata nel file.');
    }

    // Importa Translations
    const translationsObj = JSON.parse(fs.readFileSync('data/Actions.translations.delete.json', 'utf8'));
    const translations = Object.entries(translationsObj).map(([key, value]) => ({ key, value }));
    if (translations.length > 0) {
      await factoryDb.collection('Translations').deleteMany({ key: { $regex: /^action\./ } }); // cancella solo le action
      await factoryDb.collection('Translations').insertMany(translations);
      console.log(`Aggiunte ${translations.length} traduzioni in factory.Translations`);
    } else {
      console.log('Nessuna traduzione trovata nel file.');
    }
  } catch (err) {
    console.error('Errore:', err);
  } finally {
    await client.close();
  }
}

main(); 