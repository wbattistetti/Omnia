/**
 * Script: Lista tutte le collection nel database
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function listCollections() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const collections = await db.listCollections().toArray();

    console.log(`\n📊 Found ${collections.length} collections:\n`);

    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`  - ${collection.name}: ${count} documents`);
    }

    // Check for Tasks collection
    if (collections.some(c => c.name === 'Tasks')) {
      console.log('\n🔍 Checking Tasks collection...');
      const tasksCollection = db.collection('Tasks');
      const tasks = await tasksCollection.find({}).limit(5).toArray();

      if (tasks.length > 0) {
        console.log(`\n📋 Sample task structure:`);
        console.log(JSON.stringify(tasks[0], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

listCollections()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

