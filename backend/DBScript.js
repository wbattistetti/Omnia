const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const client = new MongoClient(uri);

async function migrateTestPassedFlag() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Lista dei database factory
    const factoryDbs = ['factory', 'factory_banking', 'factory_energy', 'factory_travel'];
    
    for (const dbName of factoryDbs) {
      const db = client.db(dbName);
      const collection = db.collection('AgentActs');
      
      // Conta documenti prima della migrazione
      const countBefore = await collection.countDocuments();
      console.log(`📊 ${dbName}.AgentActs: ${countBefore} documents`);
      
      if (countBefore === 0) {
        console.log(`⏭️  Skipping ${dbName} (empty)`);
        continue;
      }
      
      // Aggiungi il flag testPassed: false a tutti gli Agent Acts
      const result = await collection.updateMany(
        { testPassed: { $exists: false } }, // Solo documenti senza il flag
        { $set: { testPassed: false } }
      );
      
      console.log(`✅ ${dbName}: Updated ${result.modifiedCount} Agent Acts`);
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);git add .
  } finally {
    await client.close();
  }
}

migrateTestPassedFlag();