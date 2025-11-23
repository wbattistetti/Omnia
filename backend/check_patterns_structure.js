/**
 * Script per verificare la struttura del campo patterns nei template
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

async function checkPatterns() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const taskTemplatesCollection = db.collection('Task_Templates');

    // Cerca template con patterns
    const withPatterns = await taskTemplatesCollection.find({ 
      patterns: { $exists: true, $ne: null } 
    }).limit(10).toArray();
    
    console.log(`🔍 Found ${withPatterns.length} TaskTemplates with patterns (showing first 10):\n`);
    
    withPatterns.forEach((t, idx) => {
      console.log(`[${idx + 1}] ${t.label || t.id}:`);
      console.log(`   id: ${t.id}`);
      console.log(`   type: ${t.type}`);
      console.log(`   patterns type: ${Array.isArray(t.patterns) ? 'array' : typeof t.patterns}`);
      console.log(`   patterns value:`, JSON.stringify(t.patterns, null, 2).substring(0, 500));
      console.log('');
    });

    // Statistiche
    const total = await taskTemplatesCollection.countDocuments();
    const withPatternsCount = await taskTemplatesCollection.countDocuments({ 
      patterns: { $exists: true, $ne: null } 
    });
    
    console.log(`\n📊 Statistics:`);
    console.log(`   Total TaskTemplates: ${total}`);
    console.log(`   With patterns: ${withPatternsCount}`);
    console.log(`   Without patterns: ${total - withPatternsCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

checkPatterns().catch(console.error);






