/**
 * Delete obsolete/unwanted tasks from database
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Tasks to DELETE (obsolete/unwanted SayMessage tasks)
const tasksToDelete = [
  { id: 'bc2678c3-7157-45c9-8d5d-26ce6790ea11', label: 'Internal' },
  { id: 'b61542e3-5670-4b91-abbc-f654ff57998e', label: 'Website URL' },
  { id: '0d43d2c9-079c-46f5-a450-d187f006e8d2', label: 'Text field' },
  { id: 'da6f5fc7-010d-4c3f-a24d-b5c84e072754', label: 'Message' },
  { id: 'aa96dab7-2b9a-4845-bda3-51571163a198', label: 'Question' },
  { id: '4b290857-abb1-431f-ac7c-2cdd21311360', label: 'Number (SayMessage duplicate)' },
  { id: '0424b974-c573-4891-aaa5-12a0158ce6f6', label: 'POD/PDR code (SayMessage duplicate)' },
];

async function deleteObsoleteTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    console.log('🗑️  Deleting obsolete tasks...\n');

    let deletedCount = 0;
    let notFoundCount = 0;

    for (const taskInfo of tasksToDelete) {
      const task = await coll.findOne({ id: taskInfo.id });

      if (!task) {
        console.log(`   ⚠️  Not found: ${taskInfo.label} (${taskInfo.id})`);
        notFoundCount++;
        continue;
      }

      const result = await coll.deleteOne({ id: taskInfo.id });

      if (result.deletedCount > 0) {
        console.log(`   ✅ Deleted: ${taskInfo.label} (id: ${taskInfo.id})`);
        deletedCount++;
      } else {
        console.log(`   ⚠️  Failed to delete: ${taskInfo.label} (id: ${taskInfo.id})`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Deleted: ${deletedCount} tasks`);
    console.log(`   ⚠️  Not found: ${notFoundCount} tasks`);
    console.log(`   📋 Total processed: ${tasksToDelete.length} tasks`);

    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const remaining = await coll.find({
      id: { $in: tasksToDelete.map(t => t.id) }
    }).toArray();

    if (remaining.length > 0) {
      console.log(`   ⚠️  Warning: ${remaining.length} tasks still exist:`);
      remaining.forEach(task => {
        console.log(`      - ${task.label} (id: ${task.id || task._id})`);
      });
    } else {
      console.log('   ✅ All tasks successfully deleted');
    }

    console.log('\n✅ Operation completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

deleteObsoleteTasks()
  .then(() => {
    console.log('\n🎉 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
