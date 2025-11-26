/**
 * Script per verificare la struttura dei template e trovare dove sono i sinonimi
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

async function checkTemplates() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    
    // Lista tutte le collezioni
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    console.log('');

    // Verifica type_templates
    const typeTemplatesCollection = db.collection('type_templates');
    const typeTemplatesCount = await typeTemplatesCollection.countDocuments();
    console.log(`📚 type_templates: ${typeTemplatesCount} documents\n`);

    if (typeTemplatesCount > 0) {
      const sample = await typeTemplatesCollection.findOne({});
      console.log('📄 Sample type_templates document:');
      console.log('   Keys:', Object.keys(sample));
      console.log('   id:', sample.id);
      console.log('   label:', sample.label);
      console.log('   type:', sample.type);
      console.log('   has synonyms:', !!sample.synonyms);
      if (sample.synonyms) {
        console.log('   synonyms type:', Array.isArray(sample.synonyms) ? 'array' : typeof sample.synonyms);
        console.log('   synonyms value:', JSON.stringify(sample.synonyms).substring(0, 200));
      }
      console.log('');
    }

    // Verifica Task_Templates
    const taskTemplatesCollection = db.collection('Task_Templates');
    const taskTemplatesCount = await taskTemplatesCollection.countDocuments();
    console.log(`📚 Task_Templates: ${taskTemplatesCount} documents\n`);

    if (taskTemplatesCount > 0) {
      const sample = await taskTemplatesCollection.findOne({});
      console.log('📄 Sample Task_Templates document:');
      console.log('   Keys:', Object.keys(sample));
      console.log('   id:', sample.id);
      console.log('   label:', sample.label || sample.name);
      console.log('   type:', sample.type);
      console.log('   has synonyms:', !!sample.synonyms);
      if (sample.synonyms) {
        console.log('   synonyms type:', Array.isArray(sample.synonyms) ? 'array' : typeof sample.synonyms);
        console.log('   synonyms value:', JSON.stringify(sample.synonyms).substring(0, 200));
      }
      console.log('');

      // Cerca template con sinonimi
      const withSynonyms = await taskTemplatesCollection.find({ 
        synonyms: { $exists: true, $ne: [] } 
      }).limit(5).toArray();
      
      console.log(`🔍 Found ${withSynonyms.length} TaskTemplates with synonyms (showing first 5):`);
      withSynonyms.forEach((t, idx) => {
        console.log(`\n   [${idx + 1}] ${t.label || t.name || t.id}:`);
        console.log(`      synonyms:`, JSON.stringify(t.synonyms).substring(0, 150));
      });
    }

    // Verifica Task_Types (vecchia collezione?)
    try {
      const taskTypesCollection = db.collection('Task_Types');
      const taskTypesCount = await taskTypesCollection.countDocuments();
      console.log(`\n📚 Task_Types: ${taskTypesCount} documents\n`);

      if (taskTypesCount > 0) {
        const sample = await taskTypesCollection.findOne({});
        console.log('📄 Sample Task_Types document:');
        console.log('   Keys:', Object.keys(sample));
        console.log('   name:', sample.name);
        console.log('   label:', sample.label);
        console.log('   has synonyms:', !!sample.synonyms);
        if (sample.synonyms) {
          console.log('   synonyms type:', Array.isArray(sample.synonyms) ? 'array' : typeof sample.synonyms);
          console.log('   synonyms value:', JSON.stringify(sample.synonyms).substring(0, 200));
        }
        console.log('');

        // Cerca template con sinonimi
        const withSynonyms = await taskTypesCollection.find({ 
          synonyms: { $exists: true, $ne: [] } 
        }).limit(5).toArray();
        
        console.log(`🔍 Found ${withSynonyms.length} Task_Types with synonyms (showing first 5):`);
        withSynonyms.forEach((t, idx) => {
          console.log(`\n   [${idx + 1}] ${t.name || t.label}:`);
          console.log(`      synonyms:`, JSON.stringify(t.synonyms).substring(0, 150));
        });
      }
    } catch (error) {
      console.log('⚠️  Task_Types collection not accessible:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

checkTemplates().catch(console.error);










