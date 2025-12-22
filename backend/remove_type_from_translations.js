// remove_type_from_translations.js
// Script per rimuovere il campo 'type' dalle traduzioni (mantiene 'Synonyms' che è caso speciale)
const { MongoClient } = require('mongodb');

async function removeTypeFromTranslations() {
  const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db('factory');
    const coll = db.collection('Translations');

    // Conta documenti con type (esclusi Synonyms che manteniamo)
    const countWithType = await coll.countDocuments({
      type: { $exists: true, $ne: 'Synonyms' }
    });

    console.log(`📊 Documenti con campo 'type' (esclusi Synonyms): ${countWithType}\n`);

    if (countWithType === 0) {
      console.log('✅ Nessun documento da aggiornare. Campo type già rimosso o non presente.');
      return;
    }

    // Rimuovi campo type da tutti i documenti (esclusi Synonyms)
    console.log('⏳ Rimuovendo campo type...');
    const result = await coll.updateMany(
      { type: { $exists: true, $ne: 'Synonyms' } },
      { $unset: { type: "" } }
    );

    console.log(`\n✅ Completato!`);
    console.log(`   - Documenti modificati: ${result.modifiedCount}`);
    console.log(`   - Campo 'type' rimosso (Synonyms mantenuti)\n`);

    // Verifica
    const remainingWithType = await coll.countDocuments({
      type: { $exists: true, $ne: 'Synonyms' }
    });
    const synonymsCount = await coll.countDocuments({ type: 'Synonyms' });

    console.log(`📊 Verifica finale:`);
    console.log(`   - Documenti con type (non-Synonyms): ${remainingWithType} (dovrebbe essere 0)`);
    console.log(`   - Documenti Synonyms mantenuti: ${synonymsCount}\n`);

  } catch (error) {
    console.error('❌ Errore:', error);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await client.close();
    console.log('🔌 Connessione chiusa');
  }
}

removeTypeFromTranslations();


