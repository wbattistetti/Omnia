/*
 * Migration script to add 'mode' field to AgentActs based on 'isInteractive'
 * Usage: node backend/migrate_agent_acts_mode.js
 */

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

function deriveModeFromDoc(doc) {
  if (doc.mode) return doc.mode;
  if (doc.isInteractive === true) return 'DataRequest';
  if (doc.isInteractive === false) return 'Message';
  return 'Message'; // fallback
}

async function migrateAgentActs() {
  const client = new MongoClient(uri);
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('AgentActs');
    
    console.log('Fetching all AgentActs...');
    const acts = await coll.find({}).toArray();
    console.log(`Found ${acts.length} AgentActs`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const act of acts) {
      const currentMode = deriveModeFromDoc(act);
      
      // Skip if mode already exists and is correct
      if (act.mode === currentMode) {
        skipped++;
        continue;
      }
      
      // Update the document with mode
      const result = await coll.updateOne(
        { _id: act._id },
        { 
          $set: { 
            mode: currentMode,
            updatedAt: new Date().toISOString()
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        updated++;
        console.log(`Updated ${act._id}: ${act.label} -> mode: ${currentMode} (was isInteractive: ${act.isInteractive})`);
      }
    }
    
    console.log(`\nMigration completed:`);
    console.log(`- Updated: ${updated} documents`);
    console.log(`- Skipped: ${skipped} documents (already had correct mode)`);
    console.log(`- Total: ${acts.length} documents`);
    
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrateAgentActs()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });