// Migration script: Remove 'name' field from all tasks in Factory database
// Run this script once to clean up the database before implementing the new translation-based system

const { MongoClient } = require('mongodb');

// MongoDB connection string (use environment variable in production)
const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'Factory';

async function removeNameFromTasks() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const coll = db.collection('tasks');

    // Count tasks with 'name' field before migration
    const countBefore = await coll.countDocuments({ name: { $exists: true } });
    console.log(`📊 Found ${countBefore} tasks with 'name' field`);

    if (countBefore === 0) {
      console.log('✅ No tasks with "name" field found. Migration not needed.');
      return;
    }

    // Remove 'name' field from all tasks
    console.log('🔄 Removing "name" field from all tasks...');
    const result = await coll.updateMany(
      { name: { $exists: true } },
      { $unset: { name: "" } }
    );

    console.log(`✅ Migration completed:`);
    console.log(`   - Matched: ${result.matchedCount} tasks`);
    console.log(`   - Modified: ${result.modifiedCount} tasks`);

    // Verify migration
    const countAfter = await coll.countDocuments({ name: { $exists: true } });
    if (countAfter === 0) {
      console.log('✅ Verification passed: No tasks with "name" field remaining');
    } else {
      console.warn(`⚠️  Warning: ${countAfter} tasks still have "name" field`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  removeNameFromTasks()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { removeNameFromTasks };
