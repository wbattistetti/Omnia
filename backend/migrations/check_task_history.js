/**
 * Verifica se i task con steps a root level sono stati modificati da script precedenti
 * o se sono il formato originale
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkTaskHistory() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const collection = factoryDb.collection('Tasks');

    // Find tasks with steps at root but no mainData
    const tasksWithRootSteps = await collection.find({
      type: 3,
      steps: { $exists: true, $ne: null },
      $or: [
        { mainData: { $exists: false } },
        { mainData: null },
        { mainData: [] }
      ]
    }).toArray();

    console.log(`📋 Found ${tasksWithRootSteps.length} tasks with steps at root but no mainData\n`);

    if (tasksWithRootSteps.length === 0) {
      console.log('✅ No tasks found with this structure');
      return;
    }

    // Analyze first few tasks
    console.log('='.repeat(70));
    console.log('📊 ANALYZING TASKS');
    console.log('='.repeat(70));

    for (let i = 0; i < Math.min(5, tasksWithRootSteps.length); i++) {
      const task = tasksWithRootSteps[i];
      console.log(`\n📋 Task ${i + 1}: ${task.id || task._id}`);
      console.log(`   Label: ${task.label || 'N/A'}`);
      console.log(`   Type: ${task.type}`);
      console.log(`   TemplateId: ${task.templateId || 'null'}`);
      console.log(`   Created: ${task.createdAt || 'N/A'}`);
      console.log(`   Updated: ${task.updatedAt || 'N/A'}`);

      // Check structure
      console.log(`   Structure:`);
      console.log(`     - Has mainData: ${task.mainData ? 'YES' : 'NO'}`);
      console.log(`     - Has steps (root): ${task.steps ? 'YES' : 'NO'}`);
      console.log(`     - Has dialogueSteps: ${task.dialogueSteps ? 'YES' : 'NO'}`);
      console.log(`     - Has subDataIds: ${task.subDataIds ? 'YES' : 'NO'}`);

      if (task.steps) {
        console.log(`     - Steps keys: ${Object.keys(task.steps).join(', ')}`);
        const firstStep = task.steps[Object.keys(task.steps)[0]];
        if (firstStep && firstStep.escalations) {
          console.log(`     - First step has escalations: YES (${firstStep.escalations.length} escalations)`);
        }
      }

      // Check if this looks like a sub-data node (referenced by subDataIds)
      if (task.subDataIds && Array.isArray(task.subDataIds) && task.subDataIds.length > 0) {
        console.log(`   ⚠️  This looks like a SUB-DATA node (referenced by: ${task.subDataIds.join(', ')})`);
        console.log(`      Sub-data nodes typically don't have mainData, but should have steps linked to parent mainData`);
      }

      // Check all keys to understand the structure
      const allKeys = Object.keys(task).filter(k => !k.startsWith('_'));
      console.log(`   All keys: ${allKeys.join(', ')}`);
    }

    // Check if these are sub-data nodes
    const subDataNodes = tasksWithRootSteps.filter(t =>
      t.subDataIds && Array.isArray(t.subDataIds) && t.subDataIds.length > 0
    );

    console.log(`\n` + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n  Total tasks with root steps (no mainData): ${tasksWithRootSteps.length}`);
    console.log(`  Tasks that look like sub-data nodes: ${subDataNodes.length}`);
    console.log(`  Tasks that are NOT sub-data nodes: ${tasksWithRootSteps.length - subDataNodes.length}`);

    if (subDataNodes.length > 0) {
      console.log(`\n  ⚠️  These ${subDataNodes.length} tasks are SUB-DATA nodes:`);
      console.log(`     They are referenced by other tasks via subDataIds`);
      console.log(`     They should NOT have mainData (they are part of a parent mainData)`);
      console.log(`     But they SHOULD have steps linked to their parent mainData.id`);
      console.log(`     The steps at root level might be a legacy format that needs migration`);
    }

    // Check if there are parent tasks that reference these
    if (subDataNodes.length > 0) {
      console.log(`\n  🔍 Checking for parent tasks...`);
      const subDataIds = subDataNodes.map(t => t.id || t._id?.toString()).filter(Boolean);

      const parentTasks = await collection.find({
        type: 3,
        'mainData.subDataIds': { $in: subDataIds }
      }).toArray();

      console.log(`  Found ${parentTasks.length} parent tasks that reference these sub-data nodes`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  checkTaskHistory().catch(console.error);
}

module.exports = { checkTaskHistory };

