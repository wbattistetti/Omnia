import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function addAIAgentPattern() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const collection = db.collection('act_type_patterns');

    // Pattern per riconoscere "AI:" o "AI :" all'inizio della riga
    const aiAgentPattern = {
      type: 'AI_AGENT',
      language: 'IT',
      patterns: ['^AI\\s*:']
    };

    // Controlla se esiste già
    const existing = await collection.findOne({
      type: 'AI_AGENT',
      language: 'IT'
    });

    if (existing) {
      console.log('⚠️ Pattern AI_AGENT per IT esiste già. Aggiornamento...');
      await collection.updateOne(
        { type: 'AI_AGENT', language: 'IT' },
        { $set: { patterns: aiAgentPattern.patterns } }
      );
      console.log('✅ Pattern AI_AGENT aggiornato');
    } else {
      await collection.insertOne(aiAgentPattern);
      console.log('✅ Pattern AI_AGENT inserito per IT');
    }

    // Aggiungi anche per EN e PT
    const languages = ['EN', 'PT'];
    for (const lang of languages) {
      const existingLang = await collection.findOne({
        type: 'AI_AGENT',
        language: lang
      });

      if (existingLang) {
        console.log(`⚠️ Pattern AI_AGENT per ${lang} esiste già. Aggiornamento...`);
        await collection.updateOne(
          { type: 'AI_AGENT', language: lang },
          { $set: { patterns: ['^AI\\s*:'] } }
        );
        console.log(`✅ Pattern AI_AGENT aggiornato per ${lang}`);
      } else {
        await collection.insertOne({
          type: 'AI_AGENT',
          language: lang,
          patterns: ['^AI\\s*:']
        });
        console.log(`✅ Pattern AI_AGENT inserito per ${lang}`);
      }
    }

    console.log('✅ Completato! Pattern AI_AGENT aggiunto per tutte le lingue');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

addAIAgentPattern()
  .then(() => {
    console.log('🎉 Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante l\'esecuzione:', error);
    process.exit(1);
  });

