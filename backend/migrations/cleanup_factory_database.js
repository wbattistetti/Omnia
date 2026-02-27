// Migration script: Clean Factory database completely
// Removes all templates, embeddings, and related data
// Run this script to clean the Factory database before recreating templates

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory'; // lowercase as used in server.js

/**
 * Clean Factory database completely
 */
async function cleanFactoryDatabase(client) {
  const db = client.db(dbFactory);

  console.log('\n📋 Cleaning Factory database completely...\n');

  // List all collections
  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collection(s) in Factory database\n`);

  let totalRemoved = 0;

  for (const collInfo of collections) {
    const collName = collInfo.name;
    const coll = db.collection(collName);

    // Count documents
    const count = await coll.countDocuments();

    if (count > 0) {
      console.log(`  🔍 Collection: ${collName} - ${count} document(s)`);

      // Delete all documents
      const deleteResult = await coll.deleteMany({});
      totalRemoved += deleteResult.deletedCount;

      console.log(`    ✅ Deleted ${deleteResult.deletedCount} document(s)`);
    } else {
      console.log(`  ℹ️  Collection: ${collName} - empty (skipped)`);
    }
  }

  console.log(`\n✅ Factory database cleaned:`);
  console.log(`   - Total documents removed: ${totalRemoved}`);
  console.log(`   - Collections processed: ${collections.length}`);

  return totalRemoved;
}

/**
 * Main cleanup function
 */
async function cleanupFactoryDatabase() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // Clean Factory database
    await cleanFactoryDatabase(client);

    console.log('\n✅ Cleanup completed successfully!');
    console.log(`\n💡 Factory database is now clean. You can recreate templates using the wizard.`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run cleanup
if (require.main === module) {
  cleanupFactoryDatabase()
    .then(() => {
      console.log('\n✅ Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupFactoryDatabase };
