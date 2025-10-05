/*
 * Script per aggiungere campi scope e industry alle collezioni esistenti
 * 
 * Aggiunge a:
 * - AgentActs, BackendCalls, Conditions, Tasks, MacroTasks
 * 
 * Campi aggiunti:
 * - scope: "industry"
 * - industry: "utility-gas"
 * 
 * Usage: node backend/migrate_to_catalog.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function addScopeIndustryFields() {
  const client = new MongoClient(uri);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db('factory');
    
    // Lista delle collezioni da aggiornare
    const collectionsToUpdate = [
      'AgentActs',
      'BackendCalls', 
      'Conditions',
      'Tasks',
      'MacroTasks'
    ];
    
    console.log('\n🎯 Collections to update:');
    collectionsToUpdate.forEach(name => console.log(`  - ${name}`));
    
    // Controlla quali collezioni esistono
    const existingCollections = await db.listCollections().toArray();
    const existingCollectionNames = existingCollections.map(c => c.name);
    
    console.log('\n🔍 Checking existing collections...');
    const collectionsToProcess = collectionsToUpdate.filter(name => 
      existingCollectionNames.includes(name)
    );
    
    const missingCollections = collectionsToUpdate.filter(name => 
      !existingCollectionNames.includes(name)
    );
    
    if (missingCollections.length > 0) {
      console.log('\n⚠️  Missing collections (will be skipped):');
      missingCollections.forEach(name => console.log(`  - ${name}`));
    }
    
    if (collectionsToProcess.length === 0) {
      console.log('\n❌ No collections to update!');
      return;
    }
    
    console.log('\n✅ Collections to process:');
    collectionsToProcess.forEach(name => console.log(`  - ${name}`));
    
    // Conta documenti prima dell'aggiornamento
    console.log('\n📊 Document counts before update:');
    for (const collectionName of collectionsToProcess) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      console.log(`  - ${collectionName}: ${count} documents`);
    }
    
    // Aggiorna ogni collezione
    console.log('\n🔄 Updating collections...');
    console.log('=' .repeat(80));
    
    let totalUpdated = 0;
    
    for (const collectionName of collectionsToProcess) {
      const collection = db.collection(collectionName);
      
      try {
        console.log(`\n📋 Updating ${collectionName}...`);
        
        // Conta documenti che non hanno già i campi
        const docsWithoutScope = await collection.countDocuments({
          $or: [
            { scope: { $exists: false } },
            { industry: { $exists: false } }
          ]
        });
        
        console.log(`   Documents without scope/industry fields: ${docsWithoutScope}`);
        
        if (docsWithoutScope === 0) {
          console.log(`   ✅ All documents already have scope/industry fields`);
          continue;
        }
        
        // Aggiorna i documenti
        const updateResult = await collection.updateMany(
          {
            $or: [
              { scope: { $exists: false } },
              { industry: { $exists: false } }
            ]
          },
          {
            $set: {
              scope: "industry",
              industry: "utility-gas"
            }
          }
        );
        
        console.log(`   ✅ Updated ${updateResult.modifiedCount} documents`);
        totalUpdated += updateResult.modifiedCount;
        
        // Verifica l'aggiornamento
        const updatedCount = await collection.countDocuments({
          scope: "industry",
          industry: "utility-gas"
        });
        
        console.log(`   📊 Documents with scope="industry" and industry="utility-gas": ${updatedCount}`);
        
      } catch (error) {
        console.log(`   ❌ Error updating ${collectionName}: ${error.message}`);
      }
    }
    
    // Riepilogo finale
    console.log('\n' + '=' .repeat(80));
    console.log('📊 UPDATE SUMMARY:');
    console.log(`   Total documents updated: ${totalUpdated}`);
    
    // Verifica finale
    console.log('\n🔍 Final verification:');
    for (const collectionName of collectionsToProcess) {
      const collection = db.collection(collectionName);
      
      const totalDocs = await collection.countDocuments();
      const docsWithScope = await collection.countDocuments({
        scope: "industry",
        industry: "utility-gas"
      });
      
      console.log(`   - ${collectionName}: ${docsWithScope}/${totalDocs} documents have scope="industry" and industry="utility-gas"`);
    }
    
    // Mostra alcuni esempi
    console.log('\n📄 Sample documents after update:');
    for (const collectionName of collectionsToProcess) {
      const collection = db.collection(collectionName);
      const sample = await collection.findOne({
        scope: "industry",
        industry: "utility-gas"
      });
      
      if (sample) {
        console.log(`\n   ${collectionName} example:`);
        console.log(`     _id: ${sample._id}`);
        console.log(`     scope: ${sample.scope}`);
        console.log(`     industry: ${sample.industry}`);
        if (sample.name) console.log(`     name: ${sample.name}`);
        if (sample.key) console.log(`     key: ${sample.key}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during update:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

addScopeIndustryFields()
  .then(() => {
    console.log('\n🎉 Update completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Update failed:', err);
    process.exit(1);
  });
