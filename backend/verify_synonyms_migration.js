/**
 * Script per verificare che i sinonimi siano stati migrati correttamente
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

async function verifySynonyms() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const translationsCollection = db.collection('Translations');

    // Statistiche generali
    const total = await translationsCollection.countDocuments({ type: 'Synonyms' });
    console.log(`📊 Total Synonyms documents: ${total}\n`);

    // Per lingua
    const byLanguage = {
      it: await translationsCollection.countDocuments({ type: 'Synonyms', language: 'it' }),
      en: await translationsCollection.countDocuments({ type: 'Synonyms', language: 'en' }),
      pt: await translationsCollection.countDocuments({ type: 'Synonyms', language: 'pt' })
    };
    console.log('📊 By language:');
    console.log(`   IT: ${byLanguage.it}`);
    console.log(`   EN: ${byLanguage.en}`);
    console.log(`   PT: ${byLanguage.pt}\n`);

    // Per categoria
    const byCategory = {
      TypeTemplate: await translationsCollection.countDocuments({ type: 'Synonyms', category: 'TypeTemplate' }),
      TaskTemplate: await translationsCollection.countDocuments({ type: 'Synonyms', category: 'TaskTemplate' })
    };
    console.log('📊 By category:');
    console.log(`   TypeTemplate: ${byCategory.TypeTemplate}`);
    console.log(`   TaskTemplate: ${byCategory.TaskTemplate}\n`);

    // Esempi di sinonimi migrati
    console.log('📋 Sample synonyms (first 10):\n');
    const samples = await translationsCollection.find({ type: 'Synonyms' }).limit(10).toArray();
    
    samples.forEach((doc, idx) => {
      console.log(`[${idx + 1}] ${doc.category} - ${doc.language}:`);
      console.log(`   GUID: ${doc.guid}`);
      console.log(`   Synonyms (${doc.synonyms.length}):`, doc.synonyms.slice(0, 5).join(', '));
      if (doc.synonyms.length > 5) console.log(`   ... and ${doc.synonyms.length - 5} more`);
      console.log('');
    });

    // Verifica che PatternMemoryService possa caricarli
    console.log('🔍 Testing PatternMemoryService loading...\n');
    const { PatternMemoryService } = require('./services/PatternMemoryService');
    const patternService = new PatternMemoryService(MONGODB_URI, DB_FACTORY);
    
    const memory = await patternService.loadPatterns('it', null);
    console.log(`✅ Memory loaded for 'it':`);
    console.log(`   Templates with patterns: ${memory.templatePatterns.size}`);
    console.log(`   Unique patterns: ${memory.patternToGuids.size}`);
    
    // Test ricerca
    if (memory.templatePatterns.size > 0) {
      const firstGuid = Array.from(memory.templatePatterns.keys())[0];
      const synonyms = memory.getSynonymsForTemplate(firstGuid);
      console.log(`\n   Example - GUID ${firstGuid}:`);
      console.log(`   Synonyms:`, synonyms.slice(0, 5).join(', '));
    }

    // Test ricerca pattern
    const testText = 'giorno';
    const foundGuids = memory.findTemplatesByPattern(testText);
    console.log(`\n   Test search for "${testText}":`);
    console.log(`   Found ${foundGuids.length} matching templates`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

verifySynonyms().catch(console.error);




