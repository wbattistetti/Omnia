// List all collections in Factory database to see what's there

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'Factory';

async function listCollections() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const collections = await db.listCollections().toArray();

    console.log(`📋 Collections in ${dbFactory} database: ${collections.length}\n`);

    for (const coll of collections) {
      const collObj = db.collection(coll.name);
      const count = await collObj.countDocuments();
      console.log(`  - ${coll.name}: ${count} document(s)`);

      // If it's tasks or task_templates, show a sample
      if ((coll.name === 'tasks' || coll.name === 'task_templates') && count > 0) {
        const sample = await collObj.findOne({});
        if (sample) {
          console.log(`    Sample: id=${sample.id || sample._id}, type=${sample.type}, label=${sample.label || 'no label'}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  listCollections()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { listCollections };
